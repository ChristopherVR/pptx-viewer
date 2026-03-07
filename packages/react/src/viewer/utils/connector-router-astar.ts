/**
 * A*-based orthogonal path search and path simplification.
 */

import type { RouterPoint, RouterRect } from "./connector-router-types";
import {
  segmentIntersectsRect,
  heuristic,
  pointKey,
} from "./connector-router-graph";

// ---------------------------------------------------------------------------
// A* search for shortest orthogonal path
// ---------------------------------------------------------------------------

export function aStarOrthogonal(
  nodes: RouterPoint[],
  start: RouterPoint,
  end: RouterPoint,
  inflated: RouterRect[],
): RouterPoint[] {
  const startKey = pointKey(start);
  const endKey = pointKey(end);

  // Build adjacency: two nodes are connected if the orthogonal L-path
  // (H then V or V then H) between them is clear
  const canConnect = (a: RouterPoint, b: RouterPoint): boolean => {
    // Only allow axis-aligned connections for orthogonal routing
    const isHorizontal = Math.abs(a.y - b.y) < 1;
    const isVertical = Math.abs(a.x - b.x) < 1;

    if (isHorizontal || isVertical) {
      for (const rect of inflated) {
        if (segmentIntersectsRect(a, b, rect)) {
          return false;
        }
      }
      return true;
    }

    // Allow L-shaped connections (two segments via a bend point)
    const bend1: RouterPoint = { x: b.x, y: a.y };
    const bend2: RouterPoint = { x: a.x, y: b.y };

    let path1Clear = true;
    let path2Clear = true;
    for (const rect of inflated) {
      if (
        path1Clear &&
        (segmentIntersectsRect(a, bend1, rect) ||
          segmentIntersectsRect(bend1, b, rect))
      ) {
        path1Clear = false;
      }
      if (
        path2Clear &&
        (segmentIntersectsRect(a, bend2, rect) ||
          segmentIntersectsRect(bend2, b, rect))
      ) {
        path2Clear = false;
      }
      if (!path1Clear && !path2Clear) break;
    }

    return path1Clear || path2Clear;
  };

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  const bendPoint = new Map<string, RouterPoint | null>();

  gScore.set(startKey, 0);
  fScore.set(endKey, heuristic(start, end));

  // Simple priority queue using sorted array
  const openSet = new Set<string>([startKey]);
  const nodeMap = new Map<string, RouterPoint>();
  for (const n of nodes) {
    nodeMap.set(pointKey(n), n);
  }

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

  const MAX_ITERATIONS = 2000;
  let iterations = 0;

  while (openSet.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const currentKey = getLowest();
    if (!currentKey) break;

    if (currentKey === endKey) {
      // Reconstruct path
      const path: RouterPoint[] = [];
      let key: string | undefined = endKey;
      while (key) {
        const node = nodeMap.get(key);
        if (node) {
          // Insert bend point if this segment had one
          const bp = bendPoint.get(key);
          if (bp) {
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
    if (!current) continue;

    for (const neighbor of nodes) {
      const neighborKey = pointKey(neighbor);
      if (neighborKey === currentKey) continue;

      if (!canConnect(current, neighbor)) continue;

      // Determine the actual distance (including potential bend)
      const isHorizontal = Math.abs(current.y - neighbor.y) < 1;
      const isVertical = Math.abs(current.x - neighbor.x) < 1;

      let dist: number;
      let bp: RouterPoint | null = null;

      if (isHorizontal || isVertical) {
        dist = heuristic(current, neighbor);
      } else {
        // L-shaped: pick the shorter valid path
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

  // Fallback: return start/end with a simple elbow
  return [start, end];
}

// ---------------------------------------------------------------------------
// Simplify: remove collinear intermediate points
// ---------------------------------------------------------------------------

export function simplifyPath(points: RouterPoint[]): RouterPoint[] {
  if (points.length <= 2) return points;
  const result: RouterPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    // Keep point only if direction changes
    const sameX =
      Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
    const sameY =
      Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
    if (!sameX && !sameY) {
      result.push(curr);
    } else if (!sameX || !sameY) {
      // Direction change - keep it
      if (!(sameX || sameY)) {
        result.push(curr);
      }
    }
  }
  result.push(points[points.length - 1]);
  return result;
}
