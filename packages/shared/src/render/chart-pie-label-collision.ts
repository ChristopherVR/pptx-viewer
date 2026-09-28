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

/** How far one label moves (`dx`/`dy` are 0 when it stays put). */
export interface LabelNudge {
	id: number;
	dx: number;
	dy: number;
}

/** The pie disc a nudged label must never be pushed into. */
export interface PieDisc {
	cx: number;
	cy: number;
	r: number;
}

/** Distance from the disc centre to the nearest point of a box centred at (`x`, `y`). */
function boxDistanceToCentre(box: OutsideLabelBox, y: number, disc: PieDisc): number {
	const nearestX = Math.max(box.x - box.w / 2, Math.min(disc.cx, box.x + box.w / 2));
	const nearestY = Math.max(y - box.h / 2, Math.min(disc.cy, y + box.h / 2));
	return Math.hypot(nearestX - disc.cx, nearestY - disc.cy);
}

/**
 * A vertical nudge moves a label ALONG the rim only near 3 and 9 o'clock; near
 * 6 and 12 o'clock it drives the label into the pie. Push such a label
 * outward horizontally until its box clears the disc again.
 */
function clearOfDisc(box: OutsideLabelBox, y: number, disc: PieDisc): number {
	if (boxDistanceToCentre(box, y, disc) >= disc.r) {
		return 0;
	}
	const sign = box.x >= disc.cx ? 1 : -1;
	let dx = 0;
	while (
		dx < disc.r * 2 &&
		boxDistanceToCentre({ ...box, x: box.x + sign * dx }, y, disc) < disc.r
	) {
		dx += 1;
	}
	return sign * dx;
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
 * `disc` splits the labels into a left and a right column and keeps every
 * nudged label outside the pie; `minY`/`maxY` bound the drawing area. Labels
 * that do not collide get `dx: 0, dy: 0`.
 */
export function nudgeOutsideLabels(
	boxes: ReadonlyArray<OutsideLabelBox>,
	disc: PieDisc,
	minY: number,
	maxY: number,
): LabelNudge[] {
	const resolved = new Map<number, number>();
	for (const side of [
		boxes.filter((box) => box.x >= disc.cx),
		boxes.filter((box) => box.x < disc.cx),
	]) {
		for (const [id, y] of sweepSide(side, minY, maxY)) {
			resolved.set(id, y);
		}
	}
	return boxes.map((box) => {
		const y = resolved.get(box.id) ?? box.y;
		return { id: box.id, dx: y === box.y ? 0 : clearOfDisc(box, y, disc), dy: y - box.y };
	});
}
