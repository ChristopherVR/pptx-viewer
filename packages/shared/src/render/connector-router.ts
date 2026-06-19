/**
 * Public orthogonal connector routing API (shared across bindings).
 *
 * Two equivalent entry points are exported so the React and Angular consumers
 * keep their exact import surface:
 * - {@link routeConnector} — React-style options object; `[start, end]`
 *   fallbacks; pairs with {@link waypointsToPathData} (space-separated `M x y`).
 * - {@link routeOrthogonalConnector} — Angular-style positional args with
 *   optional canvas dims (sentinel default); pairs with {@link waypointsToPathD}
 *   (comma-separated `Mx,y`).
 *
 * Both routers share one implementation; only the argument shape and the
 * default-canvas handling differ.
 */

import { aStarOrthogonal, simplifyPath } from './connector-router-astar';
import {
	inflateRect,
	directPathClear,
	segmentIntersectsRect,
	buildGraphNodes,
} from './connector-router-graph';
import { PADDING_DEFAULT, CANVAS_SENTINEL } from './connector-router-types';
import type {
	ConnectorRouterOptions,
	OrthogonalRouterOptions,
	RouterPoint,
	RouterRect,
} from './connector-router-types';

export type {
	RouterPoint,
	RouterRect,
	ConnectorRouterOptions,
	OrthogonalRouterOptions,
} from './connector-router-types';

export {
	PADDING_DEFAULT,
	ROUTING_PADDING_DEFAULT,
	CANVAS_SENTINEL,
} from './connector-router-types';

export {
	inflateRect,
	pointInRect,
	segmentIntersectsRect,
	directPathClear,
	heuristic,
	pointKey,
	buildGraphNodes,
} from './connector-router-graph';

export { aStarOrthogonal, simplifyPath } from './connector-router-astar';

// ---------------------------------------------------------------------------
// Shared routing core
// ---------------------------------------------------------------------------

/**
 * Route an orthogonal connector between `start` and `end`, avoiding all
 * `obstacles`. Returns waypoints (including `start`/`end`) forming an
 * axis-aligned polyline.
 *
 * Strategy (fast-path first, A* as fallback):
 * 1. No obstacles → `[start, end]`.
 * 2. Direct line clear → `[start, end]`.
 * 3. Single horizontal elbow clear → use it.
 * 4. Single vertical elbow clear → use it.
 * 5. Full A* search on the navigation graph.
 */
function routeCore(
	start: RouterPoint,
	end: RouterPoint,
	obstacles: ReadonlyArray<RouterRect>,
	padding: number,
	canvasWidth: number,
	canvasHeight: number,
): RouterPoint[] {
	if (obstacles.length === 0) {
		return [start, end];
	}

	const inflated = obstacles.map((r) => inflateRect(r, padding));

	if (directPathClear(start, end, inflated)) {
		return [start, end];
	}

	// Try a single elbow first (faster than full A*).
	const midH: RouterPoint = { x: end.x, y: start.y };
	const midV: RouterPoint = { x: start.x, y: end.y };
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
// React-style API
// ---------------------------------------------------------------------------

/**
 * Route a connector between two points, avoiding obstacle bounding boxes.
 * Returns an array of waypoints (including start and end) forming an orthogonal
 * polyline. (React-style options object.)
 */
export function routeConnector(options: ConnectorRouterOptions): RouterPoint[] {
	const { start, end, obstacles, canvasWidth, canvasHeight, padding = PADDING_DEFAULT } = options;
	return routeCore(start, end, obstacles, padding, canvasWidth, canvasHeight);
}

/** Convert an array of waypoints to an SVG path `d` string (space-separated). */
export function waypointsToPathData(waypoints: ReadonlyArray<RouterPoint>): string {
	if (waypoints.length === 0) {
		return '';
	}
	const parts = [`M ${waypoints[0].x} ${waypoints[0].y}`];
	for (let i = 1; i < waypoints.length; i++) {
		parts.push(`L ${waypoints[i].x} ${waypoints[i].y}`);
	}
	return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Angular-style API
// ---------------------------------------------------------------------------

/**
 * Route an orthogonal connector (positional args, optional canvas dims).
 * Canvas dimensions default to a large sentinel when omitted.
 */
export function routeOrthogonalConnector(
	start: RouterPoint,
	end: RouterPoint,
	obstacles: ReadonlyArray<RouterRect>,
	opts?: Pick<OrthogonalRouterOptions, 'canvasWidth' | 'canvasHeight' | 'padding'>,
): RouterPoint[] {
	const padding = opts?.padding ?? PADDING_DEFAULT;
	const canvasWidth = opts?.canvasWidth ?? CANVAS_SENTINEL;
	const canvasHeight = opts?.canvasHeight ?? CANVAS_SENTINEL;
	return routeCore(start, end, obstacles, padding, canvasWidth, canvasHeight);
}

/** Convert an array of waypoints to an SVG path `d` string (comma-separated). */
export function waypointsToPathD(waypoints: ReadonlyArray<RouterPoint>): string {
	if (waypoints.length === 0) {
		return '';
	}
	const parts: string[] = [`M${waypoints[0].x},${waypoints[0].y}`];
	for (let i = 1; i < waypoints.length; i++) {
		parts.push(`L${waypoints[i].x},${waypoints[i].y}`);
	}
	return parts.join(' ');
}
