/**
 * Graph-building helpers for the orthogonal connector router.
 *
 * Provides geometry primitives, collision detection, and navigation graph
 * construction used by the A* search.
 */

import type { RouterPoint, RouterRect } from "./connector-router-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PADDING_DEFAULT = 12;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function inflateRect(r: RouterRect, pad: number): RouterRect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function pointInRect(p: RouterPoint, r: RouterRect): boolean {
  return (
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
  );
}

export function segmentIntersectsRect(
  a: RouterPoint,
  b: RouterPoint,
  r: RouterRect,
): boolean {
  // Check axis-aligned segment against rect
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  const rRight = r.x + r.width;
  const rBottom = r.y + r.height;

  // No overlap at all
  if (maxX < r.x || minX > rRight || maxY < r.y || minY > rBottom) {
    return false;
  }

  // Horizontal segment
  if (Math.abs(a.y - b.y) < 0.5) {
    return a.y >= r.y && a.y <= rBottom && maxX >= r.x && minX <= rRight;
  }
  // Vertical segment
  if (Math.abs(a.x - b.x) < 0.5) {
    return a.x >= r.x && a.x <= rRight && maxY >= r.y && minY <= rBottom;
  }

  return true;
}

export function directPathClear(
  start: RouterPoint,
  end: RouterPoint,
  inflated: RouterRect[],
): boolean {
  for (const rect of inflated) {
    if (segmentIntersectsRect(start, end, rect)) {
      return false;
    }
  }
  return true;
}

export function heuristic(a: RouterPoint, b: RouterPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function pointKey(p: RouterPoint): string {
  return `${Math.round(p.x)},${Math.round(p.y)}`;
}

// ---------------------------------------------------------------------------
// Build navigation graph nodes
// ---------------------------------------------------------------------------

export function buildGraphNodes(
  start: RouterPoint,
  end: RouterPoint,
  inflated: RouterRect[],
  canvasWidth: number,
  canvasHeight: number,
): RouterPoint[] {
  const nodes: RouterPoint[] = [start, end];
  const margin = 4;

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

  // Add orthogonal projection points
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
