/**
 * Where PowerPoint puts a pie data label at `c:dLblPos val="bestFit"`.
 *
 * COM ground truth (`chart-pie-best-fit.pptx`: eight pies of different slice
 * sizes, boxed 12pt labels, measured from `Slide.Export` pixels at two pie
 * sizes, R = 89.6pt and 190.3pt):
 *
 *  - A label that fits inside its slice sits INSIDE it, on the slice's
 *    mid-angle, pushed out until the box corner farthest from the centre is
 *    4pt inside the rim. The 4pt is the same for both pie sizes, so it is a
 *    fixed inset, not a fraction of the radius. (The renderer used to put
 *    every such label at 0.7 of the radius, well short of PowerPoint's.)
 *  - "Fits" means that box, so placed, stays inside the slice's two edges:
 *    PowerPoint tolerates about 1.5pt of overhang (a 10% slice with a
 *    two-line label is on the boundary: one of three stays inside).
 *  - A label that does not fit goes OUTSIDE, on the mid-angle, with the box
 *    side facing the pie 2pt beyond the rim. PowerPoint then nudges outside
 *    labels apart when they collide and draws leader lines to the nudged
 *    ones; that collision pass is not modelled.
 *
 * All lengths are in the chart's px space (1pt = 4/3px).
 *
 * @module chart-pie-best-fit
 */

/** px per pt. */
const PX_PER_PT = 4 / 3;
/** COM: the farthest box corner of an inside label sits this far inside the rim. */
export const BEST_FIT_RIM_INSET = 4 * PX_PER_PT;
/** COM: how far a box may overhang a slice edge and still count as inside. */
export const BEST_FIT_EDGE_TOLERANCE = 1.5 * PX_PER_PT;
/** COM: the gap between the rim and an outside label's box. */
export const BEST_FIT_OUTSIDE_GAP = 2 * PX_PER_PT;

/** A slice as the placement needs it: centre, radius and its two edge angles. */
export interface BestFitSlice {
	cx: number;
	cy: number;
	outerR: number;
	/** Radians, SVG convention (0 = 3 o'clock, clockwise positive). */
	startAngle: number;
	endAngle: number;
}

/** Where the label box's centre goes, and whether that is inside the slice. */
export interface BestFitPlacement {
	x: number;
	y: number;
	inside: boolean;
}

/** Farthest distance from the origin of a `w x h` box centred at (`x`, `y`). */
function farCorner(x: number, y: number, w: number, h: number): number {
	return Math.hypot(Math.abs(x) + w / 2, Math.abs(y) + h / 2);
}

/**
 * The distance along direction (`ux`, `uy`) at which the box's farthest
 * corner reaches `limit`, or `undefined` when even a centred box pokes out.
 */
function insideDistance(
	ux: number,
	uy: number,
	w: number,
	h: number,
	limit: number,
): number | undefined {
	if (farCorner(0, 0, w, h) > limit) {
		return undefined;
	}
	let lo = 0;
	let hi = limit;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (farCorner(mid * ux, mid * uy, w, h) > limit) {
			hi = mid;
		} else {
			lo = mid;
		}
	}
	return lo;
}

/** How far the box (centre `x`, `y`, relative to the pie centre) crosses either slice edge. */
function edgeOverhang(x: number, y: number, w: number, h: number, slice: BestFitSlice): number {
	let worst = Number.NEGATIVE_INFINITY;
	for (const [dx, dy] of [
		[-w / 2, -h / 2],
		[w / 2, -h / 2],
		[-w / 2, h / 2],
		[w / 2, h / 2],
	]) {
		const px = x + dx;
		const py = y + dy;
		// Signed distance from each edge line, positive on the slice's side.
		const fromStart = Math.cos(slice.startAngle) * py - Math.sin(slice.startAngle) * px;
		const fromEnd = Math.sin(slice.endAngle) * px - Math.cos(slice.endAngle) * py;
		worst = Math.max(worst, -fromStart, -fromEnd);
	}
	return worst;
}

/**
 * Place a `w x h` label box for a slice at `bestFit` (see the module doc).
 * A slice of half the pie or more always has room, so its label stays inside.
 */
export function placeBestFitLabel(slice: BestFitSlice, w: number, h: number): BestFitPlacement {
	const mid = (slice.startAngle + slice.endAngle) / 2;
	const ux = Math.cos(mid);
	const uy = Math.sin(mid);
	const distance = insideDistance(ux, uy, w, h, slice.outerR - BEST_FIT_RIM_INSET);
	if (distance !== undefined) {
		const x = distance * ux;
		const y = distance * uy;
		const reflex = slice.endAngle - slice.startAngle >= Math.PI;
		if (reflex || edgeOverhang(x, y, w, h, slice) <= BEST_FIT_EDGE_TOLERANCE) {
			return { x: slice.cx + x, y: slice.cy + y, inside: true };
		}
	}
	// Outside: the box's extent towards the centre starts just beyond the rim.
	const extent = (Math.abs(ux) * w) / 2 + (Math.abs(uy) * h) / 2;
	const outside = slice.outerR + BEST_FIT_OUTSIDE_GAP + extent;
	return { x: slice.cx + outside * ux, y: slice.cy + outside * uy, inside: false };
}
