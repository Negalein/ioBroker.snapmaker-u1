import { expect } from "chai";
import { describe, it } from "mocha";
import { cameraObjectId, cameraUrl, previewUrlFromMetadata } from "./media";

describe("camera helpers", () => {
	it("keeps conventional lower-case UUIDs readable", () => {
		const uid = "b5794100-5505-4541-8ceb-f3b6f84dca5e";
		expect(cameraObjectId(uid)).to.equal(uid);
	});

	it("prevents case-only and unsafe-ID collisions", () => {
		expect(cameraObjectId("Camera A")).to.not.equal(cameraObjectId("camera a"));
		expect(cameraObjectId("Camera A")).to.match(/^[a-z0-9_-]+$/);
	});

	it("permits only camera URL protocols", () => {
		expect(cameraUrl("/webcam/?action=stream", "printer.local")).to.equal(
			"http://printer.local/webcam/?action=stream",
		);
		expect(cameraUrl("javascript:alert(1)", "printer.local")).to.equal("");
	});

	it("uses already fetched G-code metadata for the largest print preview", () => {
		expect(
			previewUrlFromMetadata(
				{
					estimatedTime: 900,
					slicer: "OrcaSlicer",
					thumbnails: [
						{ width: 32, height: 32, relativePath: ".thumbs/small.png" },
						{ width: 400, height: 300, relativePath: ".thumbs/large image.png" },
					],
				},
				"printer.local",
				7125,
				"folder/cube.gcode",
			),
		).to.equal("http://printer.local:7125/server/files/gcodes/folder/.thumbs/large%20image.png");
	});
});
