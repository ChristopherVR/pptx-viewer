/**
 * Pure snap-and-alignment-guide geometry for the Angular editor.
 *
 * No Angular imports, no DOM, no side effects — only data in, data out.
 * All inputs are treated as immutable.
 *
 * Usage during a drag:
 *   1. Compute the candidate box from the raw pointer delta (via applyMove).
 *   2. Call computeSnap(candidateBox, allOtherElementBoxes, threshold / zoom).
 *   3. Apply the returned x/y as the live CSS transform position.
 *   4. Render the returned guides as thin coloured lines on the canvas overlay.
 *   5. Clear guides on pointerup.
 */

/** An axis-aligned bounding box in stage (slide) coordinates. */
export interface SnapBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * A single guide line to draw.
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

/** The result of a snap computation for one drag frame. */
export interface SnapResult {
	/** Snapped x origin of the moving box (box.x adjusted so candidate aligns to the matched other line). */
	x: number;
	/** Snapped y origin of the moving box. */
	y: number;
	/** Guide lines to draw; empty when nothing is within threshold. */
	guides: SnapGuide[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** The three axis-aligned candidate positions for a box on one axis. */
interface Candidates {
	leading: number; // left  / top
	centre: number; // centreX / centreY
	trailing: number; // right / bottom
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

/**
 * Computes the snap offset for one axis.
 *
 * Returns `{ delta, matchedLine, otherBox }` for the closest candidate/other-line
 * pair whose |distance| ≤ threshold, or `null` when nothing is within range.
 *
 * `delta` is the amount to add to the moving box's origin so that the
 * matched candidate aligns exactly on `matchedLine`.
 */
interface SnapHit {
	delta: number;
	matchedLine: number;
	otherBox: SnapBox;
}

function findSnapHitX(box: SnapBox, others: readonly SnapBox[], threshold: number): SnapHit | null {
	const moving = xCandidates(box);
	const movingValues: readonly number[] = [moving.leading, moving.centre, moving.trailing];

	let best: SnapHit | null = null;
	let bestDist = threshold + 1; // anything beyond threshold is ignored

	for (const other of others) {
		const target = xCandidates(other);
		const targetValues: readonly number[] = [target.leading, target.centre, target.trailing];

		for (let mi = 0; mi < movingValues.length; mi++) {
			const mv = movingValues[mi];
			for (let ti = 0; ti < targetValues.length; ti++) {
				const tv = targetValues[ti];
				const dist = mv > tv ? mv - tv : tv - mv; // Math.abs without ES2022+ concern
				if (dist <= threshold && dist < bestDist) {
					bestDist = dist;
					// Shift the box so the matching candidate line lands on `tv`.
					best = {
						delta: tv - mv,
						matchedLine: tv,
						otherBox: other,
					};
				}
			}
		}
	}

	return best;
}

function findSnapHitY(box: SnapBox, others: readonly SnapBox[], threshold: number): SnapHit | null {
	const moving = yCandidates(box);
	const movingValues: readonly number[] = [moving.leading, moving.centre, moving.trailing];

	let best: SnapHit | null = null;
	let bestDist = threshold + 1;

	for (const other of others) {
		const target = yCandidates(other);
		const targetValues: readonly number[] = [target.leading, target.centre, target.trailing];

		for (let mi = 0; mi < movingValues.length; mi++) {
			const mv = movingValues[mi];
			for (let ti = 0; ti < targetValues.length; ti++) {
				const tv = targetValues[ti];
				const dist = mv > tv ? mv - tv : tv - mv;
				if (dist <= threshold && dist < bestDist) {
					bestDist = dist;
					best = {
						delta: tv - mv,
						matchedLine: tv,
						otherBox: other,
					};
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute snap adjustments and guide lines for a box being dragged.
 *
 * For each axis independently:
 * - The moving box has three candidate positions (leading, centre, trailing).
 * - Every other box exposes the same three positions on that axis.
 * - If any |candidate − otherPos| ≤ threshold, the closest pair snaps: the
 *   returned x (or y) is adjusted so the candidate aligns exactly with the
 *   other position, and a SnapGuide is emitted along the axis spanning both
 *   boxes' perpendicular extents.
 * - At most one snap per axis (closest wins).
 * - When nothing is within threshold, x/y are returned unchanged and guides
 *   is empty.
 */
export function computeSnap(
	box: SnapBox,
	others: readonly SnapBox[],
	threshold: number,
): SnapResult {
	const guides: SnapGuide[] = [];
	let snappedX = box.x;
	let snappedY = box.y;

	// --- X axis ---
	const hitX = findSnapHitX(box, others, threshold);
	if (hitX !== null) {
		snappedX = box.x + hitX.delta;
		// Guide: vertical line (axis:'x') at matchedLine, spanning both boxes' Y extents.
		const movedBoxTop = box.y;
		const movedBoxBottom = box.y + box.height;
		const { start, end } = unionExtent(
			movedBoxTop,
			movedBoxBottom,
			hitX.otherBox.y,
			hitX.otherBox.y + hitX.otherBox.height,
		);
		guides.push({ axis: 'x', pos: hitX.matchedLine, start, end });
	}

	// --- Y axis ---
	const hitY = findSnapHitY(box, others, threshold);
	if (hitY !== null) {
		snappedY = box.y + hitY.delta;
		// Guide: horizontal line (axis:'y') at matchedLine, spanning both boxes' X extents.
		// Use snappedX for the moved box's horizontal extent so the guide reflects final position.
		const movedBoxLeft = snappedX;
		const movedBoxRight = snappedX + box.width;
		const { start, end } = unionExtent(
			movedBoxLeft,
			movedBoxRight,
			hitY.otherBox.x,
			hitY.otherBox.x + hitY.otherBox.width,
		);
		guides.push({ axis: 'y', pos: hitY.matchedLine, start, end });
	}

	return { x: snappedX, y: snappedY, guides };
}
