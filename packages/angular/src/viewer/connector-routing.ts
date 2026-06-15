/**
 * Pure, framework-agnostic A* orthogonal connector router.
 *
 * Angular port of the React connector-router suite:
 *   packages/react/src/viewer/utils/connector-router.ts
 *   packages/react/src/viewer/utils/connector-router-graph.ts
 *   packages/react/src/viewer/utils/connector-router-astar.ts
 *
 * All logic is consolidated into this single file (no barrel split needed for
 * an Angular helper module). Compatible with `connector-path.ts` / the
 * `ConnectorRendererComponent`: pass the returned `Point[]` to
 * `waypointsToPathD()` to obtain the SVG `d` attribute string that the
 * component renders on a `<path>`.
 *
 * Constraints kept from the React source:
 *  - No `any`.
 *  - No `String.prototype.replaceAll` / named regex capture groups.
 *  - No `Math.random` / `Date` — fully deterministic.
 *  - No Angular / Vue / React imports.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A 2-D point in pixel space. */
export interface Point {
	x: number;
	y: number;
}

/** An axis-aligned bounding rectangle in pixel space. */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Options for {@link routeOrthogonalConnector}. */
export interface OrthogonalRouterOptions {
	/** Start point (absolute pixel coordinates). */
	start: Point;
	/** End point (absolute pixel coordinates). */
	end: Point;
	/** Obstacle bounding boxes the path must avoid. */
	obstacles: ReadonlyArray<Rect>;
	/**
	 * Width of the routing canvas (used to clip candidate nodes to valid area).
	 * Defaults to a large sentinel when omitted.
	 */
	canvasWidth?: number;
	/**
	 * Height of the routing canvas.
	 * Defaults to a large sentinel when omitted.
	 */
	canvasHeight?: number;
	/**
	 * Padding (in pixels) expanded around each obstacle to keep the path
	 * away from obstacle edges. Default: {@link ROUTING_PADDING_DEFAULT}.
	 */
	padding?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default obstacle padding in pixels. */
export const ROUTING_PADDING_DEFAULT = 12;

/** Safety cap on A* iterations to avoid O(n²) hangs on degenerate inputs. */
const MAX_ASTAR_ITERATIONS = 2000;

/** Sentinel canvas size when caller does not supply one. */
const CANVAS_SENTINEL = 100_000;

// ---------------------------------------------------------------------------
// Geometry helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Expand a rect by `pad` pixels on every side. Returns a new Rect.
 */
export function inflateRect(r: Rect, pad: number): Rect {
	return {
		x: r.x - pad,
		y: r.y - pad,
		width: r.width + pad * 2,
		height: r.height + pad * 2,
	};
}

/**
 * Return true when point `p` lies strictly inside (or on the border of) `r`.
 */
export function pointInRect(p: Point, r: Rect): boolean {
	return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/**
 * Return true when the axis-aligned segment `a→b` intersects rectangle `r`.
 *
 * Only horizontal and vertical segments are handled; diagonal segments are
 * treated as intersecting (safe / conservative fallback).
 */
export function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {
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
export function directPathClear(start: Point, end: Point, inflated: ReadonlyArray<Rect>): boolean {
	for (const rect of inflated) {
		if (segmentIntersectsRect(start, end, rect)) {
			return false;
		}
	}
	return true;
}

/** Manhattan-distance heuristic for A*. */
export function heuristic(a: Point, b: Point): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Stable string key for a point (rounded to nearest pixel).
 * Used as Map keys in A*.
 */
export function pointKey(p: Point): string {
	return `${Math.round(p.x)},${Math.round(p.y)}`;
}

// ---------------------------------------------------------------------------
// Navigation graph construction
// ---------------------------------------------------------------------------

/**
 * Build the set of candidate navigation nodes for A*:
 * - Start and end points.
 * - Corners of each inflated obstacle (with a small clearance margin).
 * - Orthogonal projections of every node onto every other node's row/column.
 *
 * Nodes that fall inside an obstacle or outside the canvas are discarded.
 */
export function buildGraphNodes(
	start: Point,
	end: Point,
	inflated: ReadonlyArray<Rect>,
	canvasWidth: number,
	canvasHeight: number,
): Point[] {
	const cornerMargin = 4;
	const nodes: Point[] = [start, end];

	for (const r of inflated) {
		const corners: Point[] = [
			{ x: r.x - cornerMargin, y: r.y - cornerMargin },
			{ x: r.x + r.width + cornerMargin, y: r.y - cornerMargin },
			{ x: r.x - cornerMargin, y: r.y + r.height + cornerMargin },
			{ x: r.x + r.width + cornerMargin, y: r.y + r.height + cornerMargin },
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
	// intersection points with start and end rows/columns.
	const projections: Point[] = [];
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

// ---------------------------------------------------------------------------
// A* search
// ---------------------------------------------------------------------------

/**
 * Run A* over the navigation graph to find the shortest orthogonal path
 * from `start` to `end` that avoids all `inflated` obstacle rectangles.
 *
 * Returns an array of waypoints (possibly including intermediate bend points
 * when L-shaped edges are taken). Falls back to `[start, end]` when no path
 * is found within {@link MAX_ASTAR_ITERATIONS}.
 */
export function aStarOrthogonal(
	nodes: ReadonlyArray<Point>,
	start: Point,
	end: Point,
	inflated: ReadonlyArray<Rect>,
): Point[] {
	const startKey = pointKey(start);
	const endKey = pointKey(end);

	/**
	 * Check whether two nodes can be directly connected (axis-aligned or
	 * L-shaped) without crossing an obstacle.
	 */
	const canConnect = (a: Point, b: Point): boolean => {
		const isHoriz = Math.abs(a.y - b.y) < 1;
		const isVert = Math.abs(a.x - b.x) < 1;

		if (isHoriz || isVert) {
			// Straight segment.
			for (const rect of inflated) {
				if (segmentIntersectsRect(a, b, rect)) {
					return false;
				}
			}
			return true;
		}

		// L-shaped: try both bend orientations.
		const bend1: Point = { x: b.x, y: a.y };
		const bend2: Point = { x: a.x, y: b.y };

		let path1Clear = true;
		let path2Clear = true;

		for (const rect of inflated) {
			if (
				path1Clear &&
				(segmentIntersectsRect(a, bend1, rect) || segmentIntersectsRect(bend1, b, rect))
			) {
				path1Clear = false;
			}
			if (
				path2Clear &&
				(segmentIntersectsRect(a, bend2, rect) || segmentIntersectsRect(bend2, b, rect))
			) {
				path2Clear = false;
			}
			if (!path1Clear && !path2Clear) {
				break;
			}
		}

		return path1Clear || path2Clear;
	};

	const gScore = new Map<string, number>();
	const fScore = new Map<string, number>();
	const cameFrom = new Map<string, string>();
	/** When an L-shaped edge was used to reach this node, the bend point. */
	const bendPoint = new Map<string, Point | null>();

	gScore.set(startKey, 0);
	fScore.set(startKey, heuristic(start, end));

	const openSet = new Set<string>([startKey]);
	const nodeMap = new Map<string, Point>();
	for (const n of nodes) {
		nodeMap.set(pointKey(n), n);
	}

	/** Pop the node with the lowest fScore from the open set. */
	const getLowest = (): string | undefined => {
		let best: string | undefined;
		let bestScore = Infinity;
		for (const key of openSet) {
			const score = fScore.get(key) ?? Infinity;
			if (score < bestScore) {
				bestScore = score;
				best = key;
			}
		}
		return best;
	};

	let iterations = 0;

	while (openSet.size > 0 && iterations < MAX_ASTAR_ITERATIONS) {
		iterations++;
		const currentKey = getLowest();
		if (currentKey === undefined) {
			break;
		}

		if (currentKey === endKey) {
			// Reconstruct the path from cameFrom chain.
			const path: Point[] = [];
			let key: string | undefined = endKey;
			while (key !== undefined) {
				const node = nodeMap.get(key);
				if (node !== undefined) {
					const bp = bendPoint.get(key);
					if (bp !== undefined && bp !== null) {
						path.unshift(node);
						path.unshift(bp);
					} else {
						path.unshift(node);
					}
				}
				key = cameFrom.get(key);
			}
			return path;
		}

		openSet.delete(currentKey);
		const current = nodeMap.get(currentKey);
		if (current === undefined) {
			continue;
		}

		for (const neighbor of nodes) {
			const neighborKey = pointKey(neighbor);
			if (neighborKey === currentKey) {
				continue;
			}
			if (!canConnect(current, neighbor)) {
				continue;
			}

			const isHoriz = Math.abs(current.y - neighbor.y) < 1;
			const isVert = Math.abs(current.x - neighbor.x) < 1;

			let dist: number;
			let bp: Point | null = null;

			if (isHoriz || isVert) {
				dist = heuristic(current, neighbor);
			} else {
				// L-shaped: pick the shorter valid bend.
				const bend1: Point = { x: neighbor.x, y: current.y };
				const bend2: Point = { x: current.x, y: neighbor.y };
				let use1 = true;
				for (const rect of inflated) {
					if (
						segmentIntersectsRect(current, bend1, rect) ||
						segmentIntersectsRect(bend1, neighbor, rect)
					) {
						use1 = false;
						break;
					}
				}
				bp = use1 ? bend1 : bend2;
				dist =
					Math.abs(current.x - bp.x) +
					Math.abs(current.y - bp.y) +
					Math.abs(bp.x - neighbor.x) +
					Math.abs(bp.y - neighbor.y);
			}

			const tentativeG = (gScore.get(currentKey) ?? Infinity) + dist;
			if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
				cameFrom.set(neighborKey, currentKey);
				bendPoint.set(neighborKey, bp);
				gScore.set(neighborKey, tentativeG);
				fScore.set(neighborKey, tentativeG + heuristic(neighbor, end));
				openSet.add(neighborKey);
			}
		}
	}

	// No path found — fall back to a direct two-point path.
	return [start, end];
}

// ---------------------------------------------------------------------------
// Path simplification
// ---------------------------------------------------------------------------

/**
 * Remove collinear intermediate waypoints from a path.
 *
 * A waypoint is dropped when the previous and next waypoints share the same
 * axis as both flanking segments (i.e. three consecutive collinear points).
 * This keeps the output minimal while preserving every directional change.
 */
export function simplifyPath(points: ReadonlyArray<Point>): Point[] {
	if (points.length <= 2) {
		return [...points];
	}
	const result: Point[] = [points[0]];
	for (let i = 1; i < points.length - 1; i++) {
		const prev = result[result.length - 1];
		const curr = points[i];
		const next = points[i + 1];
		const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
		const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
		// Drop only when strictly collinear on one axis.
		if (!sameX && !sameY) {
			result.push(curr);
		} else if (!sameX || !sameY) {
			// One axis matches — still a direction change if the other doesn't.
			if (!(sameX || sameY)) {
				result.push(curr);
			}
		}
		// else: fully collinear on both axes → drop.
	}
	result.push(points[points.length - 1]);
	return result;
}

// ---------------------------------------------------------------------------
// Public routing API
// ---------------------------------------------------------------------------

/**
 * Route an orthogonal connector between `start` and `end`, avoiding all
 * `obstacles`. Returns a list of waypoints (including the start and end
 * points) that form an axis-aligned polyline.
 *
 * Strategy (fast-path first, A* as fallback):
 * 1. No obstacles → return `[start, end]` directly.
 * 2. Direct line clear → return `[start, end]`.
 * 3. Single horizontal elbow (`start → (end.x, start.y) → end`) clear → use it.
 * 4. Single vertical elbow (`start → (start.x, end.y) → end`) clear → use it.
 * 5. Full A* search on the navigation graph.
 */
export function routeOrthogonalConnector(
	start: Point,
	end: Point,
	obstacles: ReadonlyArray<Rect>,
	opts?: Pick<OrthogonalRouterOptions, 'canvasWidth' | 'canvasHeight' | 'padding'>,
): Point[] {
	const padding = opts?.padding ?? ROUTING_PADDING_DEFAULT;
	const canvasWidth = opts?.canvasWidth ?? CANVAS_SENTINEL;
	const canvasHeight = opts?.canvasHeight ?? CANVAS_SENTINEL;

	if (obstacles.length === 0) {
		return [start, end];
	}

	const inflated = obstacles.map((r) => inflateRect(r, padding));

	if (directPathClear(start, end, inflated)) {
		return [start, end];
	}

	// Try single horizontal elbow.
	const midH: Point = { x: end.x, y: start.y };
	const midV: Point = { x: start.x, y: end.y };
	let elbowHClear = true;
	let elbowVClear = true;

	for (const rect of inflated) {
		if (
			elbowHClear &&
			(segmentIntersectsRect(start, midH, rect) || segmentIntersectsRect(midH, end, rect))
		) {
			elbowHClear = false;
		}
		if (
			elbowVClear &&
			(segmentIntersectsRect(start, midV, rect) || segmentIntersectsRect(midV, end, rect))
		) {
			elbowVClear = false;
		}
		if (!elbowHClear && !elbowVClear) {
			break;
		}
	}

	if (elbowHClear) {
		return [start, midH, end];
	}
	if (elbowVClear) {
		return [start, midV, end];
	}

	// Full A* search.
	const nodes = buildGraphNodes(start, end, inflated, canvasWidth, canvasHeight);
	const path = aStarOrthogonal(nodes, start, end, inflated);
	return simplifyPath(path);
}

// ---------------------------------------------------------------------------
// SVG path serialisation
// ---------------------------------------------------------------------------

/**
 * Convert an array of waypoints to an SVG `path` `d` attribute string.
 *
 * Returns an empty string for an empty waypoint array, `"M x y"` for a
 * single point, and `"M x y L x1 y1 …"` for a polyline.
 *
 * This output is compatible with the `pathD` field on `ConnectorGeometry`
 * from `connector-path.ts` and can be bound directly to a `<path [attr.d]>`.
 */
export function waypointsToPathD(waypoints: ReadonlyArray<Point>): string {
	if (waypoints.length === 0) {
		return '';
	}
	const parts: string[] = [`M${waypoints[0].x},${waypoints[0].y}`];
	for (let i = 1; i < waypoints.length; i++) {
		parts.push(`L${waypoints[i].x},${waypoints[i].y}`);
	}
	return parts.join(' ');
}
