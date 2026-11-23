"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivedStatusFields = exports.statusFields = void 0;
exports.readStatus = readStatus;
exports.mapStatus = mapStatus;
exports.discoverTelemetryObjects = discoverTelemetryObjects;
exports.mapDiscoveredTelemetry = mapDiscoveredTelemetry;
const node_crypto_1 = require("node:crypto");
const moonraker_1 = require("./moonraker");
exports.statusFields = [
    ["print_stats", "state", "job.state", "string", "text"],
    ["print_stats", "filename", "job.filename", "string", "text"],
    ["print_stats", "print_duration", "job.duration", "number", "value", "s"],
    ["print_stats", "total_duration", "job.totalDuration", "number", "value", "s"],
    ["print_stats", "message", "job.message", "string", "text"],
    ["print_stats", "filament_used", "job.filamentUsed", "number", "value", "mm"],
    ["display_status", "progress", "job.progress", "number", "value", "%"],
    ["display_status", "message", "job.displayMessage", "string", "text"],
    ["pause_resume", "is_paused", "job.paused", "boolean", "indicator"],
    ["virtual_sdcard", "progress", "job.fileProgress", "number", "value", "%"],
    ["virtual_sdcard", "file_position", "job.filePosition", "number", "value", "B"],
    ["toolhead", "extruder", "tools.active", "string", "text"],
    ["toolhead", "max_velocity", "motion.maxVelocity", "number", "value", "mm/s"],
    ["toolhead", "max_accel", "motion.maxAcceleration", "number", "value", "mm/s²"],
    ["toolhead", "print_time", "motion.printTime", "number", "value", "s"],
    ["gcode_move", "speed", "motion.commandedSpeed", "number", "value", "mm/s"],
    ["gcode_move", "speed_factor", "motion.speedFactor", "number", "value", "%"],
    ["gcode_move", "extrude_factor", "motion.flowFactor", "number", "value", "%"],
    ["heater_bed", "temperature", "bed.temperature", "number", "value.temperature", "°C"],
    ["heater_bed", "target", "bed.target", "number", "value.temperature", "°C"],
    ["heater_bed", "power", "bed.power", "number", "value", "%"],
    ["temperature_sensor cavity", "temperature", "chamber.temperature", "number", "value.temperature", "°C"],
    ["fan_generic circulation_fan", "speed", "cover.circulation.speed", "number", "value", "%"],
    ["fan_generic circulation_fan", "rpm", "cover.circulation.rpm", "number", "value", "rpm"],
    ["fan_generic exhaust_fan", "speed", "cover.exhaust.speed", "number", "value", "%"],
    ["fan_generic exhaust_fan", "rpm", "cover.exhaust.rpm", "number", "value", "rpm"],
];
exports.statusFields.push(["AFC", "current_lane", "afc.currentLane", "string", "text"], ["AFC", "error_state", "afc.error", "boolean", "indicator.error"], ["AFC", "spoolman", "afc.spoolmanEnabled", "boolean", "indicator"], ["spoolman", "spoolman_connected", "spoolman.connected", "boolean", "indicator.reachable"], ["spoolman", "spool_id", "spoolman.activeSpoolId", "number", "value"]);
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
    exports.statusFields.push([object, "temperature", `tools.tool${index}.temperature`, "number", "value.temperature", "°C"], [object, "target", `tools.tool${index}.target`, "number", "value.temperature", "°C"], [object, "state", `tools.tool${index}.status`, "string", "text"], [object, "power", `tools.tool${index}.power`, "number", "value", "%"], [object, "pressure_advance", `tools.tool${index}.pressureAdvance`, "number", "value"], [object, "smooth_time", `tools.tool${index}.smoothTime`, "number", "value", "s"]);
}
/** States derived from nested printer objects or G-code file metadata. */
exports.derivedStatusFields = [
    ["job.layer.current", "number", "value"],
    ["job.layer.total", "number", "value"],
    ["job.layer.progress", "number", "value", "%"],
    ["job.slicer", "string", "text"],
    ["job.slicerVersion", "string", "text"],
    ["job.slicerEstimatedDuration", "number", "value", "s"],
    ["job.slicerRemaining", "number", "value", "s"],
    ["job.remaining", "number", "value", "s"],
    ["job.estimatedEnd", "number", "value.time"],
    ["job.estimateAvailable", "boolean", "indicator"],
    ["job.lastCompletedFile", "string", "text"],
    ["info.klippyState", "string", "text"],
    ["info.ready", "boolean", "indicator.reachable"],
    ["info.lastError", "string", "text"],
];
/**
 * Retrieves read-only printer status.
 */
async function readStatus(host, port, timeoutMs, spoolmanEnabled = false, includeAfc = spoolmanEnabled, additionalObjects = []) {
    const url = new URL("printer/objects/query", (0, moonraker_1.createMoonrakerBaseUrl)(host, port));
    for (const object of new Set([...exports.statusFields.map(field => field[0]), ...additionalObjects])) {
        if (object === "spoolman" || (!includeAfc && object.startsWith("AFC"))) {
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
        try {
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
        catch {
            body.result.status.spoolman = { spoolman_connected: false };
        }
    }
    return body.result.status;
}
/**
 * Converts printer values into ioBroker state values.
 */
function mapStatus(status) {
    const values = {};
    const position = status.toolhead?.position;
    if (Array.isArray(position)) {
        for (const [axis, index] of [
            ["x", 0],
            ["y", 1],
            ["z", 2],
        ]) {
            const value = position[index];
            if (typeof value === "number" && Number.isFinite(value)) {
                values[`motion.position.${axis}`] = value;
            }
        }
    }
    const printInfo = getRecord(getRecord(status.print_stats)?.info);
    const currentLayer = getFiniteNumber(printInfo?.current_layer);
    const totalLayer = getFiniteNumber(printInfo?.total_layer);
    if (currentLayer !== undefined) {
        values["job.layer.current"] = currentLayer;
    }
    if (totalLayer !== undefined) {
        values["job.layer.total"] = totalLayer;
    }
    if (currentLayer !== undefined && totalLayer !== undefined && totalLayer > 0) {
        values["job.layer.progress"] = Math.max(0, Math.min(100, (currentLayer / totalLayer) * 100));
    }
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
                isPercentageState(id) && typeof value === "number" ? Math.max(0, Math.min(100, value * 100)) : value;
        }
    }
    return values;
}
/** Returns the currently loaded optional fan and temperature objects. */
function discoverTelemetryObjects(objects) {
    return [...new Set(objects.filter(isTelemetryObject))].sort();
}
/** Maps dynamically discovered fans and temperature sources into read-only ioBroker telemetry. */
function mapDiscoveredTelemetry(status, objects) {
    const telemetry = [];
    const usedObjectIds = new Set();
    for (const object of objects) {
        const values = getRecord(status[object]);
        if (!values) {
            continue;
        }
        const objectId = safeObjectId(object, usedObjectIds);
        const speed = getFiniteNumber(values.speed);
        if (speed !== undefined) {
            telemetry.push({
                id: `fans.${objectId}.speed`,
                name: `${object} speed`,
                type: "number",
                role: "value",
                unit: "%",
                value: Math.max(0, Math.min(100, speed * 100)),
            });
        }
        const rpm = getFiniteNumber(values.rpm);
        if (rpm !== undefined) {
            telemetry.push({
                id: `fans.${objectId}.rpm`,
                name: `${object} RPM`,
                type: "number",
                role: "value",
                unit: "rpm",
                value: rpm,
            });
        }
        const temperature = getFiniteNumber(values.temperature);
        if (temperature !== undefined) {
            telemetry.push({
                id: `sensors.${objectId}.temperature`,
                name: `${object} temperature`,
                type: "number",
                role: "value.temperature",
                unit: "°C",
                value: temperature,
            });
        }
    }
    return telemetry;
}
function isPercentageState(id) {
    return (id === "job.progress" ||
        id === "job.fileProgress" ||
        id === "job.layer.progress" ||
        id === "motion.speedFactor" ||
        id === "motion.flowFactor" ||
        id.endsWith(".speed") ||
        id.endsWith(".power"));
}
function isTelemetryObject(object) {
    return (object === "fan" ||
        object.startsWith("fan_generic ") ||
        object.startsWith("heater_fan ") ||
        object.startsWith("controller_fan ") ||
        object.startsWith("temperature_fan ") ||
        object.startsWith("temperature_sensor ") ||
        object.startsWith("heater_generic "));
}
function safeObjectId(object, usedObjectIds) {
    const normalized = object
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!usedObjectIds.has(normalized)) {
        usedObjectIds.add(normalized);
        return normalized;
    }
    const digest = (0, node_crypto_1.createHash)("sha256").update(object).digest("hex").slice(0, 12);
    const identifier = `${normalized}-${digest}`;
    usedObjectIds.add(identifier);
    return identifier;
}
function getRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function getFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
//# sourceMappingURL=status.js.map