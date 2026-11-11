import { expect } from "chai";
import { describe, it } from "mocha";
import { mapStatus } from "./status";

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
});
