/**
 * Graph-building helpers for the orthogonal connector router.
 *
 * Provides geometry primitives, collision detection, and navigation-graph
 * construction used by the A* search. Pure (no framework imports).
 */

import type { RouterPoint, RouterRect } from './connector-router-types';

export { PADDING_DEFAULT } from './connector-router-types';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Expand a rect by `pad` pixels on every side. Returns a new rect. */
export function inflateRect(r: RouterRect, pad: number): RouterRect {
	return {
		x: r.x - pad,
		y: r.y - pad,
		width: r.width + pad * 2,
		height: r.height + pad * 2,
	};
}

/** Return true when point `p` lies inside (or on the border of) `r`. */
export function pointInRect(p: RouterPoint, r: RouterRect): boolean {
	return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/**
 * Return true when the axis-aligned segment `a→b` intersects rectangle `r`.
 *
 * Only horizontal and vertical segments are handled exactly; diagonal segments
 * are treated as intersecting (safe / conservative fallback).
 */
export function segmentIntersectsRect(a: RouterPoint, b: RouterPoint, r: RouterRect): boolean {
	const minX = Math.min(a.x, b.x);
	const maxX = Math.max(a.x, b.x);
	const minY = Math.min(a.y, b.y);
	const maxY = Math.max(a.y, b.y);

	const rRight = r.x + r.width;
	const rBottom = r.y + r.height;

	// Quick reject: bounding boxes don't overlap.
	if (maxX < r.x || minX > rRight || maxY < r.y || minY > rBottom) {
		return false;
	}

	// Horizontal segment.
	if (Math.abs(a.y - b.y) < 0.5) {
		return a.y >= r.y && a.y <= rBottom && maxX >= r.x && minX <= rRight;
	}
	// Vertical segment.
	if (Math.abs(a.x - b.x) < 0.5) {
		return a.x >= r.x && a.x <= rRight && maxY >= r.y && minY <= rBottom;
	}

	// Diagonal — conservative: treat as intersecting.
	return true;
}

/**
 * Return true when the direct segment `start→end` is clear of all inflated
 * obstacle rectangles.
 */
export function directPathClear(
	start: RouterPoint,
	end: RouterPoint,
	inflated: ReadonlyArray<RouterRect>,
): boolean {
	for (const rect of inflated) {
		if (segmentIntersectsRect(start, end, rect)) {
			return false;
		}
	}
	return true;
}

/** Manhattan-distance heuristic for A*. */
export function heuristic(a: RouterPoint, b: RouterPoint): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Stable string key for a point (rounded to nearest pixel). Used as Map keys. */
export function pointKey(p: RouterPoint): string {
	return `${Math.round(p.x)},${Math.round(p.y)}`;
}

// ---------------------------------------------------------------------------
// Build navigation graph nodes
// ---------------------------------------------------------------------------

/**
 * Build the set of candidate navigation nodes for A*:
 * - Start and end points.
 * - Corners of each inflated obstacle (with a small clearance margin).
 * - Orthogonal projections of every node onto start/end rows and columns.
 *
 * Nodes that fall inside an obstacle or outside the canvas are discarded.
 */
export function buildGraphNodes(
	start: RouterPoint,
	end: RouterPoint,
	inflated: ReadonlyArray<RouterRect>,
	canvasWidth: number,
	canvasHeight: number,
): RouterPoint[] {
	const margin = 4;
	const nodes: RouterPoint[] = [start, end];

	for (const r of inflated) {
		const corners: RouterPoint[] = [
			{ x: r.x - margin, y: r.y - margin },
			{ x: r.x + r.width + margin, y: r.y - margin },
			{ x: r.x - margin, y: r.y + r.height + margin },
			{ x: r.x + r.width + margin, y: r.y + r.height + margin },
		];
		for (const c of corners) {
			if (c.x >= 0 && c.x <= canvasWidth && c.y >= 0 && c.y <= canvasHeight) {
				let blocked = false;
				for (const rect of inflated) {
					if (pointInRect(c, rect)) {
						blocked = true;
						break;
					}
				}
				if (!blocked) {
					nodes.push(c);
				}
			}
		}
	}

	// Orthogonal projections: for every existing node, add axis-aligned
	// intersection points with the start and end rows/columns.
	const projections: RouterPoint[] = [];
	for (const node of nodes) {
		projections.push({ x: start.x, y: node.y });
		projections.push({ x: node.x, y: start.y });
		projections.push({ x: end.x, y: node.y });
		projections.push({ x: node.x, y: end.y });
	}

	for (const p of projections) {
		if (p.x >= 0 && p.x <= canvasWidth && p.y >= 0 && p.y <= canvasHeight) {
			let blocked = false;
			for (const rect of inflated) {
				if (pointInRect(p, rect)) {
					blocked = true;
					break;
				}
			}
			if (!blocked) {
				nodes.push(p);
			}
		}
	}

	return nodes;
}
