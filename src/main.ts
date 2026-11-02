/*
 * Snapmaker U1 adapter for ioBroker.
 */

import * as utils from "@iobroker/adapter-core";
import { cameraUrl, discoverCameras, previewUrl } from "./lib/media";
import { fanNames, setFanSpeed } from "./lib/fans";
import { getPrinterInfo } from "./lib/moonraker";
import { mapStatus, readStatus, statusFields } from "./lib/status";

class SnapmakerU1 extends utils.Adapter {
	private pollTimer?: ioBroker.Timeout;
	private stopping = false;
	private connectionFailed = false;
	private commandQueue: Promise<void> = Promise.resolve();
	private readonly initializedMediaRoles = new Set<string>();

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "snapmaker-u1",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("message", async obj => {
			if (obj.command !== "discoverCameras" || !obj.callback) {
				return;
			}
			try {
				const cameras = await discoverCameras(this.config.host, this.config.port);
				this.sendTo(
					obj.from,
					obj.command,
					cameras.filter(c => c.enabled).map(c => ({ label: c.name, value: c.uid })),
					obj.callback,
				);
			} catch (error) {
				this.log.warn(`Camera discovery failed: ${String(error)}`);
				this.sendTo(obj.from, obj.command, [], obj.callback);
			}
		});
		this.on("stateChange", (id, state) => {
			if (!state || state.ack || this.stopping) {
				return;
			}
			const relativeId = id.slice(this.namespace.length + 1);
			if (!fanNames[relativeId]) {
				return;
			}
			this.commandQueue = this.commandQueue.then(async () => {
				if (this.stopping) {
					return;
				}
				try {
					await setFanSpeed(this.config.host, this.config.port, relativeId, state.val);
					const status = await readStatus(
						this.config.host,
						this.config.port,
						this.config.requestTimeout * 1_000,
					);
					const value = mapStatus(status)[relativeId.replace("printer.", "")];
					if (!this.stopping && value !== undefined) {
						await this.setStateAsync(relativeId, value, true);
					}
				} catch (error) {
					this.log.warn(`Fan command failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			});
		});
		this.on("unload", this.onUnload.bind(this));
	}

	/** Initializes the adapter after ioBroker has loaded the instance configuration. */
	private async onReady(): Promise<void> {
		await this.setStateAsync("info.connection", false, true);
		for (const channel of [
			"afc",
			"afc.lane0",
			"afc.lane1",
			"afc.lane2",
			"afc.lane3",
			"spoolman",
			"cover",
			"cover.circulation",
			"cover.exhaust",
			"job",
			"tools",
			"bed",
			"chamber",
			"tools.tool0",
			"tools.tool1",
			"tools.tool2",
			"tools.tool3",
		]) {
			await this.setObjectNotExistsAsync(`printer.${channel}`, {
				type: "channel",
				common: { name: channel },
				native: {},
			});
		}
		for (const [, , id, type, role, unit] of statusFields) {
			await this.setObjectNotExistsAsync(`printer.${id}`, {
				type: "state",
				common: { name: id, type, role, read: true, write: false, ...(unit ? { unit } : {}) },
				native: {},
			});
		}

		if (!this.config.host.trim()) {
			this.log.warn("Moonraker host is not configured. Set it in the adapter settings to connect the printer.");
			return;
		}
		for (const id of Object.keys(fanNames)) {
			await this.extendObjectAsync(id, { common: { write: true, min: 0, max: 100, role: "level.speed" } });
			this.subscribeStates(id);
		}

		await this.pollPrinter();
	}

	private async updateMedia(filename: string): Promise<void> {
		const write = async (id: string, value: string | number | boolean): Promise<void> => {
			const role = id.endsWith("streamUrl")
				? "url.cam"
				: id.endsWith("snapshotUrl")
					? "link.camera"
					: id.endsWith("previewUrl")
						? "url.icon"
						: typeof value === "boolean"
							? "indicator"
							: typeof value === "number"
								? "value"
								: "text";
			await this.setObjectNotExistsAsync(id, {
				type: "state",
				common: {
					name: id,
					type: typeof value as "string" | "number" | "boolean",
					role,
					read: true,
					write: false,
				},
				native: {},
			});
			if (!this.initializedMediaRoles.has(id)) {
				await this.extendObjectAsync(id, { common: { role } });
				this.initializedMediaRoles.add(id);
			}
			if (!this.stopping) {
				await this.setStateChangedAsync(id, value, true);
			}
		};
		await this.setObjectNotExistsAsync("cameras", {
			type: "channel",
			common: { name: "Selected cameras" },
			native: {},
		});
		if (this.config.selectedCameras?.length) {
			const cameras = await discoverCameras(this.config.host, this.config.port);
			for (const camera of cameras.filter(c => this.config.selectedCameras.includes(c.uid))) {
				const id = `cameras.${camera.uid.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
				await this.setObjectNotExistsAsync(id, { type: "channel", common: { name: camera.name }, native: {} });
				for (const [key, value] of Object.entries({
					name: camera.name,
					enabled: camera.enabled,
					streamUrl: cameraUrl(camera.stream_url, this.config.host),
					snapshotUrl: cameraUrl(camera.snapshot_url, this.config.host),
					service: camera.service,
					rotation: camera.rotation,
					flipHorizontal: camera.flip_horizontal,
					flipVertical: camera.flip_vertical,
				})) {
					if (value !== undefined) {
						await write(`${id}.${key}`, value);
					}
				}
			}
		}
		await write(
			"printer.job.previewUrl",
			this.config.previewEnabled ? await previewUrl(this.config.host, this.config.port, filename) : "",
		);
	}

	/** Retrieves printer metadata and schedules the next request. */
	private async pollPrinter(): Promise<void> {
		try {
			const printerInfo = await getPrinterInfo({
				host: this.config.host,
				port: this.config.port,
				timeoutMs: this.config.requestTimeout * 1_000,
			});

			const status = await readStatus(
				this.config.host,
				this.config.port,
				this.config.requestTimeout * 1_000,
				this.config.spoolmanEnabled,
			);
			if (this.stopping) {
				return;
			}
			for (const [id, value] of Object.entries(mapStatus(status))) {
				await this.setStateChangedAsync(`printer.${id}`, value, true);
			}
			await this.setStateChangedAsync("info.connection", true, true);
			await this.setStateChangedAsync("printer.info.hostname", printerInfo.hostname ?? "", true);
			await this.setStateChangedAsync("printer.info.firmware", printerInfo.softwareVersion ?? "", true);
			await this.setStateChangedAsync(
				"printer.info.status",
				printerInfo.stateMessage ?? printerInfo.state ?? "unknown",
				true,
			);
			await this.setStateChangedAsync("printer.info.lastUpdate", Date.now(), true);
			try {
				await this.updateMedia(String(mapStatus(status)["job.filename"] ?? ""));
			} catch (error) {
				this.log.debug(`Media update failed: ${String(error)}`);
			}
			if (this.connectionFailed) {
				this.log.info("Connection to Moonraker restored.");
			}
			this.connectionFailed = false;
		} catch (error) {
			if (this.stopping) {
				return;
			}
			await this.setStateChangedAsync("info.connection", false, true);
			const message = `Could not reach Moonraker: ${error instanceof Error ? error.message : String(error)}`;
			if (this.connectionFailed) {
				this.log.debug(message);
			} else {
				this.log.warn(message);
			}
			this.connectionFailed = true;
		} finally {
			this.schedulePoll();
		}
	}

	/** Schedules the next health check with the ioBroker timer API. */
	private schedulePoll(): void {
		if (this.stopping) {
			return;
		}
		if (this.pollTimer) {
			this.clearTimeout(this.pollTimer);
		}

		const intervalMs = Math.max(5, this.config.pollInterval) * 1_000;
		this.pollTimer = this.setTimeout(() => {
			this.pollTimer = undefined;
			void this.pollPrinter();
		}, intervalMs);
	}

	/**
	 * Clears pending timers and resets the connection indicator during shutdown.
	 *
	 * @param callback
	 */
	private onUnload(callback: () => void): void {
		this.stopping = true;
		try {
			if (this.pollTimer) {
				this.clearTimeout(this.pollTimer);
				this.pollTimer = undefined;
			}
			void this.setStateAsync("info.connection", false, true);
			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${(error as Error).message}`);
			callback();
		}
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new SnapmakerU1(options);
} else {
	(() => new SnapmakerU1())();
}
