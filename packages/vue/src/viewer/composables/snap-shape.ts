/**
 * snap-shape — snap-to-shape alignment maths (View ▸ Snap to Shape). Vue port of
 * React's `computeSnapToShapeResult` (viewer/utils/geometry-selection.ts). Pure
 * and framework-free so it can be unit-tested in isolation.
 *
 * Given a dragged box and its sibling elements (+ user guides), it finds the
 * nearest edge/centre alignment within {@link SNAP_THRESHOLD} px and returns the
 * (optionally snapped) position plus the visual guide lines to render.
 */
import type { Guide } from './guides';

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

/** A snap alignment line: `axis: 'v'` is a vertical line at x=`position`. */
export interface SnapLine {
	axis: 'h' | 'v';
	position: number;
}

export interface SnapResult {
	x: number;
	y: number;
	lines: SnapLine[];
}

export function computeSnapToShape(
	dragX: number,
	dragY: number,
	dragW: number,
	dragH: number,
	siblings: SnapSibling[],
	draggedIds: Set<string>,
	guides: Guide[],
): SnapResult {
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
				if (dx < SNAP_THRESHOLD && dx < bestDx) {
					bestDx = dx;
					snapX = dragX + (ref - hr);
				}
			}
		}

		// Horizontal alignment (y-axis lines)
		for (const ref of [sib.y, sibCy, sibBottom]) {
			for (const vr of vRefs) {
				const dy = Math.abs(ref - vr);
				if (dy < SNAP_THRESHOLD && dy < bestDy) {
					bestDy = dy;
					snapY = dragY + (ref - vr);
				}
			}
		}
	}

	// Snap to user-placed guides too.
	for (const guide of guides) {
		if (guide.axis === 'v') {
			for (const hr of hRefs) {
				const dx = Math.abs(guide.position - hr);
				if (dx < SNAP_THRESHOLD && dx < bestDx) {
					bestDx = dx;
					snapX = dragX + (guide.position - hr);
				}
			}
		} else {
			for (const vr of vRefs) {
				const dy = Math.abs(guide.position - vr);
				if (dy < SNAP_THRESHOLD && dy < bestDy) {
					bestDy = dy;
					snapY = dragY + (guide.position - vr);
				}
			}
		}
	}

	// Display lines for the closest snaps found.
	if (bestDx < SNAP_THRESHOLD) {
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
	if (bestDy < SNAP_THRESHOLD) {
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
