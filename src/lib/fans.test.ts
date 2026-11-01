import { expect } from "chai";
import { describe, it } from "mocha";
import { fanCommand } from "./fans";

describe("fan commands", () => {
	it("converts percentages to the exact permitted fan command", () => {
		expect(fanCommand("printer.cover.exhaust.speed", 35)).to.equal("SET_FAN_SPEED FAN=exhaust_fan SPEED=0.35");
	});
	it("rejects invalid values and arbitrary fan names", () => {
		for (const value of [-1, 101, NaN, Infinity, "50", null]) {
			expect(() => fanCommand("printer.cover.circulation.speed", value)).to.throw();
		}
		expect(() => fanCommand("other", 50)).to.throw();
	});
});
