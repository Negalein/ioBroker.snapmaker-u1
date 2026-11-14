"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePrintEstimate = calculatePrintEstimate;
/**
 * Calculates the remaining-print forecast shown by common Moonraker clients.
 * The live progress forecast is preferred because it reflects actual speed;
 * the slicer estimate is a fallback before usable progress is available.
 */
function calculatePrintEstimate(input) {
    if (input.printState !== "printing" && input.printState !== "paused") {
        return {};
    }
    const duration = finiteNonNegative(input.printDuration);
    const progress = finiteProgress(input.progressPercent);
    const slicerDuration = finiteNonNegative(input.slicerEstimatedDuration);
    const slicerRemaining = duration !== undefined && slicerDuration !== undefined ? Math.max(0, slicerDuration - duration) : undefined;
    const progressRemaining = duration !== undefined && progress !== undefined && progress > 0
        ? Math.max(0, duration * ((100 - progress) / progress))
        : undefined;
    const remaining = progressRemaining ?? slicerRemaining;
    return {
        ...(slicerRemaining === undefined ? {} : { slicerRemaining }),
        ...(remaining === undefined ? {} : { remaining }),
        ...(remaining === undefined ? {} : { estimatedEnd: (input.now ?? Date.now()) + remaining * 1_000 }),
    };
}
function finiteNonNegative(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function finiteProgress(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}
//# sourceMappingURL=print-estimate.js.map