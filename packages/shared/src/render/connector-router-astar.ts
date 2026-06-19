/**
 * A*-based orthogonal path search and path simplification.
 *
 * Pure (no framework imports). Deterministic — no Math.random / Date.
 */

import { segmentIntersectsRect, heuristic, pointKey } from './connector-router-graph';
import type { RouterPoint, RouterRect } from './connector-router-types';

/** Safety cap on A* iterations to avoid O(n²) hangs on degenerate inputs. */
const MAX_ASTAR_ITERATIONS = 2000;

/**
 * Run A* over the navigation graph to find the shortest orthogonal path from
 * `start` to `end` that avoids all `inflated` obstacle rectangles.
 *
 * Returns an array of waypoints (possibly including intermediate bend points
 * when L-shaped edges are taken). Falls back to `[start, end]` when no path is
 * found within {@link MAX_ASTAR_ITERATIONS}.
 */
export function aStarOrthogonal(
	nodes: ReadonlyArray<RouterPoint>,
	start: RouterPoint,
	end: RouterPoint,
	inflated: ReadonlyArray<RouterRect>,
): RouterPoint[] {
	const startKey = pointKey(start);
	const endKey = pointKey(end);

	// Two nodes are connectable if the orthogonal (axis-aligned or L-shaped)
	// path between them is clear of every obstacle.
	const canConnect = (a: RouterPoint, b: RouterPoint): boolean => {
		const isHoriz = Math.abs(a.y - b.y) < 1;
		const isVert = Math.abs(a.x - b.x) < 1;

		if (isHoriz || isVert) {
			for (const rect of inflated) {
				if (segmentIntersectsRect(a, b, rect)) {
					return false;
				}
			}
			return true;
		}

		// L-shaped: try both bend orientations.
		const bend1: RouterPoint = { x: b.x, y: a.y };
		const bend2: RouterPoint = { x: a.x, y: b.y };

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
	const bendPoint = new Map<string, RouterPoint | null>();

	gScore.set(startKey, 0);
	fScore.set(startKey, heuristic(start, end));

	const openSet = new Set<string>([startKey]);
	const nodeMap = new Map<string, RouterPoint>();
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
			// Reconstruct the path from the cameFrom chain.
			const path: RouterPoint[] = [];
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
			let bp: RouterPoint | null = null;

			if (isHoriz || isVert) {
				dist = heuristic(current, neighbor);
			} else {
				// L-shaped: pick the shorter valid bend.
				const bend1: RouterPoint = { x: neighbor.x, y: current.y };
				const bend2: RouterPoint = { x: current.x, y: neighbor.y };
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
 * A waypoint is dropped when the previous and next waypoints are collinear on
 * both axes with it (three consecutive collinear points). Every directional
 * change is preserved.
 */
export function simplifyPath(points: ReadonlyArray<RouterPoint>): RouterPoint[] {
	if (points.length <= 2) {
		return [...points];
	}
	const result: RouterPoint[] = [points[0]];
	for (let i = 1; i < points.length - 1; i++) {
		const prev = result[result.length - 1];
		const curr = points[i];
		const next = points[i + 1];
		const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
		const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
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
