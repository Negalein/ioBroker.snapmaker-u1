"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRequest = mediaRequest;
exports.discoverCameras = discoverCameras;
exports.cameraObjectId = cameraObjectId;
exports.cameraUrl = cameraUrl;
exports.previewUrl = previewUrl;
const node_crypto_1 = require("node:crypto");
const moonraker_1 = require("./moonraker");
const DEFAULT_MEDIA_TIMEOUT_MS = 10_000;
async function mediaRequest(host, port, path, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) {
    const response = await fetch(new URL(path, (0, moonraker_1.createMoonrakerBaseUrl)(host, port)), {
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
        throw new Error(`Media request failed: HTTP ${response.status}`);
    }
    const body = (await response.json());
    if (!body.result) {
        throw new Error("Invalid Moonraker media response");
    }
    return body.result;
}
async function discoverCameras(host, port, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) {
    const result = await mediaRequest(host, port, "/server/webcams/list", timeoutMs);
    if (!Array.isArray(result.webcams)) {
        throw new Error("Invalid webcam list");
    }
    return result.webcams.filter((camera) => typeof camera === "object" &&
        camera !== null &&
        typeof camera.uid === "string" &&
        camera.uid.length > 0 &&
        typeof camera.name === "string");
}
/**
 * Builds a stable, namespace-safe camera object ID without case-only
 * collisions. Normal lower-case UUIDs retain their existing readable ID.
 *
 * @param uid Moonraker camera identifier.
 */
function cameraObjectId(uid) {
    const sanitized = uid.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (sanitized === uid && uid === uid.toLowerCase()) {
        return uid;
    }
    const digest = (0, node_crypto_1.createHash)("sha256").update(uid).digest("hex").slice(0, 12);
    return `${sanitized.toLowerCase()}-${digest}`;
}
function cameraUrl(value, host) {
    if (!value) {
        return "";
    }
    const url = new URL(value, `http://${host}/`);
    return ["http:", "https:", "rtsp:"].includes(url.protocol) ? url.toString() : "";
}
async function previewUrl(host, port, filename, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) {
    if (!filename) {
        return "";
    }
    const metadata = await mediaRequest(host, port, `/server/files/metadata?filename=${encodeURIComponent(filename)}`, timeoutMs);
    const thumbnails = metadata.thumbnails;
    const thumbnail = thumbnails
        ?.filter(t => typeof t.relative_path === "string")
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!thumbnail) {
        return "";
    }
    const directory = filename.includes("/") ? filename.slice(0, filename.lastIndexOf("/") + 1) : "";
    const path = (directory + thumbnail.relative_path).split("/").map(encodeURIComponent).join("/");
    return new URL(`/server/files/gcodes/${path}`, (0, moonraker_1.createMoonrakerBaseUrl)(host, port)).toString();
}
//# sourceMappingURL=media.js.map