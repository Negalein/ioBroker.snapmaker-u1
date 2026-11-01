"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusFields = void 0;
exports.readStatus = readStatus;
exports.mapStatus = mapStatus;
const moonraker_1 = require("./moonraker");
exports.statusFields = [
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
exports.statusFields.push(["AFC", "current_lane", "afc.currentLane", "string", "text"], ["AFC", "error_state", "afc.error", "boolean", "indicator.error"], ["AFC", "spoolman", "afc.spoolmanEnabled", "boolean", "indicator"], ["spoolman", "spoolman_connected", "spoolman.connected", "boolean", "indicator.connected"], ["spoolman", "spool_id", "spoolman.activeSpoolId", "number", "value"]);
for (let lane = 0; lane < 4; lane++) {
    for (const [key, type] of [
        ["material", "string"],
        ["filament_name", "string"],
        ["color", "string"],
        ["spool_id", "number"],
        ["tool_loaded", "boolean"],
        ["status", "string"],
    ]) {
        exports.statusFields.push([
            `AFC_lane E${lane}`,
            key,
            `afc.lane${lane}.${key}`,
            type,
            type === "boolean" ? "indicator" : type === "number" ? "value" : "text",
        ]);
    }
}
for (let index = 0; index < 4; index++) {
    const object = index === 0 ? "extruder" : `extruder${index}`;
    exports.statusFields.push([object, "temperature", `tools.tool${index}.temperature`, "number", "value.temperature", "°C"], [object, "target", `tools.tool${index}.target`, "number", "value.temperature", "°C"], [object, "state", `tools.tool${index}.status`, "string", "text"]);
}
/**
 * Retrieves read-only printer status.
 */
async function readStatus(host, port, timeoutMs, spoolmanEnabled = false) {
    const url = new URL("printer/objects/query", (0, moonraker_1.createMoonrakerBaseUrl)(host, port));
    for (const object of new Set(exports.statusFields.map(field => field[0]))) {
        if (object === "spoolman" || (!spoolmanEnabled && object.startsWith("AFC"))) {
            continue;
        }
        url.searchParams.set(object, "");
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
        throw new Error(`Status query returned HTTP ${response.status}`);
    }
    const body = (await response.json());
    if (!body.result?.status || typeof body.result.status !== "object") {
        throw new Error("Invalid printer status response");
    }
    if (spoolmanEnabled) {
        const spoolResponse = await fetch(new URL("/server/spoolman/status", url), {
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (spoolResponse.ok) {
            const spoolBody = (await spoolResponse.json());
            if (spoolBody.result) {
                body.result.status.spoolman = spoolBody.result;
            }
        }
    }
    return body.result.status;
}
/**
 * Converts printer values into ioBroker state values.
 */
function mapStatus(status) {
    const values = {};
    for (const [object, key, id, type] of exports.statusFields) {
        const source = status[object];
        if (!source || typeof source !== "object") {
            continue;
        }
        const value = source[key];
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
//# sourceMappingURL=status.js.map