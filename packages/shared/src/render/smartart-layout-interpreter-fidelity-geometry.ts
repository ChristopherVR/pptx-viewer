/**
 * Fidelity corpus - pure geometry assertions for the SmartArt DiagramML
 * interpreter verification suite.
 *
 * Framework-free predicates used by the fidelity tests to check the STRUCTURAL
 * properties the interpreter must preserve (not pixel-parity with PowerPoint):
 * every rendered node stays inside the result viewBox, sibling rects do not
 * substantially overlap, and connector endpoints land on placed nodes. No DOM,
 * no framework code - only arithmetic over the `RenderedNode` view-models.
 */

import type { RenderedConnector, RenderedNode, RenderedRectNode } from './smartart-layout-types';

/** Parsed `"0 0 W H"` viewBox extents. */
export interface ViewExtent {
	w: number;
	h: number;
}

/** Read the `W`/`H` out of a `"0 0 W H"` viewBox string. */
export function parseViewBox(viewBox: string): ViewExtent {
	const parts = viewBox.trim().split(/\s+/u).map(Number);
	return { w: parts[2] ?? 0, h: parts[3] ?? 0 };
}

/** Axis-aligned bounding box `[minX, minY, maxX, maxY]`. */
export interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** Parse an SVG polygon `points` string into its bounding box. */
export function polygonBounds(points: string): Bounds {
	const coords = points.trim().split(/\s+/u);
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const pair of coords) {
		const [x, y] = pair.split(',').map(Number);
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	return { minX, minY, maxX, maxY };
}

/** Bounding box of a single rendered node, whatever its kind. */
export function nodeBounds(node: RenderedNode): Bounds {
	if (node.kind === 'rect') {
		return { minX: node.x, minY: node.y, maxX: node.x + node.width, maxY: node.y + node.height };
	}
	if (node.kind === 'circle') {
		return {
			minX: node.cx - node.r,
			minY: node.cy - node.r,
			maxX: node.cx + node.r,
			maxY: node.cy + node.r,
		};
	}
	return polygonBounds(node.points);
}

/** True when every rendered node lies inside `[0,w] x [0,h]` (with tolerance). */
export function nodesWithinViewBox(
	nodes: readonly RenderedNode[],
	w: number,
	h: number,
	tol = 0.75,
): boolean {
	return nodes.every((node) => {
		const b = nodeBounds(node);
		return b.minX >= -tol && b.minY >= -tol && b.maxX <= w + tol && b.maxY <= h + tol;
	});
}

/** Extract every `x,y` coordinate pair from an SVG path `d` string. */
export function pathPoints(d: string): Array<{ x: number; y: number }> {
	const matches = d.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/gu) ?? [];
	return matches.map((pair) => {
		const [x, y] = pair.split(',').map(Number);
		return { x, y };
	});
}

/** True when both endpoints (first + last path coords) sit inside the viewBox. */
export function connectorEndpointsWithin(
	connectors: readonly RenderedConnector[],
	w: number,
	h: number,
	tol = 0.75,
): boolean {
	return connectors.every((connector) => {
		const points = pathPoints(connector.d);
		if (points.length === 0) {
			return true;
		}
		const ends = [points[0], points[points.length - 1]];
		return ends.every((p) => p.x >= -tol && p.y >= -tol && p.x <= w + tol && p.y <= h + tol);
	});
}

/** Intersection area of two rects (0 when disjoint). */
function intersectionArea(a: RenderedRectNode, b: RenderedRectNode): number {
	const dx = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
	const dy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
	return dx > 0 && dy > 0 ? dx * dy : 0;
}

/**
 * Largest pairwise overlap between rects as a fraction of the smaller rect's
 * area (0 when nothing overlaps). Siblings should be near-zero.
 */
export function maxRectOverlapFraction(rects: readonly RenderedRectNode[]): number {
	let worst = 0;
	for (let i = 0; i < rects.length; i++) {
		for (let j = i + 1; j < rects.length; j++) {
			const area = intersectionArea(rects[i], rects[j]);
			if (area <= 0) {
				continue;
			}
			const minArea = Math.max(
				1,
				Math.min(rects[i].width * rects[i].height, rects[j].width * rects[j].height),
			);
			worst = Math.max(worst, area / minArea);
		}
	}
	return worst;
}

/** True when no two circles overlap (centre distance >= sum of radii - tol). */
export function circlesSeparated(
	circles: ReadonlyArray<{ cx: number; cy: number; r: number }>,
	tol = 1,
): boolean {
	for (let i = 0; i < circles.length; i++) {
		for (let j = i + 1; j < circles.length; j++) {
			const a = circles[i];
			const b = circles[j];
			const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
			if (dist + tol < a.r + b.r) {
				return false;
			}
		}
	}
	return true;
}
