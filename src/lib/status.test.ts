import { expect } from "chai";
import { describe, it } from "mocha";
import {
	derivedStatusFields,
	discoverTelemetryObjects,
	mapDiscoveredTelemetry,
	mapStatus,
	statusFields,
} from "./status";

describe("printer status mapping", () => {
	it("publishes finite toolhead coordinates as X, Y and Z position states", () => {
		const values = mapStatus({
			toolhead: { position: [12.5, 34.25, 6.75, 0], extruder: "extruder" },
		});
		expect(values).to.include({
			"motion.position.x": 12.5,
			"motion.position.y": 34.25,
			"motion.position.z": 6.75,
			"tools.active": "extruder",
		});
	});

	it("skips incomplete or non-finite individual coordinates", () => {
		const values = mapStatus({ toolhead: { position: [0, Number.NaN] } });
		expect(values).to.have.property("motion.position.x", 0);
		expect(values).to.not.have.property("motion.position.y");
		expect(values).to.not.have.property("motion.position.z");
	});

	it("maps the additional print, layer and motion telemetry from the U1 status", () => {
		const values = mapStatus({
			print_stats: {
				state: "printing",
				total_duration: 640,
				message: "Printing",
				info: { current_layer: 57, total_layer: 150 },
			},
			display_status: { progress: 0.56, message: "Layer 57" },
			virtual_sdcard: { progress: 0.5, file_position: 4_096 },
			gcode_move: { speed_factor: 1.1, extrude_factor: 0.95, speed: 120 },
			toolhead: { max_velocity: 300, max_accel: 10_000 },
			heater_bed: { power: 0.25 },
			extruder: { power: 0.5, pressure_advance: 0.04, smooth_time: 0.02 },
		});
		expect(values).to.include({
			"job.totalDuration": 640,
			"job.message": "Printing",
			"job.displayMessage": "Layer 57",
			"job.fileProgress": 50,
			"job.filePosition": 4_096,
			"job.layer.current": 57,
			"job.layer.total": 150,
			"job.layer.progress": 38,
			"motion.speedFactor": 100,
			"motion.flowFactor": 95,
			"motion.commandedSpeed": 120,
			"motion.maxVelocity": 300,
			"motion.maxAcceleration": 10_000,
			"bed.power": 25,
			"tools.tool0.power": 50,
			"tools.tool0.pressureAdvance": 0.04,
			"tools.tool0.smoothTime": 0.02,
		});
		expect(values["job.progress"]).to.be.closeTo(56, 0.000_001);
	});

	it("uses generic roles for printer telemetry without a dedicated ioBroker role", () => {
		for (const id of ["motion.maxVelocity", "motion.commandedSpeed"]) {
			const field = statusFields.find(([, , fieldId]) => fieldId === id);
			expect(field?.[4]).to.equal("value");
		}
		const maxAcceleration = statusFields.find(([, , id]) => id === "motion.maxAcceleration");
		expect(maxAcceleration?.[4]).to.equal("value");
		const spoolmanConnected = statusFields.find(([, , id]) => id === "spoolman.connected");
		expect(spoolmanConnected?.[4]).to.equal("indicator.reachable");
		const ready = derivedStatusFields.find(([id]) => id === "info.ready");
		expect(ready?.[2]).to.equal("indicator.reachable");
	});

	it("discovers and maps optional fans and temperature sources as read-only telemetry", () => {
		const objects = discoverTelemetryObjects([
			"fan_generic e1_fan",
			"heater_fan e0_nozzle_fan",
			"temperature_sensor cavity",
			"gcode_macro PRINT_START",
		]);
		expect(objects).to.deep.equal(["fan_generic e1_fan", "heater_fan e0_nozzle_fan", "temperature_sensor cavity"]);
		expect(
			mapDiscoveredTelemetry(
				{
					"fan_generic e1_fan": { speed: 0.5, rpm: 4_200 },
					"heater_fan e0_nozzle_fan": { speed: 1 },
					"temperature_sensor cavity": { temperature: 38.5 },
				},
				objects,
			),
		).to.deep.include.members([
			{
				id: "fans.fan_generic_e1_fan.speed",
				name: "fan_generic e1_fan speed",
				type: "number",
				role: "value",
				unit: "%",
				value: 50,
			},
			{
				id: "fans.fan_generic_e1_fan.rpm",
				name: "fan_generic e1_fan RPM",
				type: "number",
				role: "value",
				unit: "rpm",
				value: 4_200,
			},
			{
				id: "sensors.temperature_sensor_cavity.temperature",
				name: "temperature_sensor cavity temperature",
				type: "number",
				role: "value.temperature",
				unit: "°C",
				value: 38.5,
			},
		]);
	});
	it("keeps dynamically discovered telemetry distinct when labels normalize to the same ID", () => {
		const telemetry = mapDiscoveredTelemetry(
			{
				"fan_generic Front Fan": { speed: 0.5 },
				"fan_generic front_fan": { speed: 1 },
			},
			["fan_generic Front Fan", "fan_generic front_fan"],
		);

		const ids = telemetry.map(entry => entry.id);
		expect(ids).to.include("fans.fan_generic_front_fan.speed");
		expect(ids).to.have.length(2);
		expect(new Set(ids).size).to.equal(ids.length);
	});
});
