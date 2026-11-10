import { expect } from "chai";
import { describe, it } from "mocha";
import { createMoonrakerBaseUrl, executeGcodeScript, getPrinterInfo } from "./moonraker";

describe("Moonraker client", () => {
	it("creates a URL for an IPv4 host", () => {
		expect(createMoonrakerBaseUrl("192.168.1.50", 7125).toString()).to.equal("http://192.168.1.50:7125/");
	});

	it("creates a URL for an IPv6 host", () => {
		expect(createMoonrakerBaseUrl("fd00::50", 7125).toString()).to.equal("http://[fd00::50]:7125/");
	});

	it("rejects a host with a protocol or path", () => {
		expect(() => createMoonrakerBaseUrl("http://printer.local/api", 7125)).to.throw(
			"Configure a hostname or IP address",
		);
	});

	it("reads the documented printer information response", async () => {
		let requestedUrl = "";
		const info = await getPrinterInfo({
			host: "printer.local",
			port: 7125,
			timeoutMs: 1_000,
			fetcher: url => {
				requestedUrl = url;
				return Promise.resolve({
					ok: true,
					status: 200,
					statusText: "OK",
					json: () =>
						Promise.resolve({
							result: {
								hostname: "snapmaker-u1",
								software_version: "v1.0.0",
								state: "ready",
								state_message: "Printer is ready",
							},
						}),
				});
			},
		});

		expect(requestedUrl).to.equal("http://printer.local:7125/printer/info");
		expect(info).to.deep.equal({
			hostname: "snapmaker-u1",
			softwareVersion: "v1.0.0",
			state: "ready",
			stateMessage: "Printer is ready",
		});
	});

	it("posts generated G-code scripts to Moonraker's documented endpoint", async () => {
		let requestedUrl = "";
		let requestMethod = "";
		let requestBody = "";
		await executeGcodeScript({
			host: "printer.local",
			port: 7125,
			timeoutMs: 1_000,
			script: "G28",
			fetcher: (url, options) => {
				requestedUrl = url;
				requestMethod = options.method ?? "";
				requestBody = options.body ?? "";
				return Promise.resolve({
					ok: true,
					status: 200,
					statusText: "OK",
					json: () => Promise.resolve({ result: "ok" }),
				});
			},
		});

		expect(requestedUrl).to.equal("http://printer.local:7125/printer/gcode/script");
		expect(requestMethod).to.equal("POST");
		expect(requestBody).to.equal('{"script":"G28"}');
	});

	it("rejects malformed scripts and Moonraker errors", async () => {
		try {
			await executeGcodeScript({ host: "printer.local", port: 7125, timeoutMs: 1_000, script: " " });
			expect.fail("Expected an empty script to be rejected");
		} catch (error) {
			expect((error as Error).message).to.contain("non-empty text");
		}
		try {
			await executeGcodeScript({
				host: "printer.local",
				port: 7125,
				timeoutMs: 1_000,
				script: "G28",
				fetcher: () =>
					Promise.resolve({
						ok: true,
						status: 200,
						statusText: "OK",
						json: () => Promise.resolve({ error: { message: "not allowed" } }),
					}),
			});
			expect.fail("Expected a Moonraker error to be rejected");
		} catch (error) {
			expect((error as Error).message).to.contain("rejected");
		}
	});
});
