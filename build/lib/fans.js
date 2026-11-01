"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fanNames = void 0;
exports.fanCommand = fanCommand;
exports.setFanSpeed = setFanSpeed;
const moonraker_1 = require("./moonraker");
exports.fanNames = {
    "printer.cover.circulation.speed": "circulation_fan",
    "printer.cover.exhaust.speed": "exhaust_fan",
};
function fanCommand(id, percent) {
    const fan = exports.fanNames[id];
    if (!fan || typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error("Fan speed must be a number between 0 and 100");
    }
    return `SET_FAN_SPEED FAN=${fan} SPEED=${percent / 100}`;
}
async function setFanSpeed(host, port, id, percent) {
    const script = fanCommand(id, percent);
    const response = await fetch(new URL("printer/gcode/script", (0, moonraker_1.createMoonrakerBaseUrl)(host, port)), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ script }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new Error(`Fan command failed: HTTP ${response.status}`);
    }
    const result = (await response.json());
    if (result.error) {
        throw new Error("Moonraker rejected the fan command");
    }
}
//# sourceMappingURL=fans.js.map