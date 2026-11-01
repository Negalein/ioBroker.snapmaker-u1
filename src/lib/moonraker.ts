/** Data returned by Moonraker's `printer/info` endpoint. */
export interface PrinterInfo {
	hostname?: string;
	softwareVersion?: string;
	state?: string;
	stateMessage?: string;
}

interface MoonrakerResponse {
	result: Record<string, unknown>;
}

interface FetchResponse {
	ok: boolean;
	status: number;
	statusText: string;
	json(): Promise<unknown>;
}

type FetchImplementation = (
	url: string,
	options: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<FetchResponse>;

export interface GetPrinterInfoOptions {
	host: string;
	port: number;
	timeoutMs: number;
	fetcher?: FetchImplementation;
}

/**
 * Builds a safe HTTP base URL from the adapter's Moonraker host and port fields.
 *
 * @param host
 * @param port
 */
export function createMoonrakerBaseUrl(host: string, port: number): URL {
	const normalizedHost = host.trim();
	if (!normalizedHost || normalizedHost.includes("://") || normalizedHost.includes("/")) {
		throw new Error("Configure a hostname or IP address without a protocol or path");
	}
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error("Configure a Moonraker port between 1 and 65535");
	}

	const urlHost =
		normalizedHost.includes(":") && !normalizedHost.startsWith("[") ? `[${normalizedHost}]` : normalizedHost;
	return new URL(`http://${urlHost}:${port}/`);
}

/**
 * Gets basic printer metadata without issuing any printer-control command.
 *
 * @param options
 */
export async function getPrinterInfo(options: GetPrinterInfoOptions): Promise<PrinterInfo> {
	const baseUrl = createMoonrakerBaseUrl(options.host, options.port);
	const endpoint = new URL("printer/info", baseUrl).toString();
	const fetcher = options.fetcher ?? ((url, requestOptions) => fetch(url, requestOptions));
	const response = await fetcher(endpoint, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(options.timeoutMs),
	});

	if (!response.ok) {
		throw new Error(`Moonraker returned HTTP ${response.status} ${response.statusText}`.trim());
	}

	const payload = await response.json();
	if (!isMoonrakerResponse(payload)) {
		throw new Error("Moonraker returned an unexpected printer-info response");
	}

	return {
		hostname: getOptionalString(payload.result, "hostname"),
		softwareVersion: getOptionalString(payload.result, "software_version"),
		state: getOptionalString(payload.result, "state"),
		stateMessage: getOptionalString(payload.result, "state_message"),
	};
}

function isMoonrakerResponse(value: unknown): value is MoonrakerResponse {
	return typeof value === "object" && value !== null && "result" in value && isRecord(value.result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}
