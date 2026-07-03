/**
 * ruler-ticks.ts: Pure tick-mark generation for the slide canvas's horizontal
 * and vertical ruler strips. No Angular/DOM dependency so it is trivially
 * unit-testable in isolation from `SlideCanvasComponent`.
 */

/** Height/width (px) of the ruler strips: mirrors React's RULER_THICKNESS. */
export const RULER_THICKNESS = 20;
/** Pixels per inch on the slide canvas (PPTX slides are 10" wide = 960 px). */
export const SLIDE_PX_PER_INCH = 96;

/** A single tick mark on a ruler strip. */
export interface RulerTick {
	/** Position in screen pixels along the ruler. */
	position: number;
	/** Whether this is a major (inch) tick. */
	isMajor: boolean;
	/** Label to display (only on major ticks, every N inches). */
	label: string | null;
}

/**
 * Generate ruler tick marks for a given slide dimension and scale.
 * Produces ticks every 1/4 inch (minor) and every inch (major).
 */
export function generateRulerTicks(slidePx: number, scale: number): ReadonlyArray<RulerTick> {
	const scaledLength = slidePx * scale;
	const quarterInchPx = (SLIDE_PX_PER_INCH / 4) * scale;
	if (quarterInchPx < 2) {
		return [];
	}
	const ticks: RulerTick[] = [];
	let pos = 0;
	let inchIndex = 0;
	while (pos <= scaledLength + 0.5) {
		const isMajor = inchIndex % 4 === 0;
		ticks.push({
			position: pos,
			isMajor,
			label: isMajor && inchIndex > 0 ? String(inchIndex / 4) : null,
		});
		pos += quarterInchPx;
		inchIndex++;
	}
	return ticks;
}
