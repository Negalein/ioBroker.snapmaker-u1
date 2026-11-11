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
const control_1 = require("./lib/control");
const config_1 = require("./lib/config");
const media_1 = require("./lib/media");
const fans_1 = require("./lib/fans");
const moonraker_1 = require("./lib/moonraker");
const status_1 = require("./lib/status");
const toolhead_1 = require("./lib/toolhead");
const jogStepId = "printer.control.jog.step";
const jogSpeedId = "printer.control.jog.speed";
const extrusionDistanceId = "printer.control.extrusion.distance";
const extrusionSpeedId = "printer.control.extrusion.speed";
const controlStateDefinitions = [
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
        def: control_1.DEFAULT_JOG_STEP_MM,
        unit: "mm",
        min: control_1.MIN_JOG_STEP_MM,
        max: control_1.MAX_JOG_STEP_MM,
    },
    {
        id: jogSpeedId,
        name: "Jog speed",
        type: "number",
        role: "level",
        read: true,
        write: true,
        def: control_1.DEFAULT_JOG_SPEED_MM_PER_SECOND,
        unit: "mm/s",
        min: control_1.MIN_JOG_SPEED_MM_PER_SECOND,
        max: control_1.MAX_JOG_SPEED_MM_PER_SECOND,
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
    {
        id: "printer.control.tools.tool0.target",
        name: "Tool E0 target temperature",
        type: "number",
        role: "level.temperature",
        read: true,
        write: true,
        def: 0,
        unit: "°C",
    },
    {
        id: "printer.control.tools.tool1.target",
        name: "Tool E1 target temperature",
        type: "number",
        role: "level.temperature",
        read: true,
        write: true,
        def: 0,
        unit: "°C",
    },
    {
        id: "printer.control.tools.tool2.target",
        name: "Tool E2 target temperature",
        type: "number",
        role: "level.temperature",
        read: true,
        write: true,
        def: 0,
        unit: "°C",
    },
    {
        id: "printer.control.tools.tool3.target",
        name: "Tool E3 target temperature",
        type: "number",
        role: "level.temperature",
        read: true,
        write: true,
        def: 0,
        unit: "°C",
    },
    {
        id: "printer.control.toolhead.change.e0",
        name: "Change and load tool E0",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.change.e1",
        name: "Change and load tool E1",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.change.e2",
        name: "Change and load tool E2",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.change.e3",
        name: "Change and load tool E3",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.unload.e0",
        name: "Unload tool E0 lane",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.unload.e1",
        name: "Unload tool E1 lane",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.unload.e2",
        name: "Unload tool E2 lane",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.unload.e3",
        name: "Unload tool E3 lane",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: extrusionDistanceId,
        name: "Manual extrusion distance",
        type: "number",
        role: "level",
        read: true,
        write: true,
        def: toolhead_1.DEFAULT_EXTRUSION_DISTANCE_MM,
        unit: "mm",
        min: toolhead_1.MIN_EXTRUSION_DISTANCE_MM,
        max: toolhead_1.MAX_EXTRUSION_DISTANCE_MM,
    },
    {
        id: extrusionSpeedId,
        name: "Manual extrusion speed",
        type: "number",
        role: "level",
        read: true,
        write: true,
        def: toolhead_1.DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND,
        unit: "mm/s",
        min: toolhead_1.MIN_EXTRUSION_SPEED_MM_PER_SECOND,
        max: toolhead_1.MAX_EXTRUSION_SPEED_MM_PER_SECOND,
    },
    {
        id: "printer.control.extrusion.extrude",
        name: "Extrude with active tool",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.extrusion.retract",
        name: "Retract with active tool",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
        def: false,
    },
    {
        id: "printer.control.toolhead.capabilities.changeTool",
        name: "CHANGE_TOOL macro detected",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.capabilities.laneUnload",
        name: "LANE_UNLOAD macro detected",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.capabilities.parkToolhead",
        name: "Verified park macro detected",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.capabilities.detectedMacros",
        name: "Detected Klipper macros",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "",
    },
    {
        id: "printer.control.toolhead.safety.toolChangeAllowed",
        name: "Tool change currently allowed",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.safety.unloadAllowed",
        name: "Lane unload currently allowed",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.safety.temperatureControlAvailable",
        name: "Tool temperature control available",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.safety.extrusionAllowed",
        name: "Manual extrusion currently allowed",
        type: "boolean",
        role: "indicator",
        read: true,
        write: false,
        def: false,
    },
    {
        id: "printer.control.toolhead.diagnostics.reason",
        name: "Toolhead control availability reason",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "",
    },
    {
        id: "printer.control.toolhead.diagnostics.lastFailure",
        name: "Latest toolhead control failure",
        type: "string",
        role: "text",
        read: true,
        write: false,
        def: "",
    },
];
class SnapmakerU1 extends utils.Adapter {
    pollTimer;
    stopping = false;
    connectionFailed = false;
    commandQueue = Promise.resolve();
    initializedMediaRoles = new Set();
    toolheadCapabilities = (0, toolhead_1.discoverToolheadCapabilities)([], {});
    toolheadCapabilitiesUpdatedAt = 0;
    constructor(options = {}) {
        super({
            ...options,
            name: "snapmaker-u1",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("message", async (obj) => {
            if (obj.command !== "discoverCameras" || !obj.callback) {
                return;
            }
            try {
                const cameras = await (0, media_1.discoverCameras)(this.config.host, this.config.port, this.getRequestTimeoutMs());
                this.sendTo(obj.from, obj.command, cameras.filter(c => c.enabled).map(c => ({ label: c.name, value: c.uid })), obj.callback);
            }
            catch (error) {
                this.log.warn(`Camera discovery failed: ${String(error)}`);
                this.sendTo(obj.from, obj.command, [], obj.callback);
            }
        });
        this.on("stateChange", (id, state) => {
            if (!state || state.ack || this.stopping) {
                return;
            }
            const relativeId = id.slice(this.namespace.length + 1);
            const controlAction = (0, control_1.getControlAction)(relativeId);
            const toolheadAction = (0, toolhead_1.getToolheadAction)(relativeId);
            const isJogSetting = relativeId === jogStepId || relativeId === jogSpeedId;
            const isExtrusionSetting = relativeId === extrusionDistanceId || relativeId === extrusionSpeedId;
            if (!fans_1.fanNames[relativeId] && !controlAction && !toolheadAction && !isJogSetting && !isExtrusionSetting) {
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
                if (isExtrusionSetting) {
                    await this.updateExtrusionSetting(relativeId, state.val);
                    return;
                }
                if (toolheadAction) {
                    await this.runToolheadAction(relativeId, toolheadAction, state.val);
                    return;
                }
                try {
                    await (0, fans_1.setFanSpeed)(this.config.host, this.config.port, relativeId, state.val, this.getRequestTimeoutMs());
                    const status = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs());
                    await this.updateStatusStates(status);
                    const value = (0, status_1.mapStatus)(status)[relativeId.replace("printer.", "")];
                    if (!this.stopping && value !== undefined) {
                        await this.setStateAsync(relativeId, value, true);
                    }
                }
                catch (error) {
                    this.log.warn(`Fan command failed: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        });
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
            "motion",
            "motion.position",
            "control",
            "control.home",
            "control.jog",
            "control.job",
            "control.safety",
            "control.tools",
            "control.tools.tool0",
            "control.tools.tool1",
            "control.tools.tool2",
            "control.tools.tool3",
            "control.toolhead",
            "control.toolhead.change",
            "control.toolhead.unload",
            "control.toolhead.capabilities",
            "control.toolhead.safety",
            "control.toolhead.diagnostics",
            "control.extrusion",
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
        await this.initializeControlStates();
        if (!this.config.host.trim()) {
            this.log.warn("Moonraker host is not configured. Set it in the adapter settings to connect the printer.");
            return;
        }
        for (const id of Object.keys(fans_1.fanNames)) {
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
    /** Returns a runtime-safe request timeout even if persisted configuration was edited outside Admin. */
    getRequestTimeoutMs() {
        return (0, config_1.requestTimeoutMs)(this.config.requestTimeout);
    }
    /** Returns a runtime-safe polling delay even if persisted configuration was edited outside Admin. */
    getPollIntervalMs() {
        return (0, config_1.pollIntervalMs)(this.config.pollInterval);
    }
    async updateMedia(filename) {
        const write = async (id, value) => {
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
                    type: typeof value,
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
            const cameras = await (0, media_1.discoverCameras)(this.config.host, this.config.port, this.getRequestTimeoutMs());
            for (const camera of cameras.filter(c => this.config.selectedCameras.includes(c.uid))) {
                const id = `cameras.${(0, media_1.cameraObjectId)(camera.uid)}`;
                await this.setObjectNotExistsAsync(id, { type: "channel", common: { name: "Camera" }, native: {} });
                await this.extendObjectAsync(id, { common: { name: "Camera" } });
                for (const [key, value] of Object.entries({
                    name: camera.name,
                    enabled: camera.enabled,
                    streamUrl: (0, media_1.cameraUrl)(camera.stream_url, this.config.host),
                    snapshotUrl: (0, media_1.cameraUrl)(camera.snapshot_url, this.config.host),
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
        await write("printer.job.previewUrl", this.config.previewEnabled
            ? await (0, media_1.previewUrl)(this.config.host, this.config.port, filename, this.getRequestTimeoutMs())
            : "");
    }
    /** Creates motion/control states and initializes values that are writable settings or buttons. */
    async initializeControlStates() {
        for (const definition of controlStateDefinitions) {
            const isButton = definition.role === "button";
            await this.setObjectNotExistsAsync(definition.id, {
                type: "state",
                common: {
                    name: definition.name,
                    type: definition.type,
                    role: definition.role,
                    read: isButton ? false : definition.read,
                    write: definition.write,
                    def: definition.def,
                    ...(definition.unit ? { unit: definition.unit } : {}),
                    ...(definition.min === undefined ? {} : { min: definition.min }),
                    ...(definition.max === undefined ? {} : { max: definition.max }),
                },
                native: {},
            });
            if (isButton) {
                // Update existing installations as well as fresh objects to the documented
                // write-only ioBroker button contract.
                await this.extendObjectAsync(definition.id, { common: { read: false, write: true } });
            }
            if (definition.write && !(await this.getStateAsync(definition.id))) {
                await this.setStateAsync(definition.id, definition.def, true);
            }
        }
    }
    /** Reads the persisted jog settings and falls back to the safe defaults when necessary. */
    async getJogSettings() {
        const [stepState, speedState] = await Promise.all([
            this.getStateAsync(jogStepId),
            this.getStateAsync(jogSpeedId),
        ]);
        const step = stepState?.val;
        const speed = speedState?.val;
        return {
            step: (0, control_1.validateJogStep)(step) ? step : control_1.DEFAULT_JOG_STEP_MM,
            speed: (0, control_1.validateJogSpeed)(speed) ? speed : control_1.DEFAULT_JOG_SPEED_MM_PER_SECOND,
        };
    }
    /** Acknowledges valid jog settings and restores the last safe setting on invalid input. */
    async updateJogSetting(id, value) {
        const isStep = id === jogStepId;
        if ((isStep && (0, control_1.validateJogStep)(value)) || (!isStep && (0, control_1.validateJogSpeed)(value))) {
            await this.setStateAsync(id, value, true);
            return;
        }
        const settings = await this.getJogSettings();
        await this.setStateAsync(id, isStep ? settings.step : settings.speed, true);
        await this.setControlFailure(isStep
            ? `Jog step must be a number from ${control_1.MIN_JOG_STEP_MM} to ${control_1.MAX_JOG_STEP_MM} mm.`
            : `Jog speed must be a number from ${control_1.MIN_JOG_SPEED_MM_PER_SECOND} to ${control_1.MAX_JOG_SPEED_MM_PER_SECOND} mm/s.`);
    }
    /** Reads persisted manual-extrusion settings and falls back to conservative defaults. */
    async getExtrusionSettings() {
        const [distanceState, speedState] = await Promise.all([
            this.getStateAsync(extrusionDistanceId),
            this.getStateAsync(extrusionSpeedId),
        ]);
        return {
            distance: (0, toolhead_1.validateExtrusionDistance)(distanceState?.val) ? distanceState.val : toolhead_1.DEFAULT_EXTRUSION_DISTANCE_MM,
            speed: (0, toolhead_1.validateExtrusionSpeed)(speedState?.val) ? speedState.val : toolhead_1.DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND,
        };
    }
    /** Acknowledges safe extrusion settings and restores a known-safe value on invalid input. */
    async updateExtrusionSetting(id, value) {
        const isDistance = id === extrusionDistanceId;
        if ((isDistance && (0, toolhead_1.validateExtrusionDistance)(value)) || (!isDistance && (0, toolhead_1.validateExtrusionSpeed)(value))) {
            await this.setStateAsync(id, value, true);
            return;
        }
        const settings = await this.getExtrusionSettings();
        await this.setStateAsync(id, isDistance ? settings.distance : settings.speed, true);
        await this.setControlFailure(isDistance
            ? `Extrusion distance must be a number from ${toolhead_1.MIN_EXTRUSION_DISTANCE_MM} to ${toolhead_1.MAX_EXTRUSION_DISTANCE_MM} mm.`
            : `Extrusion speed must be a number from ${toolhead_1.MIN_EXTRUSION_SPEED_MM_PER_SECOND} to ${toolhead_1.MAX_EXTRUSION_SPEED_MM_PER_SECOND} mm/s.`);
    }
    /** Refreshes optional U1 capabilities from the connected Moonraker/Klipper instance. */
    async refreshToolheadCapabilities(force = false) {
        if (!force && Date.now() - this.toolheadCapabilitiesUpdatedAt < 60_000) {
            return;
        }
        const timeoutMs = this.getRequestTimeoutMs();
        const objects = await (0, moonraker_1.getPrinterObjects)({
            host: this.config.host,
            port: this.config.port,
            timeoutMs,
        });
        let settings = {};
        try {
            settings = await (0, moonraker_1.getPrinterConfiguration)({
                host: this.config.host,
                port: this.config.port,
                timeoutMs,
            });
        }
        catch (error) {
            this.log.debug(`Toolhead temperature limits are unavailable: ${String(error)}`);
        }
        this.toolheadCapabilities = (0, toolhead_1.discoverToolheadCapabilities)(objects, settings);
        this.toolheadCapabilitiesUpdatedAt = Date.now();
    }
    /** Validates, sends and acknowledges an optional capability-gated PAXX12 toolhead command. */
    async runToolheadAction(id, action, value) {
        const isTemperatureAction = action.type === "setTemperature";
        if (!isTemperatureAction && value !== true) {
            await this.setStateAsync(id, false, true);
            return;
        }
        let status;
        try {
            await this.refreshToolheadCapabilities(true);
            status = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs(), false, true);
            const extrusion = action.type === "extrude" ? await this.getExtrusionSettings() : undefined;
            const safety = (0, toolhead_1.checkToolheadSafety)(action, status, this.config.firmware, this.toolheadCapabilities, value, extrusion);
            await this.updateToolheadSafety(status, extrusion);
            if (!safety.ok) {
                throw new Error(safety.reason ?? "Toolhead command was rejected by the safety check.");
            }
            await (0, moonraker_1.executeGcodeScript)({
                host: this.config.host,
                port: this.config.port,
                timeoutMs: this.getRequestTimeoutMs(),
                script: (0, toolhead_1.createToolheadCommand)(action, typeof value === "number" ? value : undefined, extrusion),
            });
            await this.setStateAsync("printer.control.lastCommand", id, true);
            await this.setStateAsync("printer.control.lastError", "", true);
            const updatedStatus = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs(), false, true);
            await this.updateStatusStates(updatedStatus);
            status = updatedStatus;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.warn(`Toolhead command ${id} rejected or failed: ${message}`);
            await this.setControlFailure(message);
        }
        finally {
            if (isTemperatureAction) {
                const observedTarget = this.getObservedToolTarget(status, action.tool);
                await this.setStateAsync(id, observedTarget ?? 0, true);
            }
            else {
                await this.setStateAsync(id, false, true);
            }
        }
    }
    /** Reads a target from a fresh status response for acknowledgement after a temperature request. */
    getObservedToolTarget(status, tool) {
        if (!status) {
            return undefined;
        }
        const object = tool === 0 ? "extruder" : `extruder${tool}`;
        const value = status[object]?.target;
        return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    }
    /** Validates, sends and acknowledges a fixed printer-control command. */
    async runControlAction(id, action, value) {
        if (value !== true) {
            await this.setStateAsync(id, false, true);
            return;
        }
        try {
            const status = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs(), false);
            const jog = await this.getJogSettings();
            const safety = (0, control_1.checkControlSafety)(action, status, this.config.firmware, jog);
            await this.updateControlSafety(status, jog);
            if (!safety.ok) {
                throw new Error(safety.reason ?? "Control command was rejected by the safety check.");
            }
            await (0, moonraker_1.executeGcodeScript)({
                host: this.config.host,
                port: this.config.port,
                timeoutMs: this.getRequestTimeoutMs(),
                script: (0, control_1.createControlCommand)(action, jog),
            });
            await this.setStateAsync("printer.control.lastCommand", id, true);
            await this.setStateAsync("printer.control.lastError", "", true);
            const updatedStatus = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs(), false);
            await this.updateStatusStates(updatedStatus);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.warn(`Control command ${id} rejected or failed: ${message}`);
            await this.setControlFailure(message);
        }
        finally {
            await this.setStateAsync(id, false, true);
        }
    }
    /** Publishes centralized control availability from the latest Moonraker status. */
    async updateControlSafety(status, jog) {
        const settings = jog ?? (await this.getJogSettings());
        const homingSafety = (0, control_1.checkControlSafety)({ type: "home" }, status, this.config.firmware);
        const joggingAllowed = Object.values(control_1.controlActions).some(action => action.type === "jog" && (0, control_1.checkControlSafety)(action, status, this.config.firmware, settings).ok);
        const jobControlAllowed = Object.values(control_1.controlActions).some(action => action.type === "job" && (0, control_1.checkControlSafety)(action, status, this.config.firmware, settings).ok);
        const enabled = (0, control_1.supportsControl)(this.config.firmware);
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
    /** Publishes live macro detection and safety diagnostics for the optional U1 toolhead controls. */
    async updateToolheadSafety(status, extrusion) {
        const settings = extrusion ?? (await this.getExtrusionSettings());
        const toolChangeAllowed = this.toolheadCapabilities.tools.some(tool => (0, toolhead_1.checkToolheadSafety)({ type: "changeTool", tool: tool.tool }, status, this.config.firmware, this.toolheadCapabilities).ok);
        const unloadAllowed = this.toolheadCapabilities.tools.some(tool => (0, toolhead_1.checkToolheadSafety)({ type: "unloadLane", tool: tool.tool }, status, this.config.firmware, this.toolheadCapabilities).ok);
        const temperatureControlAvailable = this.toolheadCapabilities.tools.some(tool => tool.temperatureControl);
        const extrusionAllowed = (0, toolhead_1.checkToolheadSafety)({ type: "extrude", direction: 1 }, status, this.config.firmware, this.toolheadCapabilities, undefined, settings).ok;
        const reason = this.getToolheadAvailabilityReason(status, toolChangeAllowed, unloadAllowed, temperatureControlAvailable);
        await Promise.all([
            this.setStateChangedAsync("printer.control.toolhead.capabilities.changeTool", this.toolheadCapabilities.tools.some(tool => tool.changeTool), true),
            this.setStateChangedAsync("printer.control.toolhead.capabilities.laneUnload", this.toolheadCapabilities.tools.some(tool => tool.unloadLane), true),
            this.setStateChangedAsync("printer.control.toolhead.capabilities.parkToolhead", this.toolheadCapabilities.parkToolhead, true),
            this.setStateChangedAsync("printer.control.toolhead.capabilities.detectedMacros", this.toolheadCapabilities.detectedMacros.join(", "), true),
            this.setStateChangedAsync("printer.control.toolhead.safety.toolChangeAllowed", toolChangeAllowed, true),
            this.setStateChangedAsync("printer.control.toolhead.safety.unloadAllowed", unloadAllowed, true),
            this.setStateChangedAsync("printer.control.toolhead.safety.temperatureControlAvailable", temperatureControlAvailable && (0, control_1.supportsControl)(this.config.firmware), true),
            this.setStateChangedAsync("printer.control.toolhead.safety.extrusionAllowed", extrusionAllowed, true),
            this.setStateChangedAsync("printer.control.toolhead.diagnostics.reason", reason, true),
        ]);
    }
    /** Explains whether a capability, printer state or AFC fault is holding back toolhead controls. */
    getToolheadAvailabilityReason(status, toolChangeAllowed, unloadAllowed, temperatureControlAvailable) {
        if (!(0, control_1.supportsControl)(this.config.firmware)) {
            return "Toolhead control is disabled until the firmware mode is explicitly set to PAXX12.";
        }
        const afcError = status.AFC?.error_state;
        if (afcError === true) {
            return "AFC reports an error. Resolve printer.afc.error before requesting a tool change or lane unload.";
        }
        const reportedPrintState = status.print_stats?.state;
        const printState = typeof reportedPrintState === "string" ? reportedPrintState : undefined;
        if (printState !== "standby" && printState !== "complete" && printState !== "cancelled") {
            return `Toolhead commands require an idle printer; Moonraker reports ${printState ?? "no print state"}.`;
        }
        if (!toolChangeAllowed && !unloadAllowed) {
            return "No confirmed CHANGE_TOOL or LANE_UNLOAD macro is available for an AFC lane on this printer.";
        }
        if (!temperatureControlAvailable) {
            return "Tool-change macros are available, but Klipper temperature limits were not detected for an individual target.";
        }
        return "Detected PAXX12/AFC capabilities are ready. Parking remains disabled because no verified parking macro is supported.";
    }
    /** Stores a visible failure message for rejected commands and invalid jog settings. */
    async setControlFailure(message) {
        await Promise.all([
            this.setStateAsync("printer.control.lastError", message, true),
            this.setStateAsync("printer.control.toolhead.diagnostics.lastFailure", message, true),
        ]);
    }
    /** Maps polling or post-command Moonraker state into ioBroker states. */
    async updateStatusStates(status) {
        const values = (0, status_1.mapStatus)(status);
        for (const [id, value] of Object.entries(values)) {
            await this.setStateChangedAsync(`printer.${id}`, value, true);
        }
        for (let tool = 0; tool < 4; tool++) {
            const target = values[`tools.tool${tool}.target`];
            if (typeof target === "number") {
                await this.setStateChangedAsync(`printer.control.tools.tool${tool}.target`, target, true);
            }
        }
        await this.updateControlSafety(status);
        await this.updateToolheadSafety(status);
    }
    /** Retrieves printer metadata and schedules the next request. */
    async pollPrinter() {
        try {
            const printerInfo = await (0, moonraker_1.getPrinterInfo)({
                host: this.config.host,
                port: this.config.port,
                timeoutMs: this.getRequestTimeoutMs(),
            });
            const status = await (0, status_1.readStatus)(this.config.host, this.config.port, this.getRequestTimeoutMs(), this.config.spoolmanEnabled, (0, control_1.supportsControl)(this.config.firmware));
            if (this.stopping) {
                return;
            }
            try {
                await this.refreshToolheadCapabilities();
            }
            catch (error) {
                this.log.debug(`Toolhead capability discovery failed: ${String(error)}`);
            }
            await this.updateStatusStates(status);
            await this.setStateChangedAsync("info.connection", true, true);
            await this.setStateChangedAsync("printer.info.hostname", printerInfo.hostname ?? "", true);
            await this.setStateChangedAsync("printer.info.firmware", printerInfo.softwareVersion ?? "", true);
            await this.setStateChangedAsync("printer.info.status", printerInfo.stateMessage ?? printerInfo.state ?? "unknown", true);
            await this.setStateChangedAsync("printer.info.lastUpdate", Date.now(), true);
            try {
                await this.updateMedia(String((0, status_1.mapStatus)(status)["job.filename"] ?? ""));
            }
            catch (error) {
                this.log.debug(`Media update failed: ${String(error)}`);
            }
            if (this.connectionFailed) {
                this.log.info("Connection to Moonraker restored.");
            }
            this.connectionFailed = false;
        }
        catch (error) {
            if (this.stopping) {
                return;
            }
            await this.setStateChangedAsync("info.connection", false, true);
            const message = `Could not reach Moonraker: ${error instanceof Error ? error.message : String(error)}`;
            if (this.connectionFailed) {
                this.log.debug(message);
            }
            else {
                this.log.warn(message);
            }
            this.connectionFailed = true;
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
        const intervalMs = this.getPollIntervalMs();
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