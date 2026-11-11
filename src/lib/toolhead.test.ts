import { expect } from "chai";
import { describe, it } from "mocha";
import {
	checkToolheadSafety,
	createToolheadCommand,
	DEFAULT_EXTRUSION_DISTANCE_MM,
	DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND,
	discoverToolheadCapabilities,
	validateExtrusionDistance,
	validateExtrusionSpeed,
} from "./toolhead";

const objects = [
	"extruder",
	"extruder1",
	"extruder2",
	"extruder3",
	"AFC_lane E0",
	"AFC_lane E1",
	"AFC_lane E2",
	"AFC_lane E3",
	"gcode_macro CHANGE_TOOL",
	"gcode_macro LANE_UNLOAD",
];

const settings = {
	extruder: { max_temp: 300, min_extrude_temp: 175 },
	extruder1: { max_temp: 300, min_extrude_temp: 175 },
	extruder2: { max_temp: 300, min_extrude_temp: 175 },
	extruder3: { max_temp: 300, min_extrude_temp: 175 },
};

const safeStatus: Record<string, unknown> = {
	print_stats: { state: "standby" },
	AFC: { error_state: false },
	toolhead: { extruder: "extruder1" },
	extruder1: { temperature: 200, can_extrude: true },
};

describe("PAXX12 toolhead control", () => {
	it("only enables documented AFC Lite macros when the live printer exposes them", () => {
		const capabilities = discoverToolheadCapabilities(objects, settings);
		expect(capabilities.tools[0]).to.include({
			present: true,
			temperatureControl: true,
			maxTemperature: 295,
			changeTool: true,
			unloadLane: true,
		});
		expect(capabilities.parkToolhead).to.be.false;

		const withoutMacros = discoverToolheadCapabilities(
			objects.filter(object => !object.startsWith("gcode_macro")),
			settings,
		);
		expect(withoutMacros.tools[0]?.changeTool).to.be.false;
		expect(withoutMacros.tools[0]?.unloadLane).to.be.false;

		const faultyTool = discoverToolheadCapabilities(objects, {
			...settings,
			extruder2: { max_temp: 999, max_power: 0.000001 },
		});
		expect(faultyTool.tools[2]?.temperatureControl).to.be.false;
	});

	it("creates only fixed macro, temperature and extrusion commands", () => {
		expect(createToolheadCommand({ type: "changeTool", tool: 2 })).to.equal("CHANGE_TOOL LANE=E2");
		expect(createToolheadCommand({ type: "unloadLane", tool: 3 })).to.equal("LANE_UNLOAD LANE=E3");
		expect(createToolheadCommand({ type: "setTemperature", tool: 1 }, 215)).to.equal(
			"SET_HEATER_TEMPERATURE HEATER=extruder1 TARGET=215.0",
		);
		expect(
			createToolheadCommand({ type: "extrude", direction: -1 }, undefined, {
				distance: DEFAULT_EXTRUSION_DISTANCE_MM,
				speed: DEFAULT_EXTRUSION_SPEED_MM_PER_SECOND,
			}),
		).to.equal(
			[
				"SAVE_GCODE_STATE NAME=IOBROKER_EXTRUDE",
				"M83",
				"G1 E-1.000 F120",
				"M400",
				"RESTORE_GCODE_STATE NAME=IOBROKER_EXTRUDE",
			].join("\n"),
		);
	});

	it("requires idle PAXX12 operation, available macros and a fault-free AFC", () => {
		const capabilities = discoverToolheadCapabilities(objects, settings);
		expect(checkToolheadSafety({ type: "changeTool", tool: 0 }, safeStatus, "paxx12", capabilities).ok).to.be.true;
		expect(checkToolheadSafety({ type: "unloadLane", tool: 0 }, safeStatus, "original", capabilities).ok).to.be
			.false;
		expect(
			checkToolheadSafety(
				{ type: "changeTool", tool: 0 },
				{ ...safeStatus, AFC: { error_state: true } },
				"paxx12",
				capabilities,
			).ok,
		).to.be.false;
		expect(
			checkToolheadSafety(
				{ type: "changeTool", tool: 0 },
				{ ...safeStatus, print_stats: { state: "printing" } },
				"paxx12",
				capabilities,
			).ok,
		).to.be.false;
	});

	it("uses runtime temperature limits and requires Klipper to permit extrusion", () => {
		const capabilities = discoverToolheadCapabilities(objects, settings);
		expect(checkToolheadSafety({ type: "setTemperature", tool: 0 }, safeStatus, "paxx12", capabilities, 295).ok).to
			.be.true;
		expect(checkToolheadSafety({ type: "setTemperature", tool: 0 }, safeStatus, "paxx12", capabilities, 296).ok).to
			.be.false;
		expect(
			checkToolheadSafety({ type: "extrude", direction: 1 }, safeStatus, "paxx12", capabilities, undefined, {
				distance: 2,
				speed: 2,
			}).ok,
		).to.be.true;
		expect(
			checkToolheadSafety(
				{ type: "extrude", direction: 1 },
				{ ...safeStatus, extruder1: { temperature: 174, can_extrude: false } },
				"paxx12",
				capabilities,
				undefined,
				{ distance: 2, speed: 2 },
			).ok,
		).to.be.false;
	});

	it("rejects excessive and malformed manual extrusion settings", () => {
		for (const value of [0, 10.1, Number.NaN, Infinity, "1"]) {
			expect(validateExtrusionDistance(value)).to.be.false;
		}
		for (const value of [0, 10.1, Number.NaN, Infinity, "1"]) {
			expect(validateExtrusionSpeed(value)).to.be.false;
		}
	});
});
