import { createMoonrakerBaseUrl } from "./moonraker";

export const statusFields: Array<[string, string, string, ioBroker.CommonType, string, string?]> = [
	["print_stats", "state", "job.state", "string", "text"],
	["print_stats", "filename", "job.filename", "string", "text"],
	["print_stats", "print_duration", "job.duration", "number", "value", "s"],
	["print_stats", "filament_used", "job.filamentUsed", "number", "value", "mm"],
	["display_status", "progress", "job.progress", "number", "value", "%"],
	["pause_resume", "is_paused", "job.paused", "boolean", "indicator"],
	["toolhead", "extruder", "tools.active", "string", "text"],
	["heater_bed", "temperature", "bed.temperature", "number", "value.temperature", "°C"],
	["heater_bed", "target", "bed.target", "number", "value.temperature", "°C"],
	["temperature_sensor cavity", "temperature", "chamber.temperature", "number", "value.temperature", "°C"],
	["fan_generic circulation_fan", "speed", "cover.circulation.speed", "number", "value", "%"],
	["fan_generic circulation_fan", "rpm", "cover.circulation.rpm", "number", "value", "rpm"],
	["fan_generic exhaust_fan", "speed", "cover.exhaust.speed", "number", "value", "%"],
	["fan_generic exhaust_fan", "rpm", "cover.exhaust.rpm", "number", "value", "rpm"],
];
for (let index = 0; index < 4; index++) {
	const object = index === 0 ? "extruder" : `extruder${index}`;
	statusFields.push(
		[object, "temperature", `tools.tool${index}.temperature`, "number", "value.temperature", "°C"],
		[object, "target", `tools.tool${index}.target`, "number", "value.temperature", "°C"],
		[object, "state", `tools.tool${index}.status`, "string", "text"],
	);
}

/**
 * Retrieves read-only printer status.
 */
export async function readStatus(host: string, port: number, timeoutMs: number): Promise<Record<string, unknown>> {
	const url = new URL("printer/objects/query", createMoonrakerBaseUrl(host, port));
	for (const object of new Set(statusFields.map(field => field[0]))) {
		url.searchParams.set(object, "");
	}
	const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
	if (!response.ok) {
		throw new Error(`Status query returned HTTP ${response.status}`);
	}
	const body = (await response.json()) as {
		/**
		 * Moonraker result envelope.
		 */
		result?: {
			/**
			 * Requested printer objects.
			 */
			status?: Record<string, unknown>;
		};
	};
	if (!body.result?.status || typeof body.result.status !== "object") {
		throw new Error("Invalid printer status response");
	}
	return body.result.status;
}

/**
 * Converts printer values into ioBroker state values.
 */
export function mapStatus(status: Record<string, unknown>): Record<string, string | number | boolean> {
	const values: Record<string, string | number | boolean> = {};
	for (const [object, key, id, type] of statusFields) {
		const source = status[object];
		if (!source || typeof source !== "object") {
			continue;
		}
		const value = (source as Record<string, unknown>)[key];
		if (typeof value !== type || (typeof value === "number" && !Number.isFinite(value))) {
			continue;
		}
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			values[id] =
				(id === "job.progress" || id.endsWith(".speed")) && typeof value === "number"
					? Math.max(0, Math.min(100, value * 100))
					: value;
		}
	}
	return values;
}
