/**
 * Ruler tick-generation + constants shared by the React, Vue, and Angular
 * editors. Pure (unit-testable); each binding renders the generated ticks.
 */

/** CSS pixels per inch at 96 dpi. */
export const PX_PER_INCH = 96;
/** CSS pixels per centimetre (96 / 2.54). */
export const PX_PER_CM = 96 / 2.54;
/** Ruler strip thickness in CSS pixels. */
export const RULER_THICKNESS = 20;
/** Font size for numbers on the ruler. */
export const RULER_FONT_SIZE = 10;

/** The unit system used for ruler display. */
export type RulerUnit = 'inches' | 'centimetres';

export interface Tick {
	/** Position along the ruler in scaled CSS pixels from the slide origin. */
	position: number;
	/** Label to display (empty for minor ticks). */
	label: string;
	/** Whether this is a major (numbered) tick. */
	isMajor: boolean;
}

/**
 * Generate tick marks for a single ruler axis.
 *
 * @param slideLengthPx  The slide dimension (width or height) in CSS px.
 * @param scale          The current editor scale.
 * @param unit           Ruler unit system.
 */
export function generateTicks(slideLengthPx: number, scale: number, unit: RulerUnit): Tick[] {
	const pxPerUnit = unit === 'inches' ? PX_PER_INCH : PX_PER_CM;
	const scaledPxPerUnit = pxPerUnit * scale;

	// Minor subdivisions: 8 (1/8") or 10 (1mm), collapsed when too dense.
	const baseSubdivisions = unit === 'inches' ? 8 : 10;
	let subdivisions = baseSubdivisions;
	const minTickSpacingPx = 4;
	while (subdivisions > 1 && scaledPxPerUnit / subdivisions < minTickSpacingPx) {
		subdivisions = Math.max(1, Math.floor(subdivisions / 2));
		if (subdivisions <= 1) {
			break;
		}
	}

	// Skip major labels at very tiny zoom so they don't overlap.
	let majorStep = 1;
	const minMajorSpacingPx = 30;
	while (scaledPxPerUnit * majorStep < minMajorSpacingPx) {
		majorStep *= 2;
	}

	const totalUnits = slideLengthPx / pxPerUnit;
	const totalSubdivisions = Math.ceil(totalUnits * subdivisions);
	const ticks: Tick[] = [];

	for (let i = 0; i <= totalSubdivisions; i++) {
		const unitValue = i / subdivisions;
		const slidePx = unitValue * pxPerUnit;
		if (slidePx > slideLengthPx + 0.5) {
			break;
		}
		const position = slidePx * scale;
		const isSubdivisionMajor = i % subdivisions === 0;
		const unitIndex = Math.round(unitValue);
		const showLabel = isSubdivisionMajor && unitIndex % majorStep === 0;
		ticks.push({
			position,
			label: showLabel ? String(unitIndex) : '',
			isMajor: isSubdivisionMajor,
		});
	}

	return ticks;
}

/**
 * Resolve a drag that started on a ruler strip into a new guide position.
 *
 * Shared because every binding that supports "drag off the ruler to create a
 * guide" needs the exact same three rules, and they are easy to get subtly
 * wrong per binding: the pointer must have left the strip (otherwise a plain
 * click on the ruler would drop a guide on the slide edge), the offset is
 * measured from the strip's own leading edge so the strip thickness has to be
 * subtracted before un-scaling, and a guide dropped outside the slide is
 * discarded rather than clamped (PowerPoint drops it too).
 *
 * @param pointerOffsetPx Pointer distance, in screen px, from the leading edge
 *                        of the ruler strip (top for the horizontal ruler,
 *                        left for the vertical one).
 * @param scale           Current editor scale (fitScale * userZoom).
 * @param slideLengthPx   Slide dimension on the guide's axis, unscaled.
 * @returns The slide-local position in unscaled px, or `null` when the drag
 *          should not create a guide.
 */
export function rulerDragToGuidePosition(
	pointerOffsetPx: number,
	scale: number,
	slideLengthPx: number,
): number | null {
	if (pointerOffsetPx <= RULER_THICKNESS) {
		return null;
	}
	const position = (pointerOffsetPx - RULER_THICKNESS) / (scale || 1);
	if (position < 0 || position > slideLengthPx) {
		return null;
	}
	return position;
}
