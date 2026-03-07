/**
 * Selection bounds, snap-to-shape, clamping, and marquee geometry helpers
 * for the PowerPoint editor.
 */
import type { PptxElement } from "../../core";
import { MIN_ELEMENT_SIZE, SNAP_THRESHOLD } from "../constants";
import type { ElementBounds, MarqueeSelectionState } from "../types";

// ---------------------------------------------------------------------------
// Snap-to-shape helpers
// ---------------------------------------------------------------------------

/**
 * Compute snap-to-shape alignment lines and optionally snap a dragged
 * element's position to the nearest matching edge/center of sibling elements.
 *
 * Returns { x, y, lines } where x/y are (optionally snapped) positions and
 * lines is an array of visual guide indicators to render.
 */
export function computeSnapToShapeResult(
  dragX: number,
  dragY: number,
  dragW: number,
  dragH: number,
  siblings: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    id: string;
  }>,
  draggedIds: Set<string>,
  guides: Array<{ axis: "h" | "v"; position: number }>,
): {
  x: number;
  y: number;
  lines: Array<{ axis: "h" | "v"; position: number }>;
} {
  let bestDx = Infinity;
  let bestDy = Infinity;
  let snapX = dragX;
  let snapY = dragY;
  const lines: Array<{ axis: "h" | "v"; position: number }> = [];

  const dragCx = dragX + dragW / 2;
  const dragCy = dragY + dragH / 2;
  const dragRight = dragX + dragW;
  const dragBottom = dragY + dragH;

  // Horizontal reference points of the dragged element
  const hRefs = [dragX, dragCx, dragRight];

  // Vertical reference points of the dragged element
  const vRefs = [dragY, dragCy, dragBottom];

  for (const sib of siblings) {
    if (draggedIds.has(sib.id)) continue;

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

  // Also snap to user-placed guides
  for (const guide of guides) {
    if (guide.axis === "v") {
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

  // Compute display lines for the closest snaps found
  if (bestDx < SNAP_THRESHOLD) {
    const snappedCx = snapX + dragW / 2;
    const snappedRight = snapX + dragW;
    for (const sib of siblings) {
      if (draggedIds.has(sib.id)) continue;
      for (const ref of [sib.x, sib.x + sib.width / 2, sib.x + sib.width]) {
        if (
          Math.abs(ref - snapX) < 1 ||
          Math.abs(ref - snappedCx) < 1 ||
          Math.abs(ref - snappedRight) < 1
        ) {
          lines.push({ axis: "v", position: ref });
        }
      }
    }
    for (const g of guides) {
      if (
        g.axis === "v" &&
        (Math.abs(g.position - snapX) < 1 ||
          Math.abs(g.position - snappedCx) < 1 ||
          Math.abs(g.position - snappedRight) < 1)
      ) {
        lines.push({ axis: "v", position: g.position });
      }
    }
  }
  if (bestDy < SNAP_THRESHOLD) {
    const snappedCy = snapY + dragH / 2;
    const snappedBottom = snapY + dragH;
    for (const sib of siblings) {
      if (draggedIds.has(sib.id)) continue;
      for (const ref of [sib.y, sib.y + sib.height / 2, sib.y + sib.height]) {
        if (
          Math.abs(ref - snapY) < 1 ||
          Math.abs(ref - snappedCy) < 1 ||
          Math.abs(ref - snappedBottom) < 1
        ) {
          lines.push({ axis: "h", position: ref });
        }
      }
    }
    for (const g of guides) {
      if (
        g.axis === "h" &&
        (Math.abs(g.position - snapY) < 1 ||
          Math.abs(g.position - snappedCy) < 1 ||
          Math.abs(g.position - snappedBottom) < 1)
      ) {
        lines.push({ axis: "h", position: g.position });
      }
    }
  }

  return { x: snapX, y: snapY, lines };
}

// ---------------------------------------------------------------------------
// Bounds / clamping helpers
// ---------------------------------------------------------------------------

export function clampPosition(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

export function clampSize(value: number): number {
  return Math.max(value, MIN_ELEMENT_SIZE);
}

export function getSelectionBounds(
  elements: PptxElement[],
): ElementBounds | null {
  if (elements.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  elements.forEach((element) => {
    minX = Math.min(minX, element.x);
    minY = Math.min(minY, element.y);
    maxX = Math.max(
      maxX,
      element.x + Math.max(element.width, MIN_ELEMENT_SIZE),
    );
    maxY = Math.max(
      maxY,
      element.y + Math.max(element.height, MIN_ELEMENT_SIZE),
    );
  });

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function normalizeMarqueeRect(
  state: MarqueeSelectionState,
): ElementBounds {
  return {
    minX: Math.min(state.startX, state.currentX),
    minY: Math.min(state.startY, state.currentY),
    maxX: Math.max(state.startX, state.currentX),
    maxY: Math.max(state.startY, state.currentY),
  };
}

export function intersectsBounds(
  left: ElementBounds,
  right: ElementBounds,
): boolean {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  );
}
