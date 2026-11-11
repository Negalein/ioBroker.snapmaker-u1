"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMoonrakerBaseUrl = createMoonrakerBaseUrl;
exports.getPrinterInfo = getPrinterInfo;
exports.executeGcodeScript = executeGcodeScript;
/**
 * Builds a safe HTTP base URL from the adapter's Moonraker host and port fields.
 *
 * @param host
 * @param port
 */
function createMoonrakerBaseUrl(host, port) {
    const normalizedHost = host.trim();
    if (!normalizedHost || normalizedHost.includes("://") || normalizedHost.includes("/")) {
        throw new Error("Configure a hostname or IP address without a protocol or path");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("Configure a Moonraker port between 1 and 65535");
    }
    const urlHost = normalizedHost.includes(":") && !normalizedHost.startsWith("[") ? `[${normalizedHost}]` : normalizedHost;
    return new URL(`http://${urlHost}:${port}/`);
}
/**
 * Gets basic printer metadata without issuing any printer-control command.
 *
 * @param options
 */
async function getPrinterInfo(options) {
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
async function executeGcodeScript(options) {
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
function isMoonrakerResponse(value) {
    return typeof value === "object" && value !== null && "result" in value && isRecord(value.result);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getOptionalString(record, key) {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
}
//# sourceMappingURL=moonraker.js.map