import { expect } from "chai";
import { describe, it } from "mocha";
import { getHelpResponse } from "./help";

describe("help message", () => {
	it("describes the read-only camera discovery message", () => {
		const response = getHelpResponse();

		expect(response.help).to.contain("discoverCameras");
		expect(response.commands).to.deep.equal([{ command: "discoverCameras", write: false }]);
	});
});
