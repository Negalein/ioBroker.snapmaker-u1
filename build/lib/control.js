"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlActions = exports.MAX_JOG_SPEED_MM_PER_SECOND = exports.MIN_JOG_SPEED_MM_PER_SECOND = exports.MAX_JOG_STEP_MM = exports.MIN_JOG_STEP_MM = exports.DEFAULT_JOG_SPEED_MM_PER_SECOND = exports.DEFAULT_JOG_STEP_MM = void 0;
exports.getControlAction = getControlAction;
exports.supportsControl = supportsControl;
exports.validateJogStep = validateJogStep;
exports.validateJogSpeed = validateJogSpeed;
exports.checkControlSafety = checkControlSafety;
exports.createControlCommand = createControlCommand;
exports.DEFAULT_JOG_STEP_MM = 1;
exports.DEFAULT_JOG_SPEED_MM_PER_SECOND = 10;
exports.MIN_JOG_STEP_MM = 0.1;
exports.MAX_JOG_STEP_MM = 25;
exports.MIN_JOG_SPEED_MM_PER_SECOND = 1;
exports.MAX_JOG_SPEED_MM_PER_SECOND = 100;
/** ioBroker button state IDs and the fixed action they represent. */
exports.controlActions = {
    "printer.control.home.all": { type: "home" },
    "printer.control.home.x": { type: "home", axis: "x" },
    "printer.control.home.y": { type: "home", axis: "y" },
    "printer.control.home.z": { type: "home", axis: "z" },
    "printer.control.jog.xPositive": { type: "jog", axis: "x", direction: 1 },
    "printer.control.jog.xNegative": { type: "jog", axis: "x", direction: -1 },
    "printer.control.jog.yPositive": { type: "jog", axis: "y", direction: 1 },
    "printer.control.jog.yNegative": { type: "jog", axis: "y", direction: -1 },
    "printer.control.jog.zPositive": { type: "jog", axis: "z", direction: 1 },
    "printer.control.jog.zNegative": { type: "jog", axis: "z", direction: -1 },
    "printer.control.job.pause": { type: "job", command: "pause" },
    "printer.control.job.resume": { type: "job", command: "resume" },
    "printer.control.job.cancel": { type: "job", command: "cancel" },
};
/** Returns the fixed action assigned to a writable command state. */
function getControlAction(id) {
    return exports.controlActions[id];
}
/** Checks whether the configured firmware has been explicitly validated for control commands. */
function supportsControl(firmware) {
    return firmware === "paxx12";
}
/** Validates a jog distance before it becomes part of a G-code command. */
function validateJogStep(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= exports.MIN_JOG_STEP_MM && value <= exports.MAX_JOG_STEP_MM;
}
/** Validates a jog speed before it becomes part of a G-code command. */
function validateJogSpeed(value) {
    return (typeof value === "number" &&
        Number.isFinite(value) &&
        value >= exports.MIN_JOG_SPEED_MM_PER_SECOND &&
        value <= exports.MAX_JOG_SPEED_MM_PER_SECOND);
}
/**
 * Performs the central, state-based safety validation for every printer-control action.
 *
 * @param action Fixed action selected by the writable ioBroker state.
 * @param status Fresh Moonraker status response.
 * @param firmware Configured adapter firmware mode.
 * @param jog Jog settings, required for jog actions.
 */
function checkControlSafety(action, status, firmware, jog) {
    if (!supportsControl(firmware)) {
        return {
            ok: false,
            reason: "Printer control is enabled only when firmware mode is explicitly set to PAXX12.",
        };
    }
    const printState = getString(status, "print_stats", "state");
    if (action.type === "job") {
        return checkJobSafety(action.command, printState, getBoolean(status, "pause_resume", "is_paused"));
    }
    if (!isIdlePrintState(printState)) {
        return {
            ok: false,
            reason: `Motion commands require an idle printer; Moonraker reports ${printState ?? "no print state"}.`,
        };
    }
    if (action.type === "home") {
        return { ok: true };
    }
    if (!jog || !validateJogStep(jog.step) || !validateJogSpeed(jog.speed)) {
        return { ok: false, reason: "Jog step or speed is outside the permitted range." };
    }
    const homedAxes = getString(status, "toolhead", "homed_axes");
    if (!homedAxes?.toLowerCase().includes(action.axis)) {
        return { ok: false, reason: `Axis ${action.axis.toUpperCase()} must be homed before jogging.` };
    }
    const position = getCoordinate(status, "position", action.axis);
    const minimum = getCoordinate(status, "axis_minimum", action.axis);
    const maximum = getCoordinate(status, "axis_maximum", action.axis);
    if (position === undefined || minimum === undefined || maximum === undefined || minimum > maximum) {
        return { ok: false, reason: "Moonraker did not provide usable position and axis-limit data." };
    }
    const target = position + action.direction * jog.step;
    if (target < minimum || target > maximum) {
        return {
            ok: false,
            reason: `Jog target ${target.toFixed(3)} mm exceeds the ${action.axis.toUpperCase()} axis range ${minimum.toFixed(3)}–${maximum.toFixed(3)} mm.`,
        };
    }
    return { ok: true };
}
/** Creates a fixed, validated Klipper G-code script for a permitted control action. */
function createControlCommand(action, jog) {
    if (action.type === "home") {
        return action.axis ? `G28 ${action.axis.toUpperCase()}` : "G28";
    }
    if (action.type === "job") {
        return action.command === "pause" ? "PAUSE" : action.command === "resume" ? "RESUME" : "CANCEL_PRINT";
    }
    if (!jog || !validateJogStep(jog.step) || !validateJogSpeed(jog.speed)) {
        throw new Error("Jog step or speed is outside the permitted range");
    }
    const distance = (action.direction * jog.step).toFixed(3);
    const feedRate = Math.round(jog.speed * 60);
    return [
        "SAVE_GCODE_STATE NAME=IOBROKER_JOG",
        "G91",
        `G1 ${action.axis.toUpperCase()}${distance} F${feedRate}`,
        "M400",
        "RESTORE_GCODE_STATE NAME=IOBROKER_JOG",
    ].join("\n");
}
function checkJobSafety(command, printState, isPaused) {
    if (command === "pause" && printState === "printing" && !isPaused) {
        return { ok: true };
    }
    if (command === "resume" && (printState === "paused" || isPaused)) {
        return { ok: true };
    }
    if (command === "cancel" && (printState === "printing" || printState === "paused" || isPaused)) {
        return { ok: true };
    }
    return {
        ok: false,
        reason: `The ${command} command is not valid while Moonraker reports ${printState ?? "no print state"}.`,
    };
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
function getCoordinate(status, key, axis) {
    const coordinate = getRecord(status, "toolhead")?.[key];
    if (!Array.isArray(coordinate)) {
        return undefined;
    }
    const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const value = coordinate[index];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=control.js.map