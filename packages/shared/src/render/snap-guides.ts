/**
 * Pure snap-and-alignment-guide geometry shared by the React, Vue, and Angular
 * editor bindings. No framework imports, no DOM, no side effects — only data
 * in, data out. All inputs are treated as immutable.
 *
 * Two snap models live here because the bindings grew two distinct flavours;
 * both are exact ports kept feature-for-feature so consumers stay unchanged:
 *
 *  1. `computeSnapToShape` (React / Vue model) — snaps a dragged box to the
 *     edges/centres of sibling boxes **and** user-placed guides within
 *     {@link SNAP_THRESHOLD}px, returning `{ x, y, lines }` where `lines` are
 *     thin axis-positioned guide indicators (no span info).
 *
 *  2. `computeSnap` (Angular model) — snaps a box to a list of other boxes
 *     within an explicit `threshold`, returning `{ x, y, guides }` where each
 *     guide additionally carries the perpendicular `start`/`end` span covering
 *     both boxes. At most one snap per axis (closest wins).
 *
 * `snapToGridStep` rounds a single value to the nearest grid multiple.
 *
 * The pointer/drag driver (event handling, refs, reactive state) stays in each
 * binding; only this geometry is shared.
 */

// ---------------------------------------------------------------------------
// React / Vue model — edge/centre snap to siblings + guides, returning lines.
// ---------------------------------------------------------------------------

/** Max gap (slide px) at which an edge/centre snaps to a sibling or guide. */
export const SNAP_THRESHOLD = 6;

/** A sibling element reduced to its bounding box. */
export interface SnapSibling {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A user-placed alignment guide: `axis: 'v'` is a vertical line at x=`position`. */
export interface SnapGuideInput {
	axis: 'h' | 'v';
	position: number;
}

/** A snap alignment line: `axis: 'v'` is a vertical line at x=`position`. */
export interface SnapLine {
	axis: 'h' | 'v';
	position: number;
}

/** Result of {@link computeSnapToShape}: (optionally snapped) position + lines. */
export interface SnapToShapeResult {
	x: number;
	y: number;
	lines: SnapLine[];
}

/**
 * Compute snap-to-shape alignment lines and optionally snap a dragged element's
 * position to the nearest matching edge/centre of sibling elements and guides.
 *
 * Returns `{ x, y, lines }` where x/y are (optionally snapped) positions and
 * lines is the set of visual guide indicators to render.
 *
 * @param threshold - Snap distance in slide px (defaults to {@link SNAP_THRESHOLD}).
 */
export function computeSnapToShape(
	dragX: number,
	dragY: number,
	dragW: number,
	dragH: number,
	siblings: readonly SnapSibling[],
	draggedIds: Set<string>,
	guides: readonly SnapGuideInput[],
	threshold: number = SNAP_THRESHOLD,
): SnapToShapeResult {
	let bestDx = Infinity;
	let bestDy = Infinity;
	let snapX = dragX;
	let snapY = dragY;
	const lines: SnapLine[] = [];

	const dragCx = dragX + dragW / 2;
	const dragCy = dragY + dragH / 2;
	const dragRight = dragX + dragW;
	const dragBottom = dragY + dragH;

	const hRefs = [dragX, dragCx, dragRight];
	const vRefs = [dragY, dragCy, dragBottom];

	for (const sib of siblings) {
		if (draggedIds.has(sib.id)) {
			continue;
		}
		const sibCx = sib.x + sib.width / 2;
		const sibCy = sib.y + sib.height / 2;
		const sibRight = sib.x + sib.width;
		const sibBottom = sib.y + sib.height;

		// Vertical alignment (x-axis lines)
		for (const ref of [sib.x, sibCx, sibRight]) {
			for (const hr of hRefs) {
				const dx = Math.abs(ref - hr);
				if (dx < threshold && dx < bestDx) {
					bestDx = dx;
					snapX = dragX + (ref - hr);
				}
			}
		}

		// Horizontal alignment (y-axis lines)
		for (const ref of [sib.y, sibCy, sibBottom]) {
			for (const vr of vRefs) {
				const dy = Math.abs(ref - vr);
				if (dy < threshold && dy < bestDy) {
					bestDy = dy;
					snapY = dragY + (ref - vr);
				}
			}
		}
	}

	// Also snap to user-placed guides.
	for (const guide of guides) {
		if (guide.axis === 'v') {
			for (const hr of hRefs) {
				const dx = Math.abs(guide.position - hr);
				if (dx < threshold && dx < bestDx) {
					bestDx = dx;
					snapX = dragX + (guide.position - hr);
				}
			}
		} else {
			for (const vr of vRefs) {
				const dy = Math.abs(guide.position - vr);
				if (dy < threshold && dy < bestDy) {
					bestDy = dy;
					snapY = dragY + (guide.position - vr);
				}
			}
		}
	}

	// Compute display lines for the closest snaps found.
	if (bestDx < threshold) {
		const snappedCx = snapX + dragW / 2;
		const snappedRight = snapX + dragW;
		for (const sib of siblings) {
			if (draggedIds.has(sib.id)) {
				continue;
			}
			for (const ref of [sib.x, sib.x + sib.width / 2, sib.x + sib.width]) {
				if (
					Math.abs(ref - snapX) < 1 ||
					Math.abs(ref - snappedCx) < 1 ||
					Math.abs(ref - snappedRight) < 1
				) {
					lines.push({ axis: 'v', position: ref });
				}
			}
		}
		for (const g of guides) {
			if (
				g.axis === 'v' &&
				(Math.abs(g.position - snapX) < 1 ||
					Math.abs(g.position - snappedCx) < 1 ||
					Math.abs(g.position - snappedRight) < 1)
			) {
				lines.push({ axis: 'v', position: g.position });
			}
		}
	}
	if (bestDy < threshold) {
		const snappedCy = snapY + dragH / 2;
		const snappedBottom = snapY + dragH;
		for (const sib of siblings) {
			if (draggedIds.has(sib.id)) {
				continue;
			}
			for (const ref of [sib.y, sib.y + sib.height / 2, sib.y + sib.height]) {
				if (
					Math.abs(ref - snapY) < 1 ||
					Math.abs(ref - snappedCy) < 1 ||
					Math.abs(ref - snappedBottom) < 1
				) {
					lines.push({ axis: 'h', position: ref });
				}
			}
		}
		for (const g of guides) {
			if (
				g.axis === 'h' &&
				(Math.abs(g.position - snapY) < 1 ||
					Math.abs(g.position - snappedCy) < 1 ||
					Math.abs(g.position - snappedBottom) < 1)
			) {
				lines.push({ axis: 'h', position: g.position });
			}
		}
	}

	return { x: snapX, y: snapY, lines };
}

// ---------------------------------------------------------------------------
// Angular model — closest-per-axis snap to other boxes, returning span guides.
// ---------------------------------------------------------------------------

/** An axis-aligned bounding box in stage (slide) coordinates. */
export interface SnapBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * A single span guide line to draw.
 *
 * `axis: 'x'` → a vertical line at x = `pos`, spanning y ∈ [start, end].
 * `axis: 'y'` → a horizontal line at y = `pos`, spanning x ∈ [start, end].
 */
export interface SnapGuide {
	axis: 'x' | 'y';
	/** The fixed coordinate of the line on its own axis. */
	pos: number;
	/** Start of the line along the perpendicular axis. */
	start: number;
	/** End of the line along the perpendicular axis. */
	end: number;
}

/** The result of a {@link computeSnap} computation for one drag frame. */
export interface SnapResult {
	/** Snapped x origin of the moving box. */
	x: number;
	/** Snapped y origin of the moving box. */
	y: number;
	/** Guide lines to draw; empty when nothing is within threshold. */
	guides: SnapGuide[];
}

/** The three axis-aligned candidate positions for a box on one axis. */
interface Candidates {
	leading: number;
	centre: number;
	trailing: number;
}

function xCandidates(box: SnapBox): Candidates {
	return {
		leading: box.x,
		centre: box.x + box.width / 2,
		trailing: box.x + box.width,
	};
}

function yCandidates(box: SnapBox): Candidates {
	return {
		leading: box.y,
		centre: box.y + box.height / 2,
		trailing: box.y + box.height,
	};
}

interface SnapHit {
	delta: number;
	matchedLine: number;
	otherBox: SnapBox;
}

function findSnapHit(
	movingValues: readonly number[],
	others: readonly SnapBox[],
	axisCandidates: (box: SnapBox) => Candidates,
	threshold: number,
): SnapHit | null {
	let best: SnapHit | null = null;
	let bestDist = threshold + 1; // anything beyond threshold is ignored

	for (const other of others) {
		const target = axisCandidates(other);
		const targetValues: readonly number[] = [target.leading, target.centre, target.trailing];

		for (const mv of movingValues) {
			for (const tv of targetValues) {
				const dist = mv > tv ? mv - tv : tv - mv; // Math.abs without ES2022+ concern
				if (dist <= threshold && dist < bestDist) {
					bestDist = dist;
					best = { delta: tv - mv, matchedLine: tv, otherBox: other };
				}
			}
		}
	}

	return best;
}

/** Union of the two boxes' extent along a single axis (for guide span). */
function unionExtent(
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number,
): { start: number; end: number } {
	const start = aStart < bStart ? aStart : bStart;
	const end = aEnd > bEnd ? aEnd : bEnd;
	return { start, end };
}

/**
 * Compute snap adjustments and span guide lines for a box being dragged.
 *
 * For each axis independently the moving box exposes three candidate positions
 * (leading, centre, trailing) and so does every other box. If any
 * `|candidate − otherPos| ≤ threshold`, the closest pair snaps: the returned
 * x (or y) is adjusted so the candidate aligns exactly with the other
 * position, and a {@link SnapGuide} is emitted spanning both boxes'
 * perpendicular extents. At most one snap per axis (closest wins). When nothing
 * is within threshold, x/y are returned unchanged and guides is empty.
 */
export function computeSnap(
	box: SnapBox,
	others: readonly SnapBox[],
	threshold: number,
): SnapResult {
	const guides: SnapGuide[] = [];
	let snappedX = box.x;
	let snappedY = box.y;

	const xMoving = xCandidates(box);
	const hitX = findSnapHit(
		[xMoving.leading, xMoving.centre, xMoving.trailing],
		others,
		xCandidates,
		threshold,
	);
	if (hitX !== null) {
		snappedX = box.x + hitX.delta;
		const { start, end } = unionExtent(
			box.y,
			box.y + box.height,
			hitX.otherBox.y,
			hitX.otherBox.y + hitX.otherBox.height,
		);
		guides.push({ axis: 'x', pos: hitX.matchedLine, start, end });
	}

	const yMoving = yCandidates(box);
	const hitY = findSnapHit(
		[yMoving.leading, yMoving.centre, yMoving.trailing],
		others,
		yCandidates,
		threshold,
	);
	if (hitY !== null) {
		snappedY = box.y + hitY.delta;
		// Use snappedX so the guide reflects the final horizontal position.
		const { start, end } = unionExtent(
			snappedX,
			snappedX + box.width,
			hitY.otherBox.x,
			hitY.otherBox.x + hitY.otherBox.width,
		);
		guides.push({ axis: 'y', pos: hitY.matchedLine, start, end });
	}

	return { x: snappedX, y: snappedY, guides };
}

/**
 * Snap a raw position value to the nearest grid step.
 *
 * @param value - Raw position in stage coordinates.
 * @param step  - Grid spacing in px (must be > 0; if ≤ 0 the value is returned
 *               unchanged so callers do not need to guard against zero).
 * @returns The nearest multiple of `step`.
 */
export function snapToGridStep(value: number, step: number): number {
	if (step <= 0) {
		return value;
	}
	// `|| 0` converts −0 (which Math.round can produce for small negative inputs)
	// to plain 0, so position values stay sign-neutral.
	return Math.round(value / step) * step || 0;
}

/**
 * Round a value to the nearest multiple of `size` (the grid spacing).
 *
 * Unlike {@link snapToGridStep} this does not guard against a non-positive
 * step (Vue's "Snap to Grid" caller always passes a positive grid size) and
 * does not normalise −0; it mirrors React's `Math.round(v / gs) * gs`.
 */
export function snapValue(value: number, size: number): number {
	return Math.round(value / size) * size;
}

/**
 * Snap a box's position + size to the grid (View ▸ Snap to Grid). Sizes are
 * clamped to at least one grid cell so an element never collapses to zero.
 */
export function snapBox(box: SnapBox, size: number): SnapBox {
	return {
		x: snapValue(box.x, size),
		y: snapValue(box.y, size),
		width: Math.max(size, snapValue(box.width, size)),
		height: Math.max(size, snapValue(box.height, size)),
	};
}
