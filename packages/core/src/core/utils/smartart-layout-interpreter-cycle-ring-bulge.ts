/**
 * SmartArt DiagramML interpreter - cycle ring `sibTrans` bulge bounds.
 *
 * Split out of `smartart-layout-interpreter-cycle-ring.ts` (the repo's
 * per-file line budget) - the satellite-only natural bounding box, plus the
 * SEPARATE, bulge-expanded box used only for the ring's own scale divisor
 * (`smartart-layout-interpreter-cycle-sibtrans.ts` has the full `sibTrans`
 * derivation).
 *
 * Pure geometry; no framework code.
 */

export interface RingBulgeBounds {
	/** Satellite-only extremes (no bulge) - `centers`/`hubCenter` map relative to these, and `resolveRingAxisOffset` uses `naturalBoundW`/`naturalBoundH` (not the bulge-expanded ones) so neither the flush nor the tied margin split shifts. */
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	naturalBoundW: number;
	naturalBoundH: number;
	/** Bulge-expanded on both extremes - the SCALE divisor only. */
	scaleBoundW: number;
	scaleBoundH: number;
}

/**
 * The satellite-only bounding box (`halfW`/`halfH` around every natural
 * point), plus a SEPARATE bulge-expanded box for the scale divisor only -
 * see `RingBulgeBounds`'s own field docs, and `smartart-layout-interpreter-
 * cycle-ring.ts`'s own call site for the measured regression this split
 * fixes (bulge-expanding the SAME box `resolveRingAxisOffset` uses shifted
 * a flush satellite ~34px off the box edge, and a tied-axis ring ~34px off
 * box-centre, in opposite directions).
 */
export function computeRingBulgeBounds(
	xs: number[],
	ys: number[],
	halfW: number,
	halfH: number,
	sibTransBulgeRatio: number | undefined,
): RingBulgeBounds {
	const minX = Math.min(...xs) - halfW;
	const maxX = Math.max(...xs) + halfW;
	const minY = Math.min(...ys) - halfH;
	const maxY = Math.max(...ys) + halfH;
	const naturalBoundW = Math.max(1e-6, maxX - minX);
	const naturalBoundH = Math.max(1e-6, maxY - minY);
	const bulge = Math.max(0, sibTransBulgeRatio ?? 0);
	return {
		minX,
		maxX,
		minY,
		maxY,
		naturalBoundW,
		naturalBoundH,
		scaleBoundW: naturalBoundW + 2 * bulge,
		scaleBoundH: naturalBoundH + 2 * bulge,
	};
}
