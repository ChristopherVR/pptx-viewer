/**
 * The outline a measured hierarchy subtree occupies: every drawn node's
 * rectangle, relative to the subtree's own origin. Siblings are packed by
 * these outlines rather than by bounding boxes (a Reingold-Tilford style
 * contour packing), which is what PowerPoint does: "Organization Chart"
 * rows keep the plain `W + sibSp` pitch although a hanging child juts
 * `0.25 W` past its parent (it sits a generation lower, beside the empty
 * space under the next sibling), and in `smartart-orgchart-nested-hang.pptx`
 * Report B's three children fan out underneath its leaf siblings Report A
 * and Report C instead of pushing them apart.
 */

import type { Box, EngineNode } from './engine-node';

/** One drawn rectangle of a subtree outline; `node` is the part it places. */
export interface OutlineRect extends Box {
	node: EngineNode;
}

/** A measured subtree: its drawn outline and the extent of its own top-level node. */
export interface HierShape {
	rects: OutlineRect[];
	/** The subtree's own node rectangle (the one siblings align and parents centre on). */
	head: Box;
}

export function shiftShape(shape: HierShape, dx: number, dy: number): HierShape {
	return {
		rects: shape.rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy })),
		head: { ...shape.head, x: shape.head.x + dx, y: shape.head.y + dy },
	};
}

export function boundsOf(rects: readonly Box[]): Box {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	for (const r of rects) {
		x0 = Math.min(x0, r.x);
		y0 = Math.min(y0, r.y);
		x1 = Math.max(x1, r.x + r.w);
		y1 = Math.max(y1, r.y + r.h);
	}
	return rects.length === 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The smallest shift along the packing axis that keeps every rectangle of
 * `next` at least `gap` beyond every rectangle of `placed` it overlaps
 * across that axis.
 */
export function packOffset(
	placed: readonly Box[],
	next: readonly Box[],
	gap: number,
	vertical: boolean,
): number {
	let offset = -Infinity;
	for (const a of placed) {
		for (const b of next) {
			const overlaps = vertical
				? a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9
				: a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
			if (!overlaps) {
				continue;
			}
			const needed = vertical ? a.y + a.h + gap - b.y : a.x + a.w + gap - b.x;
			offset = Math.max(offset, needed);
		}
	}
	return offset;
}
