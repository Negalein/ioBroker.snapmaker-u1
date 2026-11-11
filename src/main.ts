/*
 * Snapmaker U1 adapter for ioBroker.
 */

import * as utils from "@iobroker/adapter-core";
import {
	checkControlSafety,
	controlActions,
	createControlCommand,
	DEFAULT_JOG_SPEED_MM_PER_SECOND,
	DEFAULT_JOG_STEP_MM,
	getControlAction,
	MAX_JOG_SPEED_MM_PER_SECOND,
	MAX_JOG_STEP_MM,
	MIN_JOG_SPEED_MM_PER_SECOND,
	MIN_JOG_STEP_MM,
	supportsControl,
	validateJogSpeed,
	validateJogStep,
	type ControlAction,
	type JogSettings,
} from "./lib/control";
import { cameraUrl, discoverCameras, previewUrl } from "./lib/media";
import { fanNames, setFanSpeed } from "./lib/fans";
import { executeGcodeScript, getPrinterInfo } from "./lib/moonraker";
import { mapStatus, readStatus, statusFields } from "./lib/status";

const jogStepId = "printer.control.jog.step";
const jogSpeedId = "printer.control.jog.speed";

interface ControlStateDefinition {
	id: string;
	name: string;
	type: ioBroker.CommonType;
	role: string;
	read: boolean;
	write: boolean;
	def: string | number | boolean;
	unit?: string;
	min?: number;
	max?: number;
}

const controlStateDefinitions: readonly ControlStateDefinition[] = [
	{
		id: "printer.motion.position.x",
		name: "X position",
		type: "number",
		role: "value.position",
		read: true,
		write: false,
		def: 0,
		unit: "mm",
	},
	{
		id: "printer.motion.position.y",
		name: "Y position",
		type: "number",
		role: "value.position",
		read: true,
		write: false,
		def: 0,
		unit: "mm",
	},
	{
		id: "printer.motion.position.z",
		name: "Z position",
		type: "number",
		role: "value.position",
		read: true,
		write: false,
		def: 0,
		unit: "mm",
	},
	{
		id: "printer.control.home.all",
		name: "Home all axes",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.home.x",
		name: "Home X axis",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.home.y",
		name: "Home Y axis",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.home.z",
		name: "Home Z axis",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: jogStepId,
		name: "Jog step",
		type: "number",
		role: "level",
		read: true,
		write: true,
		def: DEFAULT_JOG_STEP_MM,
		unit: "mm",
		min: MIN_JOG_STEP_MM,
		max: MAX_JOG_STEP_MM,
	},
	{
		id: jogSpeedId,
		name: "Jog speed",
		type: "number",
		role: "level",
		read: true,
		write: true,
		def: DEFAULT_JOG_SPEED_MM_PER_SECOND,
		unit: "mm/s",
		min: MIN_JOG_SPEED_MM_PER_SECOND,
		max: MAX_JOG_SPEED_MM_PER_SECOND,
	},
	{
		id: "printer.control.jog.xPositive",
		name: "Jog X positive",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.jog.xNegative",
		name: "Jog X negative",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.jog.yPositive",
		name: "Jog Y positive",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.jog.yNegative",
		name: "Jog Y negative",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.jog.zPositive",
		name: "Jog Z positive",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.jog.zNegative",
		name: "Jog Z negative",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.job.pause",
		name: "Pause print",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.job.resume",
		name: "Resume print",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.job.cancel",
		name: "Cancel print",
		type: "boolean",
		role: "button",
		read: true,
		write: true,
		def: false,
	},
	{
		id: "printer.control.safety.enabled",
		name: "Control enabled for selected firmware",
		type: "boolean",
		role: "indicator",
		read: true,
		write: false,
		def: false,
	},
	{
		id: "printer.control.safety.homingAllowed",
		name: "Homing currently allowed",
		type: "boolean",
		role: "indicator",
		read: true,
		write: false,
		def: false,
	},
	{
		id: "printer.control.safety.joggingAllowed",
		name: "At least one jog move currently allowed",
		type: "boolean",
		role: "indicator",
		read: true,
		write: false,
		def: false,
	},
	{
		id: "printer.control.safety.jobControlAllowed",
		name: "A print control command is currently allowed",
		type: "boolean",
		role: "indicator",
		read: true,
		write: false,
		def: false,
	},
	{
		id: "printer.control.safety.reason",
		name: "Current control safety status",
		type: "string",
		role: "text",
		read: true,
		write: false,
		def: "",
	},
	{
		id: "printer.control.lastCommand",
		name: "Last successful control command",
		type: "string",
		role: "text",
		read: true,
		write: false,
		def: "",
	},
	{
		id: "printer.control.lastError",
		name: "Last rejected or failed control command",
		type: "string",
		role: "text",
		read: true,
		write: false,
		def: "",
	},
];

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
			const controlAction = getControlAction(relativeId);
			const isJogSetting = relativeId === jogStepId || relativeId === jogSpeedId;
			if (!fanNames[relativeId] && !controlAction && !isJogSetting) {
				return;
			}
			this.commandQueue = this.commandQueue.then(async () => {
				if (this.stopping) {
					return;
				}
				if (isJogSetting) {
					await this.updateJogSetting(relativeId, state.val);
					return;
				}
				if (controlAction) {
					await this.runControlAction(relativeId, controlAction, state.val);
					return;
				}
				try {
					await setFanSpeed(this.config.host, this.config.port, relativeId, state.val);
					const status = await readStatus(
						this.config.host,
						this.config.port,
						this.config.requestTimeout * 1_000,
					);
					await this.updateStatusStates(status);
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
			"motion",
			"motion.position",
			"control",
			"control.home",
			"control.jog",
			"control.job",
			"control.safety",
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
		await this.initializeControlStates();

		if (!this.config.host.trim()) {
			this.log.warn("Moonraker host is not configured. Set it in the adapter settings to connect the printer.");
			return;
		}
		for (const id of Object.keys(fanNames)) {
			await this.extendObjectAsync(id, { common: { write: true, min: 0, max: 100, role: "level.speed" } });
			this.subscribeStates(id);
		}
		for (const { id, write } of controlStateDefinitions) {
			if (write) {
				this.subscribeStates(id);
			}
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

	/** Creates motion/control states and initializes values that are writable settings or buttons. */
	private async initializeControlStates(): Promise<void> {
		for (const definition of controlStateDefinitions) {
			await this.setObjectNotExistsAsync(definition.id, {
				type: "state",
				common: {
					name: definition.name,
					type: definition.type,
					role: definition.role,
					read: definition.read,
					write: definition.write,
					def: definition.def,
					...(definition.unit ? { unit: definition.unit } : {}),
					...(definition.min === undefined ? {} : { min: definition.min }),
					...(definition.max === undefined ? {} : { max: definition.max }),
				},
				native: {},
			});
			if (definition.write && !(await this.getStateAsync(definition.id))) {
				await this.setStateAsync(definition.id, definition.def, true);
			}
		}
	}

	/** Reads the persisted jog settings and falls back to the safe defaults when necessary. */
	private async getJogSettings(): Promise<JogSettings> {
		const [stepState, speedState] = await Promise.all([
			this.getStateAsync(jogStepId),
			this.getStateAsync(jogSpeedId),
		]);
		const step = stepState?.val;
		const speed = speedState?.val;
		return {
			step: validateJogStep(step) ? step : DEFAULT_JOG_STEP_MM,
			speed: validateJogSpeed(speed) ? speed : DEFAULT_JOG_SPEED_MM_PER_SECOND,
		};
	}

	/** Acknowledges valid jog settings and restores the last safe setting on invalid input. */
	private async updateJogSetting(id: string, value: unknown): Promise<void> {
		const isStep = id === jogStepId;
		if ((isStep && validateJogStep(value)) || (!isStep && validateJogSpeed(value))) {
			await this.setStateAsync(id, value, true);
			return;
		}
		const settings = await this.getJogSettings();
		await this.setStateAsync(id, isStep ? settings.step : settings.speed, true);
		await this.setControlFailure(
			isStep
				? `Jog step must be a number from ${MIN_JOG_STEP_MM} to ${MAX_JOG_STEP_MM} mm.`
				: `Jog speed must be a number from ${MIN_JOG_SPEED_MM_PER_SECOND} to ${MAX_JOG_SPEED_MM_PER_SECOND} mm/s.`,
		);
	}

	/** Validates, sends and acknowledges a fixed printer-control command. */
	private async runControlAction(id: string, action: ControlAction, value: unknown): Promise<void> {
		if (value !== true) {
			await this.setStateAsync(id, false, true);
			return;
		}
		try {
			const status = await readStatus(
				this.config.host,
				this.config.port,
				this.config.requestTimeout * 1_000,
				false,
			);
			const jog = await this.getJogSettings();
			const safety = checkControlSafety(action, status, this.config.firmware, jog);
			await this.updateControlSafety(status, jog);
			if (!safety.ok) {
				throw new Error(safety.reason ?? "Control command was rejected by the safety check.");
			}
			await executeGcodeScript({
				host: this.config.host,
				port: this.config.port,
				timeoutMs: this.config.requestTimeout * 1_000,
				script: createControlCommand(action, jog),
			});
			await this.setStateAsync("printer.control.lastCommand", id, true);
			await this.setStateAsync("printer.control.lastError", "", true);
			const updatedStatus = await readStatus(
				this.config.host,
				this.config.port,
				this.config.requestTimeout * 1_000,
				false,
			);
			await this.updateStatusStates(updatedStatus);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.log.warn(`Control command ${id} rejected or failed: ${message}`);
			await this.setControlFailure(message);
		} finally {
			await this.setStateAsync(id, false, true);
		}
	}

	/** Publishes centralized control availability from the latest Moonraker status. */
	private async updateControlSafety(status: Record<string, unknown>, jog?: JogSettings): Promise<void> {
		const settings = jog ?? (await this.getJogSettings());
		const homingSafety = checkControlSafety({ type: "home" }, status, this.config.firmware);
		const joggingAllowed = Object.values(controlActions).some(
			action => action.type === "jog" && checkControlSafety(action, status, this.config.firmware, settings).ok,
		);
		const jobControlAllowed = Object.values(controlActions).some(
			action => action.type === "job" && checkControlSafety(action, status, this.config.firmware, settings).ok,
		);
		const enabled = supportsControl(this.config.firmware);
		const reason = enabled
			? homingSafety.ok
				? "PAXX12 control is enabled; individual commands are checked again immediately before execution."
				: (homingSafety.reason ?? "Motion control is unavailable.")
			: (homingSafety.reason ?? "Printer control is disabled.");
		await Promise.all([
			this.setStateChangedAsync("printer.control.safety.enabled", enabled, true),
			this.setStateChangedAsync("printer.control.safety.homingAllowed", homingSafety.ok, true),
			this.setStateChangedAsync("printer.control.safety.joggingAllowed", joggingAllowed, true),
			this.setStateChangedAsync("printer.control.safety.jobControlAllowed", jobControlAllowed, true),
			this.setStateChangedAsync("printer.control.safety.reason", reason, true),
		]);
	}

	/** Stores a visible failure message for rejected commands and invalid jog settings. */
	private async setControlFailure(message: string): Promise<void> {
		await this.setStateAsync("printer.control.lastError", message, true);
	}

	/** Maps polling or post-command Moonraker state into ioBroker states. */
	private async updateStatusStates(status: Record<string, unknown>): Promise<void> {
		for (const [id, value] of Object.entries(mapStatus(status))) {
			await this.setStateChangedAsync(`printer.${id}`, value, true);
		}
		await this.updateControlSafety(status);
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
			await this.updateStatusStates(status);
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
