/* eslint-disable @typescript-eslint/require-await -- Async adapter and HTTP mocks. */
import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import { spoolSlot, inWindow, validateSpoolman, SpoolmanService } from "./spoolman";
describe("Spoolman", () => {
	it("maps all four lanes and exact thresholds", () => {
		for (let i = 0; i < 4; i++) {
			for (const [weight, status] of [
				[300, "OK"],
				[299, "WARN"],
				[100, "WARN"],
				[99, "LEER"],
			] as const) {
				expect(
					spoolSlot(
						{ id: 7, remaining_weight: weight, filament: { name: "PLA", weight: 1000 } },
						i,
						300,
						100,
					),
				).to.include({ lane: `E${i}`, extruder: `T${i}`, status, initial_weight: 1000 });
			}
		}
	});
	it("rejects unknown weights instead of generating empty alarms", () => {
		for (const weight of [null, undefined, NaN, "0"]) {
			expect(() => spoolSlot({ id: 1, filament: {}, remaining_weight: weight }, 0, 300, 100)).to.throw();
		}
	});
	it("supports daytime, overnight and all-day windows", () => {
		const date = new Date(2026, 10, 23, 23);
		expect(inWindow(date, 22, 7)).to.equal(true);
		expect(inWindow(date, 7, 22)).to.equal(false);
		expect(inWindow(date, 0, 0)).to.equal(true);
	});
});

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});
const config = {
	spoolmanUrl: "http://localhost:7912/",
	spoolmanInterval: 5,
	spoolmanWarnLimit: 300,
	spoolmanEmptyLimit: 100,
	spoolmanWeekdayStart: 0,
	spoolmanWeekdayEnd: 0,
	spoolmanWeekendStart: 0,
	spoolmanWeekendEnd: 0,
	spoolmanAlarmInWindow: false,
	spoolmanTelegramEnabled: true,
	spoolmanTelegramInstance: "telegram.0",
	spoolmanTelegramUser: "tester",
	spoolmanLegacyMirror: false,
};
function harness(): {
	states: Map<string, unknown>;
	messages: unknown[];
	adapter: ioBroker.Adapter;
	service: SpoolmanService;
} {
	const states = new Map<string, unknown>();
	const messages: unknown[] = [];
	const adapter = {
		config: { ...config },
		log: { debug: () => undefined },
		setObjectNotExistsAsync: async () => undefined,
		setForeignObjectNotExistsAsync: async () => undefined,
		setStateChangedAsync: async (id: string, v: unknown) => {
			states.set(id, v);
		},
		setForeignStateChangedAsync: async (id: string, v: unknown) => {
			states.set(id, v);
		},
		getStateAsync: async (id: string) => ({ val: states.get(id) }),
		sendToAsync: async (...args: unknown[]) => {
			messages.push(args);
		},
	};
	return {
		states,
		messages,
		adapter: adapter as unknown as ioBroker.Adapter,
		service: new SpoolmanService(adapter as unknown as ioBroker.Adapter),
	};
}
function snapshot(ids: unknown[] = [1, 2, 3, 4], printing = true): Record<string, unknown> {
	return Object.fromEntries([
		["print_stats", { state: printing ? "printing" : "standby" }],
		...ids.map((spool_id, i) => [`AFC_lane E${i}`, { spool_id }]),
	]);
}
async function settle(): Promise<void> {
	for (let i = 0; i < 100; i++) {
		await new Promise<void>(resolve => setImmediate(resolve));
	}
}
function mockApi(weight = 250): void {
	globalThis.fetch = async input =>
		new Response(
			JSON.stringify({
				id: Number(
					(input instanceof URL ? input.href : typeof input === "string" ? input : input.url)
						.split("/")
						.pop(),
				),
				remaining_weight: weight,
				filament: { name: "PLA", material: "PLA" },
			}),
			{ status: 200 },
		);
}
describe("Spoolman service integration", () => {
	it("reads four lanes, warns once, restores notification latches after restart", async () => {
		mockApi();
		const h = harness();
		h.service.request(snapshot());
		await settle();
		expect(h.messages).to.have.length(4);
		expect(h.states.get("spoolman.aktiv.4.lane")).to.equal("E3");
		h.service.request(snapshot());
		await settle();
		expect(h.messages).to.have.length(4);
		h.service.stop();
		const restarted = new SpoolmanService(h.adapter);
		restarted.request(snapshot());
		await settle();
		expect(h.messages).to.have.length(4);
		restarted.stop();
	});
	it("rearms a replacement, clears unloaded lanes, and isolates API failures", async () => {
		mockApi();
		const h = harness();
		h.service.request(snapshot());
		await settle();
		h.service.request(snapshot([5, 0, 3, 4]));
		await settle();
		expect(h.messages).to.have.length(5);
		expect(h.states.get("spoolman.aktiv.2.active")).to.equal(false);
		globalThis.fetch = async () => new Response("", { status: 500 });
		h.service.request(snapshot([6, 0, 3, 4]));
		await settle();
		expect(h.states.get("spoolman.apiConnected")).to.equal(false);
		expect(h.states.get("spoolman.aktiv.1.spool_id")).to.equal(5);
		h.service.stop();
	});
	it("defers notifications while idle and evaluates them from cached weights on print start", async () => {
		mockApi(50);
		const h = harness();
		h.service.request(snapshot(undefined, false));
		await settle();
		expect(h.messages).to.have.length(0);
		h.service.request(snapshot());
		await settle();
		expect(h.messages).to.have.length(4);
		expect(h.states.get("spoolman.aktiv.1.alarm")).to.equal(true);
		h.service.stop();
	});
	it("does not mirror by default and mirrors exact legacy paths when selected", async () => {
		mockApi(500);
		const h = harness();
		h.service.request(snapshot());
		await settle();
		expect([...h.states.keys()].some(id => id.startsWith("0_userdata"))).to.equal(false);
		h.adapter.config.spoolmanLegacyMirror = true;
		h.service.request(snapshot());
		await settle();
		expect(h.states.get("0_userdata.0.3DDrucker.Spoolman.aktiv.1.remaining_weight")).to.equal(500);
		h.service.stop();
	});
	it("drops outdated responses and stops without publishing late HTTP results", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		globalThis.fetch = async input => {
			await new Promise<void>(resolve => {
				release = resolve;
			});
			return new Response(
				JSON.stringify({
					id: Number(
						(input instanceof URL ? input.href : typeof input === "string" ? input : input.url)
							.split("/")
							.pop(),
					),
					remaining_weight: 500,
					filament: {},
				}),
			);
		};
		h.service.request(snapshot([1, 0, 0, 0]));
		await settle();
		h.service.stop();
		release();
		await settle();
		expect(h.states.has("spoolman.aktiv.1.spool_id")).to.equal(false);
	});
});

describe("Spoolman safeguards", () => {
	it("rejects invalid endpoints, thresholds and windows", () => {
		for (const change of [
			{ spoolmanUrl: "file:///tmp/db" },
			{ spoolmanUrl: "http://user:pass@host" },
			{ spoolmanEmptyLimit: 400 },
			{ spoolmanInterval: 0 },
			{ spoolmanWeekdayStart: 25 },
		]) {
			expect(() => validateSpoolman({ ...config, ...change } as ioBroker.AdapterConfig)).to.throw();
		}
	});
	it("keeps critical alarms outside windows unless explicitly restricted", async () => {
		mockApi(50);
		const h = harness();
		const hour = new Date().getHours();
		Object.assign(h.adapter.config, {
			spoolmanWeekdayStart: (hour + 2) % 24,
			spoolmanWeekdayEnd: (hour + 3) % 24,
			spoolmanWeekendStart: (hour + 2) % 24,
			spoolmanWeekendEnd: (hour + 3) % 24,
		});
		h.service.request(snapshot());
		await settle();
		expect(h.messages).to.have.length(4);
		h.service.stop();
		const restricted = harness();
		Object.assign(restricted.adapter.config, h.adapter.config, { spoolmanAlarmInWindow: true });
		restricted.service.request(snapshot());
		await settle();
		expect(restricted.messages).to.have.length(0);
		restricted.service.stop();
	});
	it("replaces obsolete in-flight lane assignments without publishing stale IDs", async () => {
		const h = harness();
		let release: () => void = () => undefined;
		let first = true;
		const seen: unknown[] = [];
		globalThis.fetch = async input => {
			if (first) {
				first = false;
				await new Promise<void>(resolve => {
					release = resolve;
				});
			}
			return new Response(
				JSON.stringify({
					id: Number(
						(input instanceof URL ? input.href : typeof input === "string" ? input : input.url)
							.split("/")
							.pop(),
					),
					remaining_weight: 500,
					filament: {},
				}),
			);
		};
		h.service.request(snapshot([1, 0, 0, 0]));
		await settle();
		h.service.request(snapshot([2, 0, 0, 0]));
		const original = h.adapter.setStateChangedAsync.bind(h.adapter);
		h.adapter.setStateChangedAsync = (id: string, value: unknown) => {
			if (id === "spoolman.aktiv.1.spool_id") {
				seen.push(value);
			}
			return original(id, value as ioBroker.StateValue, true);
		};
		release();
		await settle();
		expect(seen).to.deep.equal([2]);
		h.service.stop();
	});
});
