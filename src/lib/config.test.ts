import { expect } from "chai";
import { describe, it } from "mocha";
import { MAX_TIMEOUT_MS, pollIntervalMs, requestTimeoutMs } from "./config";

describe("runtime duration validation", () => {
	it("uses documented defaults for non-finite values", () => {
		expect(requestTimeoutMs(undefined)).to.equal(10_000);
		expect(requestTimeoutMs(Number.POSITIVE_INFINITY)).to.equal(10_000);
		expect(pollIntervalMs("30")).to.equal(30_000);
	});

	it("clamps configured durations to positive values and the Node timer limit", () => {
		expect(requestTimeoutMs(0)).to.equal(1_000);
		expect(pollIntervalMs(-1)).to.equal(5_000);
		expect(requestTimeoutMs(MAX_TIMEOUT_MS / 1_000 + 1)).to.equal(MAX_TIMEOUT_MS);
		expect(pollIntervalMs(MAX_TIMEOUT_MS / 1_000 + 1)).to.equal(MAX_TIMEOUT_MS);
	});
});
