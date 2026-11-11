export const DEFAULT_JOG_STEP_MM = 1;
export const DEFAULT_JOG_SPEED_MM_PER_SECOND = 10;
export const MIN_JOG_STEP_MM = 0.1;
export const MAX_JOG_STEP_MM = 25;
export const MIN_JOG_SPEED_MM_PER_SECOND = 1;
export const MAX_JOG_SPEED_MM_PER_SECOND = 100;

export type Axis = "x" | "y" | "z";
export type HomeAction = { type: "home"; axis?: Axis };
export type JogAction = { type: "jog"; axis: Axis; direction: 1 | -1 };
export type JobAction = { type: "job"; command: "pause" | "resume" | "cancel" };
export type ControlAction = HomeAction | JogAction | JobAction;

export interface JogSettings {
	step: number;
	speed: number;
}

export interface ControlSafetyResult {
	ok: boolean;
	reason?: string;
}

/** ioBroker button state IDs and the fixed action they represent. */
export const controlActions: Readonly<Record<string, ControlAction>> = {
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
export function getControlAction(id: string): ControlAction | undefined {
	return controlActions[id];
}

/** Checks whether the configured firmware has been explicitly validated for control commands. */
export function supportsControl(firmware: "auto" | "original" | "paxx12"): boolean {
	return firmware === "paxx12";
}

/** Validates a jog distance before it becomes part of a G-code command. */
export function validateJogStep(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= MIN_JOG_STEP_MM && value <= MAX_JOG_STEP_MM;
}

/** Validates a jog speed before it becomes part of a G-code command. */
export function validateJogSpeed(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= MIN_JOG_SPEED_MM_PER_SECOND &&
		value <= MAX_JOG_SPEED_MM_PER_SECOND
	);
}

/**
 * Performs the central, state-based safety validation for every printer-control action.
 *
 * @param action Fixed action selected by the writable ioBroker state.
 * @param status Fresh Moonraker status response.
 * @param firmware Configured adapter firmware mode.
 * @param jog Jog settings, required for jog actions.
 */
export function checkControlSafety(
	action: ControlAction,
	status: Record<string, unknown>,
	firmware: "auto" | "original" | "paxx12",
	jog?: JogSettings,
): ControlSafetyResult {
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
export function createControlCommand(action: ControlAction, jog?: JogSettings): string {
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

function checkJobSafety(
	command: JobAction["command"],
	printState: string | undefined,
	isPaused: boolean | undefined,
): ControlSafetyResult {
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

function isIdlePrintState(state: string | undefined): boolean {
	return state === "standby" || state === "complete" || state === "cancelled";
}

function getRecord(status: Record<string, unknown>, object: string): Record<string, unknown> | undefined {
	const value = status[object];
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function getString(status: Record<string, unknown>, object: string, key: string): string | undefined {
	const value = getRecord(status, object)?.[key];
	return typeof value === "string" ? value : undefined;
}

function getBoolean(status: Record<string, unknown>, object: string, key: string): boolean | undefined {
	const value = getRecord(status, object)?.[key];
	return typeof value === "boolean" ? value : undefined;
}

function getCoordinate(
	status: Record<string, unknown>,
	key: "position" | "axis_minimum" | "axis_maximum",
	axis: Axis,
): number | undefined {
	const coordinate = getRecord(status, "toolhead")?.[key];
	if (!Array.isArray(coordinate)) {
		return undefined;
	}
	const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
	const value = coordinate[index];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
