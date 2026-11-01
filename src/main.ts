/*
 * Snapmaker U1 adapter for ioBroker.
 */

import * as utils from "@iobroker/adapter-core";
import { getPrinterInfo } from "./lib/moonraker";

class SnapmakerU1 extends utils.Adapter {
	private pollTimer?: ioBroker.Timeout;
	private stopping = false;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "snapmaker-u1",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/** Initializes the adapter after ioBroker has loaded the instance configuration. */
	private async onReady(): Promise<void> {
		await this.setStateAsync("info.connection", false, true);

		if (!this.config.host.trim()) {
			this.log.warn("Moonraker host is not configured. Set it in the adapter settings to connect the printer.");
			return;
		}

		await this.pollPrinter();
	}

	/** Retrieves printer metadata and schedules the next request. */
	private async pollPrinter(): Promise<void> {
		try {
			const printerInfo = await getPrinterInfo({
				host: this.config.host,
				port: this.config.port,
				timeoutMs: this.config.requestTimeout * 1_000,
			});

			await this.setStateChangedAsync("info.connection", true, true);
			await this.setStateChangedAsync("printer.info.hostname", printerInfo.hostname ?? "", true);
			await this.setStateChangedAsync("printer.info.firmware", printerInfo.softwareVersion ?? "", true);
			await this.setStateChangedAsync(
				"printer.info.status",
				printerInfo.stateMessage ?? printerInfo.state ?? "unknown",
				true,
			);
			await this.setStateChangedAsync("printer.info.lastUpdate", Date.now(), true);
		} catch (error) {
			await this.setStateChangedAsync("info.connection", false, true);
			this.log.warn(`Could not reach Moonraker: ${error instanceof Error ? error.message : String(error)}`);
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
