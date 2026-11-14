"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRequest = mediaRequest;
exports.discoverCameras = discoverCameras;
exports.cameraObjectId = cameraObjectId;
exports.cameraUrl = cameraUrl;
exports.getGcodeFileMetadata = getGcodeFileMetadata;
exports.previewUrlFromMetadata = previewUrlFromMetadata;
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
/** Retrieves the subset of Moonraker G-code metadata used by the adapter. */
async function getGcodeFileMetadata(host, port, filename, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) {
    if (!filename) {
        return undefined;
    }
    const metadata = await mediaRequest(host, port, `/server/files/metadata?filename=${encodeURIComponent(filename)}`, timeoutMs);
    const estimatedTime = metadata.estimated_time;
    const slicer = metadata.slicer;
    const slicerVersion = metadata.slicer_version;
    const thumbnails = Array.isArray(metadata.thumbnails)
        ? metadata.thumbnails.flatMap(value => {
            if (typeof value !== "object" || value === null || Array.isArray(value)) {
                return [];
            }
            const thumbnail = value;
            return typeof thumbnail.width === "number" &&
                typeof thumbnail.height === "number" &&
                typeof thumbnail.relative_path === "string"
                ? [{ width: thumbnail.width, height: thumbnail.height, relativePath: thumbnail.relative_path }]
                : [];
        })
        : [];
    return {
        ...(typeof estimatedTime === "number" && Number.isFinite(estimatedTime) && estimatedTime >= 0
            ? { estimatedTime }
            : {}),
        ...(typeof slicer === "string" ? { slicer } : {}),
        ...(typeof slicerVersion === "string" ? { slicerVersion } : {}),
        thumbnails,
    };
}
/** Builds the largest embedded G-code thumbnail URL from already fetched metadata. */
function previewUrlFromMetadata(metadata, host, port, filename) {
    if (!filename) {
        return "";
    }
    const thumbnail = [...(metadata?.thumbnails ?? [])]
        .filter(t => typeof t.relativePath === "string")
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!thumbnail) {
        return "";
    }
    const directory = filename.includes("/") ? filename.slice(0, filename.lastIndexOf("/") + 1) : "";
    const path = (directory + thumbnail.relativePath).split("/").map(encodeURIComponent).join("/");
    return new URL(`/server/files/gcodes/${path}`, (0, moonraker_1.createMoonrakerBaseUrl)(host, port)).toString();
}
async function previewUrl(host, port, filename, timeoutMs = DEFAULT_MEDIA_TIMEOUT_MS) {
    if (!filename) {
        return "";
    }
    return previewUrlFromMetadata(await getGcodeFileMetadata(host, port, filename, timeoutMs), host, port, filename);
}
//# sourceMappingURL=media.js.map