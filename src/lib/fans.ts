import { createMoonrakerBaseUrl } from "./moonraker";

export const fanNames: Record<string, string> = {
	"printer.cover.circulation.speed": "circulation_fan",
	"printer.cover.exhaust.speed": "exhaust_fan",
};

export function fanCommand(id: string, percent: unknown): string {
	const fan = fanNames[id];
	if (!fan || typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100) {
		throw new Error("Fan speed must be a number between 0 and 100");
	}
	return `SET_FAN_SPEED FAN=${fan} SPEED=${percent / 100}`;
}

export async function setFanSpeed(host: string, port: number, id: string, percent: unknown): Promise<void> {
	const script = fanCommand(id, percent);
	const response = await fetch(new URL("printer/gcode/script", createMoonrakerBaseUrl(host, port)), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ script }),
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) {
		throw new Error(`Fan command failed: HTTP ${response.status}`);
	}
	const result = (await response.json()) as { error?: unknown };
	if (result.error) {
		throw new Error("Moonraker rejected the fan command");
	}
}
