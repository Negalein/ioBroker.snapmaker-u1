"use strict";
/*
 * Snapmaker U1 adapter for ioBroker.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("@iobroker/adapter-core"));
const moonraker_1 = require("./lib/moonraker");
const status_1 = require("./lib/status");
class SnapmakerU1 extends utils.Adapter {
    pollTimer;
    stopping = false;
    constructor(options = {}) {
        super({
            ...options,
            name: "snapmaker-u1",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /** Initializes the adapter after ioBroker has loaded the instance configuration. */
    async onReady() {
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
        for (const [, , id, type, role, unit] of status_1.statusFields) {
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
        await this.pollPrinter();
    }
    /** Retrieves printer metadata and schedules the next request. */
    async pollPrinter() {
        try {
            const printerInfo = await (0, moonraker_1.getPrinterInfo)({
                host: this.config.host,
                port: this.config.port,
                timeoutMs: this.config.requestTimeout * 1_000,
            });
            const status = await (0, status_1.readStatus)(this.config.host, this.config.port, this.config.requestTimeout * 1_000, this.config.spoolmanEnabled);
            if (this.stopping) {
                return;
            }
            for (const [id, value] of Object.entries((0, status_1.mapStatus)(status))) {
                await this.setStateChangedAsync(`printer.${id}`, value, true);
            }
            await this.setStateChangedAsync("info.connection", true, true);
            await this.setStateChangedAsync("printer.info.hostname", printerInfo.hostname ?? "", true);
            await this.setStateChangedAsync("printer.info.firmware", printerInfo.softwareVersion ?? "", true);
            await this.setStateChangedAsync("printer.info.status", printerInfo.stateMessage ?? printerInfo.state ?? "unknown", true);
            await this.setStateChangedAsync("printer.info.lastUpdate", Date.now(), true);
        }
        catch (error) {
            await this.setStateChangedAsync("info.connection", false, true);
            this.log.warn(`Could not reach Moonraker: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            this.schedulePoll();
        }
    }
    /** Schedules the next health check with the ioBroker timer API. */
    schedulePoll() {
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
    onUnload(callback) {
        this.stopping = true;
        try {
            if (this.pollTimer) {
                this.clearTimeout(this.pollTimer);
                this.pollTimer = undefined;
            }
            void this.setStateAsync("info.connection", false, true);
            callback();
        }
        catch (error) {
            this.log.error(`Error during unloading: ${error.message}`);
            callback();
        }
    }
}
if (require.main !== module) {
    module.exports = (options) => new SnapmakerU1(options);
}
else {
    (() => new SnapmakerU1())();
}
//# sourceMappingURL=main.js.map