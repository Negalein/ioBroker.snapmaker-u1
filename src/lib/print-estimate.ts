export interface PrintEstimateInput {
	printState: unknown;
	printDuration: unknown;
	progressPercent: unknown;
	slicerEstimatedDuration: unknown;
	now?: number;
}

export interface PrintEstimate {
	slicerRemaining?: number;
	remaining?: number;
	estimatedEnd?: number;
}

/**
 * Calculates the remaining-print forecast shown by common Moonraker clients.
 * The live progress forecast is preferred because it reflects actual speed;
 * the slicer estimate is a fallback before usable progress is available.
 */
export function calculatePrintEstimate(input: PrintEstimateInput): PrintEstimate {
	if (input.printState !== "printing" && input.printState !== "paused") {
		return {};
	}
	const duration = finiteNonNegative(input.printDuration);
	const progress = finiteProgress(input.progressPercent);
	const slicerDuration = finiteNonNegative(input.slicerEstimatedDuration);
	const slicerRemaining =
		duration !== undefined && slicerDuration !== undefined ? Math.max(0, slicerDuration - duration) : undefined;
	const progressRemaining =
		duration !== undefined && progress !== undefined && progress > 0
			? Math.max(0, duration * ((100 - progress) / progress))
			: undefined;
	const remaining = progressRemaining ?? slicerRemaining;
	return {
		...(slicerRemaining === undefined ? {} : { slicerRemaining }),
		...(remaining === undefined ? {} : { remaining }),
		...(remaining === undefined ? {} : { estimatedEnd: (input.now ?? Date.now()) + remaining * 1_000 }),
	};
}

function finiteNonNegative(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function finiteProgress(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}
