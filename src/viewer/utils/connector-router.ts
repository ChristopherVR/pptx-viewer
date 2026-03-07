/**
 * A*-based orthogonal connector router.
 *
 * Barrel re-export - implementation split into:
 * - `connector-router-types` (type definitions)
 * - `connector-router-graph` (geometry helpers + graph building)
 * - `connector-router-astar` (A* search + path simplification)
 */

export type {
  RouterPoint,
  RouterRect,
  ConnectorRouterOptions,
} from "./connector-router-types";

export {
  PADDING_DEFAULT,
  inflateRect,
  pointInRect,
  segmentIntersectsRect,
  directPathClear,
  heuristic,
  pointKey,
  buildGraphNodes,
} from "./connector-router-graph";

export { aStarOrthogonal, simplifyPath } from "./connector-router-astar";

import type { ConnectorRouterOptions } from "./connector-router-types";
import type { RouterPoint } from "./connector-router-types";
import {
  PADDING_DEFAULT,
  inflateRect,
  directPathClear,
  segmentIntersectsRect,
  buildGraphNodes,
} from "./connector-router-graph";
import { aStarOrthogonal, simplifyPath } from "./connector-router-astar";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route a connector between two points, avoiding obstacle bounding boxes.
 * Returns an array of waypoints (including start and end) forming an
 * orthogonal polyline.
 */
export function routeConnector(options: ConnectorRouterOptions): RouterPoint[] {
  const {
    start,
    end,
    obstacles,
    canvasWidth,
    canvasHeight,
    padding = PADDING_DEFAULT,
  } = options;

  // No obstacles - direct path
  if (obstacles.length === 0) {
    return [start, end];
  }

  const inflated = obstacles.map((r) => inflateRect(r, padding));

  // If the direct line is clear, use it
  if (directPathClear(start, end, inflated)) {
    return [start, end];
  }

  // Try a simple elbow first (faster than full A*)
  const midH: RouterPoint = { x: end.x, y: start.y };
  const midV: RouterPoint = { x: start.x, y: end.y };
  let elbowHClear = true;
  let elbowVClear = true;

  for (const rect of inflated) {
    if (
      elbowHClear &&
      (segmentIntersectsRect(start, midH, rect) ||
        segmentIntersectsRect(midH, end, rect))
    ) {
      elbowHClear = false;
    }
    if (
      elbowVClear &&
      (segmentIntersectsRect(start, midV, rect) ||
        segmentIntersectsRect(midV, end, rect))
    ) {
      elbowVClear = false;
    }
    if (!elbowHClear && !elbowVClear) break;
  }

  if (elbowHClear) return [start, midH, end];
  if (elbowVClear) return [start, midV, end];

  // Full A* search
  const nodes = buildGraphNodes(
    start,
    end,
    inflated,
    canvasWidth,
    canvasHeight,
  );
  const path = aStarOrthogonal(nodes, start, end, inflated);
  return simplifyPath(path);
}

/**
 * Convert an array of waypoints to an SVG path data string.
 */
export function waypointsToPathData(waypoints: RouterPoint[]): string {
  if (waypoints.length === 0) return "";
  const parts = [`M ${waypoints[0].x} ${waypoints[0].y}`];
  for (let i = 1; i < waypoints.length; i++) {
    parts.push(`L ${waypoints[i].x} ${waypoints[i].y}`);
  }
  return parts.join(" ");
}
