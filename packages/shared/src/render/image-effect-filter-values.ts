function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

/** Build an SVG discrete-transfer table for a 0 through 100 percent threshold. */
export function buildImageBiLevelTable(threshold: number): string {
	const cutoff = clamp(threshold, 0, 100);
	return Array.from({ length: 101 }, (_, index) => (index >= cutoff ? '1' : '0')).join(' ');
}

/**
 * Approximate a signed luminance/tint amount as an RGB linear transfer.
 * Positive values move channels toward white; negative values move them toward black.
 */
export function buildImageLuminanceTransfer(amount: number): {
	slope: number;
	intercept: number;
} {
	const normalized = clamp(amount / 100, -1, 1);
	return normalized >= 0
		? { slope: 1 - normalized, intercept: normalized }
		: { slope: 1 + normalized, intercept: 0 };
}
