"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRequest = mediaRequest;
exports.discoverCameras = discoverCameras;
exports.cameraUrl = cameraUrl;
exports.previewUrl = previewUrl;
const moonraker_1 = require("./moonraker");
async function mediaRequest(host, port, path) {
    const response = await fetch(new URL(path, (0, moonraker_1.createMoonrakerBaseUrl)(host, port)), {
        signal: AbortSignal.timeout(10_000),
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
async function discoverCameras(host, port) {
    const result = await mediaRequest(host, port, "/server/webcams/list");
    if (!Array.isArray(result.webcams)) {
        throw new Error("Invalid webcam list");
    }
    return result.webcams.filter((camera) => typeof camera === "object" &&
        camera !== null &&
        typeof camera.uid === "string" &&
        typeof camera.name === "string");
}
function cameraUrl(value, host) {
    if (!value) {
        return "";
    }
    const url = new URL(value, `http://${host}/`);
    return ["http:", "https:", "rtsp:"].includes(url.protocol) ? url.toString() : "";
}
async function previewUrl(host, port, filename) {
    if (!filename) {
        return "";
    }
    const metadata = await mediaRequest(host, port, `/server/files/metadata?filename=${encodeURIComponent(filename)}`);
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