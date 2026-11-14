import { expect } from "chai";
import { describe, it } from "mocha";
import { calculatePrintEstimate } from "./print-estimate";

describe("print estimate", () => {
	it("prefers the live progress forecast and derives the finish timestamp", () => {
		expect(
			calculatePrintEstimate({
				printState: "printing",
				printDuration: 600,
				progressPercent: 50,
				slicerEstimatedDuration: 1_500,
				now: 1_000,
			}),
		).to.deep.equal({ slicerRemaining: 900, remaining: 600, estimatedEnd: 601_000 });
	});

	it("uses the slicer estimate before a usable file-progress value is available", () => {
		expect(
			calculatePrintEstimate({
				printState: "printing",
				printDuration: 120,
				progressPercent: 0,
				slicerEstimatedDuration: 600,
				now: 1_000,
			}),
		).to.deep.equal({ slicerRemaining: 480, remaining: 480, estimatedEnd: 481_000 });
	});

	it("does not publish a forecast while the printer is idle", () => {
		expect(
			calculatePrintEstimate({
				printState: "complete",
				printDuration: 600,
				progressPercent: 75,
				slicerEstimatedDuration: 800,
			}),
		).to.deep.equal({});
	});
});
