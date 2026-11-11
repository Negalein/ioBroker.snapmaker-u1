/** Largest delay accepted by Node.js timers and AbortSignal.timeout. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

const DEFAULT_REQUEST_TIMEOUT_SECONDS = 10;
const DEFAULT_POLL_INTERVAL_SECONDS = 30;

/**
 * Converts a configured duration to a safe timer value. Invalid values fall
 * back to the documented default; finite values are clamped to the supported range.
 *
 * @param value Configured duration in seconds.
 * @param fallbackSeconds Default duration in seconds.
 * @param minimumSeconds Minimum supported duration in seconds.
 */
function secondsToMilliseconds(value: unknown, fallbackSeconds: number, minimumSeconds: number): number {
	const maximumSeconds = MAX_TIMEOUT_MS / 1_000;
	const seconds = typeof value === "number" && Number.isFinite(value) ? value : fallbackSeconds;
	return Math.round(Math.min(Math.max(seconds, minimumSeconds), maximumSeconds) * 1_000);
}

/**
 * Returns a validated Moonraker request timeout.
 *
 * @param value Configured request duration in seconds.
 */
export function requestTimeoutMs(value: unknown): number {
	return secondsToMilliseconds(value, DEFAULT_REQUEST_TIMEOUT_SECONDS, 1);
}

/**
 * Returns a validated polling interval without exceeding Node's timer limit.
 *
 * @param value Configured polling duration in seconds.
 */
export function pollIntervalMs(value: unknown): number {
	return secondsToMilliseconds(value, DEFAULT_POLL_INTERVAL_SECONDS, 5);
}
