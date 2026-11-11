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

interface PrinterObjectsResponse {
	result: {
		objects?: unknown;
	};
}

interface PrinterConfigurationResponse {
	result: {
		status?: {
			configfile?: {
				settings?: unknown;
			};
		};
	};
}

interface FetchResponse {
	ok: boolean;
	status: number;
	statusText: string;
	json(): Promise<unknown>;
}

interface FetchRequestOptions {
	headers: Record<string, string>;
	signal: AbortSignal;
	method?: "POST";
	body?: string;
}

type FetchImplementation = (url: string, options: FetchRequestOptions) => Promise<FetchResponse>;

export interface GetPrinterInfoOptions {
	host: string;
	port: number;
	timeoutMs: number;
	fetcher?: FetchImplementation;
}

export interface ExecuteGcodeScriptOptions {
	host: string;
	port: number;
	timeoutMs: number;
	script: string;
	fetcher?: FetchImplementation;
}

export interface GetPrinterObjectsOptions {
	host: string;
	port: number;
	timeoutMs: number;
	fetcher?: FetchImplementation;
}

export type GetPrinterConfigurationOptions = GetPrinterObjectsOptions;

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

/**
 * Executes a pre-validated G-code script through Moonraker's documented endpoint.
 * The caller owns command validation; this method only transports a generated script.
 *
 * @param options Moonraker connection and the generated G-code script.
 */
export async function executeGcodeScript(options: ExecuteGcodeScriptOptions): Promise<void> {
	if (typeof options.script !== "string" || !options.script.trim() || options.script.includes("\0")) {
		throw new Error("G-code script must be a non-empty text value");
	}
	const baseUrl = createMoonrakerBaseUrl(options.host, options.port);
	const endpoint = new URL("printer/gcode/script", baseUrl).toString();
	const fetcher = options.fetcher ?? ((url, requestOptions) => fetch(url, requestOptions));
	const response = await fetcher(endpoint, {
		method: "POST",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify({ script: options.script }),
		signal: AbortSignal.timeout(options.timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`Moonraker returned HTTP ${response.status} ${response.statusText}`.trim());
	}
	const payload = await response.json();
	if (isRecord(payload) && "error" in payload) {
		throw new Error("Moonraker rejected the G-code command");
	}
}

/**
 * Lists the Klipper objects currently loaded by Moonraker. The list is used as
 * a capability check before the adapter offers an optional U1 feature.
 */
export async function getPrinterObjects(options: GetPrinterObjectsOptions): Promise<string[]> {
	const baseUrl = createMoonrakerBaseUrl(options.host, options.port);
	const endpoint = new URL("printer/objects/list", baseUrl).toString();
	const fetcher = options.fetcher ?? ((url, requestOptions) => fetch(url, requestOptions));
	const response = await fetcher(endpoint, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(options.timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`Moonraker object list returned HTTP ${response.status} ${response.statusText}`.trim());
	}
	const payload = await response.json();
	if (!isPrinterObjectsResponse(payload) || !Array.isArray(payload.result.objects)) {
		throw new Error("Moonraker returned an unexpected printer-object list");
	}
	return payload.result.objects.filter((value): value is string => typeof value === "string");
}

/**
 * Reads Klipper's parsed configuration so temperature limits are taken from
 * the connected printer rather than guessed by the adapter.
 */
export async function getPrinterConfiguration(
	options: GetPrinterConfigurationOptions,
): Promise<Record<string, Record<string, unknown>>> {
	const baseUrl = createMoonrakerBaseUrl(options.host, options.port);
	const endpoint = new URL("printer/objects/query?configfile", baseUrl).toString();
	const fetcher = options.fetcher ?? ((url, requestOptions) => fetch(url, requestOptions));
	const response = await fetcher(endpoint, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(options.timeoutMs),
	});
	if (!response.ok) {
		throw new Error(`Moonraker configuration query returned HTTP ${response.status} ${response.statusText}`.trim());
	}
	const payload = await response.json();
	if (!isPrinterConfigurationResponse(payload)) {
		throw new Error("Moonraker returned an unexpected printer configuration");
	}
	const settings = payload.result.status?.configfile?.settings;
	if (!isRecord(settings)) {
		return {};
	}
	const configuration: Record<string, Record<string, unknown>> = {};
	for (const [section, value] of Object.entries(settings)) {
		if (isRecord(value)) {
			configuration[section] = value;
		}
	}
	return configuration;
}

function isMoonrakerResponse(value: unknown): value is MoonrakerResponse {
	return typeof value === "object" && value !== null && "result" in value && isRecord(value.result);
}

function isPrinterObjectsResponse(value: unknown): value is PrinterObjectsResponse {
	return isRecord(value) && isRecord(value.result);
}

function isPrinterConfigurationResponse(value: unknown): value is PrinterConfigurationResponse {
	return isRecord(value) && isRecord(value.result);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}
