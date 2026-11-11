import { expect } from "chai";
import { describe, it } from "mocha";
import {
	checkControlSafety,
	createControlCommand,
	DEFAULT_JOG_SPEED_MM_PER_SECOND,
	DEFAULT_JOG_STEP_MM,
	validateJogSpeed,
	validateJogStep,
} from "./control";

const safeStatus: Record<string, unknown> = {
	print_stats: { state: "standby" },
	pause_resume: { is_paused: false },
	toolhead: {
		homed_axes: "xyz",
		position: [100, 100, 100, 0],
		axis_minimum: [0, 0, 0, -10],
		axis_maximum: [200, 200, 200, 10],
	},
};

describe("printer control", () => {
	it("creates only fixed home, jog and print-control commands", () => {
		expect(createControlCommand({ type: "home" })).to.equal("G28");
		expect(createControlCommand({ type: "home", axis: "z" })).to.equal("G28 Z");
		expect(createControlCommand({ type: "job", command: "pause" })).to.equal("PAUSE");
		expect(createControlCommand({ type: "job", command: "resume" })).to.equal("RESUME");
		expect(createControlCommand({ type: "job", command: "cancel" })).to.equal("CANCEL_PRINT");
		expect(
			createControlCommand(
				{ type: "jog", axis: "x", direction: -1 },
				{ step: DEFAULT_JOG_STEP_MM, speed: DEFAULT_JOG_SPEED_MM_PER_SECOND },
			),
		).to.equal(
			[
				"SAVE_GCODE_STATE NAME=IOBROKER_JOG",
				"G91",
				"G1 X-1.000 F600",
				"M400",
				"RESTORE_GCODE_STATE NAME=IOBROKER_JOG",
			].join("\n"),
		);
	});

	it("rejects invalid jog settings", () => {
		for (const value of [0, 25.1, NaN, Infinity, "1"]) {
			expect(validateJogStep(value)).to.be.false;
		}
		for (const value of [0, 100.1, NaN, Infinity, "10"]) {
			expect(validateJogSpeed(value)).to.be.false;
		}
	});

	it("requires explicitly selected PAXX12 firmware for every control action", () => {
		for (const firmware of ["auto", "original"] as const) {
			const result = checkControlSafety({ type: "home" }, safeStatus, firmware);
			expect(result.ok).to.be.false;
			expect(result.reason).to.contain("PAXX12");
		}
	});

	it("rejects motion while a job is active and only permits matching job actions", () => {
		const printing = { ...safeStatus, print_stats: { state: "printing" } };
		expect(checkControlSafety({ type: "home" }, printing, "paxx12").ok).to.be.false;
		expect(checkControlSafety({ type: "job", command: "pause" }, printing, "paxx12").ok).to.be.true;
		expect(checkControlSafety({ type: "job", command: "resume" }, printing, "paxx12").ok).to.be.false;
		expect(checkControlSafety({ type: "job", command: "cancel" }, printing, "paxx12").ok).to.be.true;
	});

	it("requires homing and keeps jog targets within Moonraker-reported axis limits", () => {
		const jog = { step: 10, speed: 20 };
		expect(checkControlSafety({ type: "jog", axis: "x", direction: 1 }, safeStatus, "paxx12", jog).ok).to.be.true;

		const atLimit = {
			...safeStatus,
			toolhead: {
				...(safeStatus.toolhead as Record<string, unknown>),
				position: [195, 100, 100, 0],
			},
		};
		expect(checkControlSafety({ type: "jog", axis: "x", direction: 1 }, atLimit, "paxx12", jog).ok).to.be.false;

		const unhomed = {
			...safeStatus,
			toolhead: { ...(safeStatus.toolhead as Record<string, unknown>), homed_axes: "yz" },
		};
		expect(checkControlSafety({ type: "jog", axis: "x", direction: -1 }, unhomed, "paxx12", jog).ok).to.be.false;
	});
});
