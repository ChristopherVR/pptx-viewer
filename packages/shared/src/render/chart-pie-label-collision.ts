/**
 * chart-pie-label-collision.ts: nudge colliding OUTSIDE pie labels apart.
 *
 * At `c:dLblPos val="bestFit"` PowerPoint puts a label that does not fit in its
 * slice outside the rim; when two such labels overlap it moves them apart
 * (vertically, within their own side of the pie) and draws a leader line to
 * each one it moved. This module is the pure geometry half: it takes the
 * outside label boxes and returns how far each one moves. The caller decides
 * what to draw (a moved label gets a leader line; see `chart-pie-labels`).
 *
 * The algorithm is a per-side sweep: labels on the right (or left) of the pie
 * are sorted top to bottom, each is pushed below the previous one when they
 * overlap, and if the stack then runs past the bottom bound it is shifted back
 * up. Constants are not COM-measured; the gap is one line of breathing room.
 *
 * @module chart-pie-label-collision
 */

/** Minimum vertical gap (px) kept between two nudged labels. */
export const LABEL_COLLISION_GAP = 2;

/** One outside label box: its centre and size, keyed by an opaque id. */
export interface OutsideLabelBox {
	id: number;
	/** Box centre, in the same space as `pieCx`. */
	x: number;
	y: number;
	w: number;
	h: number;
}

/** How far one label moves (vertically only; `dy` is 0 when it stays put). */
export interface LabelNudge {
	id: number;
	dy: number;
}

/** Whether two boxes overlap horizontally (they share x extent). */
function overlapsX(a: OutsideLabelBox, b: OutsideLabelBox): boolean {
	return Math.abs(a.x - b.x) < (a.w + b.w) / 2;
}

/** Sweep one side's labels; returns the resolved centre y per box, by input order. */
function sweepSide(
	boxes: ReadonlyArray<OutsideLabelBox>,
	minY: number,
	maxY: number,
): Map<number, number> {
	const sorted = [...boxes].sort((a, b) => a.y - b.y || a.id - b.id);
	const ys = sorted.map((box) => box.y);
	for (let i = 1; i < sorted.length; i++) {
		const prev = sorted[i - 1]!;
		const box = sorted[i]!;
		if (overlapsX(prev, box)) {
			ys[i] = Math.max(ys[i]!, ys[i - 1]! + (prev.h + box.h) / 2 + LABEL_COLLISION_GAP);
		}
	}
	// Past the bottom bound: shift the tail back up, keeping the gaps.
	for (let i = sorted.length - 1; i >= 0; i--) {
		const box = sorted[i]!;
		const limit =
			i === sorted.length - 1
				? maxY - box.h / 2
				: ys[i + 1]! - (box.h + sorted[i + 1]!.h) / 2 - LABEL_COLLISION_GAP;
		if (ys[i]! > limit) {
			ys[i] = Math.max(limit, minY + box.h / 2);
		}
	}
	return new Map(sorted.map((box, i) => [box.id, ys[i]!]));
}

/**
 * Compute the vertical nudges that separate overlapping outside labels.
 * `pieCx` splits the labels into a left and a right column; `minY`/`maxY` bound
 * the drawing area. Labels that do not collide get `dy: 0`.
 */
export function nudgeOutsideLabels(
	boxes: ReadonlyArray<OutsideLabelBox>,
	pieCx: number,
	minY: number,
	maxY: number,
): LabelNudge[] {
	const resolved = new Map<number, number>();
	for (const side of [
		boxes.filter((box) => box.x >= pieCx),
		boxes.filter((box) => box.x < pieCx),
	]) {
		for (const [id, y] of sweepSide(side, minY, maxY)) {
			resolved.set(id, y);
		}
	}
	return boxes.map((box) => ({ id: box.id, dy: (resolved.get(box.id) ?? box.y) - box.y }));
}
