"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolheadActions = exports.DEFAULT_MIN_EXTRUDE_TEMPERATURE = exports.MAX_EXTRUSION_SPEED_MM_PER_SECOND = exports.MIN_EXTRUSION_SPEED_MM_PER_SECOND = exports.MAX_EXTRUSION_DISTANCE_MM = exports.MIN_EXTRUSION_DISTANCE_MM = exports.DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND = exports.DEFAULT_EXTRUSION_DISTANCE_MM = exports.TOOL_COUNT = void 0;
exports.getExtruderName = getExtruderName;
exports.getToolheadAction = getToolheadAction;
exports.validateExtrusionDistance = validateExtrusionDistance;
exports.validateExtrusionSpeed = validateExtrusionSpeed;
exports.discoverToolheadCapabilities = discoverToolheadCapabilities;
exports.checkToolheadSafety = checkToolheadSafety;
exports.createToolheadCommand = createToolheadCommand;
const control_1 = require("./control");
exports.TOOL_COUNT = 4;
exports.DEFAULT_EXTRUSION_DISTANCE_MM = 1;
exports.DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND = 2;
exports.MIN_EXTRUSION_DISTANCE_MM = 0.1;
exports.MAX_EXTRUSION_DISTANCE_MM = 10;
exports.MIN_EXTRUSION_SPEED_MM_PER_SECOND = 0.1;
exports.MAX_EXTRUSION_SPEED_MM_PER_SECOND = 10;
exports.DEFAULT_MIN_EXTRUDE_TEMPERATURE = 170;
/** Maps writable ioBroker states to fixed actions. No user-provided G-code is accepted. */
exports.toolheadActions = {
    "printer.control.toolhead.change.e0": { type: "changeTool", tool: 0 },
    "printer.control.toolhead.change.e1": { type: "changeTool", tool: 1 },
    "printer.control.toolhead.change.e2": { type: "changeTool", tool: 2 },
    "printer.control.toolhead.change.e3": { type: "changeTool", tool: 3 },
    "printer.control.toolhead.unload.e0": { type: "unloadLane", tool: 0 },
    "printer.control.toolhead.unload.e1": { type: "unloadLane", tool: 1 },
    "printer.control.toolhead.unload.e2": { type: "unloadLane", tool: 2 },
    "printer.control.toolhead.unload.e3": { type: "unloadLane", tool: 3 },
    "printer.control.tools.tool0.target": { type: "setTemperature", tool: 0 },
    "printer.control.tools.tool1.target": { type: "setTemperature", tool: 1 },
    "printer.control.tools.tool2.target": { type: "setTemperature", tool: 2 },
    "printer.control.tools.tool3.target": { type: "setTemperature", tool: 3 },
    "printer.control.extrusion.extrude": { type: "extrude", direction: 1 },
    "printer.control.extrusion.retract": { type: "extrude", direction: -1 },
};
/** Returns the configured Klipper extruder object name for a U1 tool number. */
function getExtruderName(tool) {
    return tool === 0 ? "extruder" : `extruder${tool}`;
}
/** Gets the fixed action bound to a writable toolhead state. */
function getToolheadAction(id) {
    return exports.toolheadActions[id];
}
/** Validates a conservative manually extruded/retracted length. */
function validateExtrusionDistance(value) {
    return (typeof value === "number" &&
        Number.isFinite(value) &&
        value >= exports.MIN_EXTRUSION_DISTANCE_MM &&
        value <= exports.MAX_EXTRUSION_DISTANCE_MM);
}
/** Validates a conservative manually extruded/retracted velocity. */
function validateExtrusionSpeed(value) {
    return (typeof value === "number" &&
        Number.isFinite(value) &&
        value >= exports.MIN_EXTRUSION_SPEED_MM_PER_SECOND &&
        value <= exports.MAX_EXTRUSION_SPEED_MM_PER_SECOND);
}
/**
 * Builds a capability map from Moonraker's live object list and Klipper's
 * parsed configuration. A capability is unavailable unless it is actually
 * present on the connected printer.
 */
function discoverToolheadCapabilities(objects, settings) {
    const available = new Set(objects);
    const detectedMacros = objects
        .filter(object => object.startsWith("gcode_macro "))
        .map(object => object.slice("gcode_macro ".length))
        .sort();
    const hasChangeTool = available.has("gcode_macro CHANGE_TOOL");
    const hasLaneUnload = available.has("gcode_macro LANE_UNLOAD");
    const tools = [0, 1, 2, 3].map(tool => {
        const extruder = getExtruderName(tool);
        const present = available.has(extruder);
        const configuration = settings[extruder] ?? {};
        const configuredMaximum = getFiniteNumber(configuration.max_temp);
        const configuredPower = getFiniteNumber(configuration.max_power);
        // Keep a margin below Klipper's hardware safety cutoff. The PAXX12
        // faulty-toolhead override limits max_power to a near-zero value, so it
        // is never exposed as heatable.
        const maxTemperature = configuredMaximum !== undefined &&
            configuredMaximum > 5 &&
            (configuredPower === undefined || configuredPower >= 0.01)
            ? configuredMaximum - 5
            : undefined;
        const minimumExtrudeTemperature = getFiniteNumber(configuration.min_extrude_temp) ?? exports.DEFAULT_MIN_EXTRUDE_TEMPERATURE;
        const laneExists = available.has(`AFC_lane E${tool}`);
        return {
            tool,
            extruder,
            present,
            temperatureControl: present && maxTemperature !== undefined,
            maxTemperature,
            minimumExtrudeTemperature,
            changeTool: present && laneExists && hasChangeTool,
            unloadLane: present && laneExists && hasLaneUnload,
        };
    });
    return { tools, detectedMacros, parkToolhead: false };
}
/** Checks whether an action is safe with the freshly-read Moonraker state. */
function checkToolheadSafety(action, status, firmware, capabilities, value, extrusion) {
    if (!(0, control_1.supportsControl)(firmware)) {
        return {
            ok: false,
            reason: "Toolhead control is enabled only when firmware mode is explicitly set to PAXX12.",
        };
    }
    const printState = getString(status, "print_stats", "state");
    if (!isIdlePrintState(printState)) {
        return {
            ok: false,
            reason: `Toolhead commands require an idle printer; Moonraker reports ${printState ?? "no print state"}.`,
        };
    }
    if (action.type === "changeTool" || action.type === "unloadLane") {
        const afcError = getBoolean(status, "AFC", "error_state");
        if (afcError === true) {
            return {
                ok: false,
                reason: "AFC reports an error; resolve printer.afc.error before changing or unloading a tool.",
            };
        }
        if (afcError !== false) {
            return {
                ok: false,
                reason: "AFC error status is unavailable; tool changing and lane unloading stay disabled.",
            };
        }
        const tool = getCapability(capabilities, action.tool);
        if (!tool) {
            return { ok: false, reason: `Tool E${action.tool} is not available on the connected printer.` };
        }
        if (action.type === "changeTool" && !tool.changeTool) {
            return {
                ok: false,
                reason: "CHANGE_TOOL and the matching AFC lane must be detected before a tool change is enabled.",
            };
        }
        if (action.type === "unloadLane" && !tool.unloadLane) {
            return {
                ok: false,
                reason: "LANE_UNLOAD and the matching AFC lane must be detected before unloading is enabled.",
            };
        }
        return { ok: true };
    }
    if (action.type === "setTemperature") {
        const tool = getCapability(capabilities, action.tool);
        if (!tool?.temperatureControl || tool.maxTemperature === undefined) {
            return {
                ok: false,
                reason: `Klipper temperature limits for tool E${action.tool} were not detected; its target cannot be set safely.`,
            };
        }
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > tool.maxTemperature) {
            return {
                ok: false,
                reason: `Tool E${action.tool} target must be a number from 0 to ${tool.maxTemperature} °C.`,
            };
        }
        return { ok: true };
    }
    if (!extrusion || !validateExtrusionDistance(extrusion.distance) || !validateExtrusionSpeed(extrusion.speed)) {
        return { ok: false, reason: "Extrusion distance or speed is outside the permitted range." };
    }
    const activeExtruder = getString(status, "toolhead", "extruder");
    const activeTool = capabilities.tools.find(tool => tool.extruder === activeExtruder);
    if (!activeTool?.present) {
        return { ok: false, reason: "Moonraker did not identify an available active U1 extruder." };
    }
    const extruderStatus = getRecord(status, activeTool.extruder);
    const temperature = typeof extruderStatus?.temperature === "number" ? extruderStatus.temperature : undefined;
    if (extruderStatus?.can_extrude !== true ||
        temperature === undefined ||
        temperature < activeTool.minimumExtrudeTemperature) {
        return {
            ok: false,
            reason: `Active tool E${activeTool.tool} is not hot enough for extrusion (${activeTool.minimumExtrudeTemperature} °C minimum).`,
        };
    }
    return { ok: true };
}
/** Creates only commands whose macro or Klipper primitive passed the safety check. */
function createToolheadCommand(action, value, extrusion) {
    if (action.type === "changeTool") {
        return `CHANGE_TOOL LANE=E${action.tool}`;
    }
    if (action.type === "unloadLane") {
        return `LANE_UNLOAD LANE=E${action.tool}`;
    }
    if (action.type === "setTemperature") {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error("Tool temperature must be a finite number");
        }
        return `SET_HEATER_TEMPERATURE HEATER=${getExtruderName(action.tool)} TARGET=${value.toFixed(1)}`;
    }
    if (!extrusion || !validateExtrusionDistance(extrusion.distance) || !validateExtrusionSpeed(extrusion.speed)) {
        throw new Error("Extrusion distance or speed is outside the permitted range");
    }
    const distance = (action.direction * extrusion.distance).toFixed(3);
    const feedRate = Math.round(extrusion.speed * 60);
    return [
        "SAVE_GCODE_STATE NAME=IOBROKER_EXTRUDE",
        "M83",
        `G1 E${distance} F${feedRate}`,
        "M400",
        "RESTORE_GCODE_STATE NAME=IOBROKER_EXTRUDE",
    ].join("\n");
}
function getCapability(capabilities, tool) {
    return capabilities.tools.find(candidate => candidate.tool === tool);
}
function isIdlePrintState(state) {
    return state === "standby" || state === "complete" || state === "cancelled";
}
function getRecord(status, object) {
    const value = status[object];
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function getString(status, object, key) {
    const value = getRecord(status, object)?.[key];
    return typeof value === "string" ? value : undefined;
}
function getBoolean(status, object, key) {
    const value = getRecord(status, object)?.[key];
    return typeof value === "boolean" ? value : undefined;
}
function getFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=toolhead.js.map