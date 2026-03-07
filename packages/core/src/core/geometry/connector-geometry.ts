/**
 * Framework-agnostic connector geometry calculations.
 *
 * Computes SVG path data for straight, bent, and curved connectors.
 */
import type { PptxElementWithShapeStyle } from "../types";
import { clampUnitInterval } from "../color/color-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectorPathGeometry {
  pathData: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getConnectorAdjustment(
  element: PptxElementWithShapeStyle,
  key: string,
  fallback: number,
): number {
  const direct = element.shapeAdjustments?.[key];
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return clampUnitInterval(direct / 100000);
  }

  const fallbackKey = element.shapeAdjustments?.adj;
  if (typeof fallbackKey === "number" && Number.isFinite(fallbackKey)) {
    return clampUnitInterval(fallbackKey / 100000);
  }

  return clampUnitInterval(fallback);
}

// ---------------------------------------------------------------------------
// Main path calculation
// ---------------------------------------------------------------------------

export function getConnectorPathGeometry(
  element: PptxElementWithShapeStyle,
): ConnectorPathGeometry {
  const width = Math.max(element.width, 1);
  const height = Math.max(element.height, 1);
  const normalizedType = (element.shapeType || "").toLowerCase();
  const point = (x: number, y: number) => `${Math.round(x)} ${Math.round(y)}`;
  const startX = 0;
  const startY = 0;
  const endX = width;
  const endY = height;

  // ── bentConnector5 — 4-segment elbow ──────────────────────────────
  if (normalizedType.includes("bentconnector5")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.5);
    const adj3 = getConnectorAdjustment(element, "adj3", 0.5);
    const x1 = width * adj1;
    const yMid = height * adj2;
    const x2 = width * adj3;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(x1, 0)} L ${point(x1, yMid)} L ${point(x2, yMid)} L ${point(x2, height)} L ${point(width, height)}`,
    };
  }

  // ── bentConnector4 — 3-segment elbow ──────────────────────────────
  if (normalizedType.includes("bentconnector4")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.5);
    const midX = width * adj1;
    const midY = height * adj2;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(midX, 0)} L ${point(midX, midY)} L ${point(width, midY)} L ${point(width, height)}`,
    };
  }

  // ── bentConnector3 — 2-segment elbow (Z-shape) ────────────────────
  if (normalizedType.includes("bentconnector3")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const midX = width * adj1;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(midX, 0)} L ${point(midX, height)} L ${point(width, height)}`,
    };
  }

  // ── bentConnector2 — L-shape ──────────────────────────────────────
  if (normalizedType.includes("bentconnector2")) {
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(width, 0)} L ${point(width, height)}`,
    };
  }

  // ── curvedConnector5 — 4-segment cubic Bézier ─────────────────────
  if (normalizedType.includes("curvedconnector5")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.5);
    const adj3 = getConnectorAdjustment(element, "adj3", 0.5);
    const x1 = width * adj1;
    const yMid = height * adj2;
    const x2 = width * adj3;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} C ${point(x1, 0)} ${point(x1, 0)} ${point(x1, yMid * 0.5)} C ${point(x1, yMid)} ${point(x1, yMid)} ${point((x1 + x2) / 2, yMid)} C ${point(x2, yMid)} ${point(x2, yMid)} ${point(x2, (yMid + height) / 2)} C ${point(x2, height)} ${point(x2, height)} ${point(width, height)}`,
    };
  }

  // ── curvedConnector4 — 3-segment cubic Bézier ─────────────────────
  if (normalizedType.includes("curvedconnector4")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.5);
    const midX = width * adj1;
    const midY = height * adj2;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} C ${point(midX, 0)} ${point(midX, 0)} ${point(midX, midY * 0.5)} C ${point(midX, midY)} ${point(midX, midY)} ${point((midX + width) / 2, midY)} C ${point(width, midY)} ${point(width, midY)} ${point(width, height)}`,
    };
  }

  // ── curvedConnector3 — 2-segment cubic Bézier ─────────────────────
  if (normalizedType.includes("curvedconnector3")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const midX = width * adj1;
    const midY = height / 2;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} C ${point(midX, 0)} ${point(midX, 0)} ${point(midX, midY)} C ${point(midX, height)} ${point(midX, height)} ${point(width, height)}`,
    };
  }

  // ── curvedConnector2 — quadratic Bézier (L-curve) ─────────────────
  if (normalizedType.includes("curvedconnector2")) {
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} Q ${point(width, 0)} ${point(width, height)}`,
    };
  }

  // ── straightConnector1 / default — straight line ──────────────────
  return {
    startX,
    startY,
    endX,
    endY,
    pathData: `M ${point(0, 0)} L ${point(width, height)}`,
  };
}
