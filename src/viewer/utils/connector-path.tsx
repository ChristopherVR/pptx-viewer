import React from "react";

import {
  ConnectorArrowType,
  PptxElementWithShapeStyle,
} from "../../core";
import { ConnectorPathGeometry } from "../types";
import { clampUnitInterval } from "./color";

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

export function getConnectorPathGeometry(
  element: PptxElementWithShapeStyle,
): ConnectorPathGeometry {
  const width = Math.max(element.width, 1);
  const height = Math.max(element.height, 1);
  const normalizedType = (element.shapeType || "").toLowerCase();
  const mapX = (value: number) => value;
  const mapY = (value: number) => value;
  const point = (x: number, y: number) => `${mapX(x)} ${mapY(y)}`;
  const startX = mapX(0);
  const startY = mapY(0);
  const endX = mapX(width);
  const endY = mapY(height);
  const horizontalDominant = width >= height;

  if (normalizedType.includes("bentconnector3")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.32);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.68);

    if (horizontalDominant) {
      const x1 = width * Math.min(adj1, adj2);
      const x2 = width * Math.max(adj1, adj2);
      const yMid = height * 0.5;
      return {
        startX,
        startY,
        endX,
        endY,
        pathData: `M ${point(0, 0)} L ${point(x1, 0)} L ${point(x1, yMid)} L ${point(x2, yMid)} L ${point(x2, height)} L ${point(width, height)}`,
      };
    }

    const y1 = height * Math.min(adj1, adj2);
    const y2 = height * Math.max(adj1, adj2);
    const xMid = width * 0.5;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(0, y1)} L ${point(xMid, y1)} L ${point(xMid, y2)} L ${point(width, y2)} L ${point(width, height)}`,
    };
  }

  if (normalizedType.includes("bentconnector")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.5);
    if (horizontalDominant) {
      const bendX = width * adj1;
      return {
        startX,
        startY,
        endX,
        endY,
        pathData: `M ${point(0, 0)} L ${point(bendX, 0)} L ${point(bendX, height)} L ${point(width, height)}`,
      };
    }

    const bendY = height * adj2;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} L ${point(0, bendY)} L ${point(width, bendY)} L ${point(width, height)}`,
    };
  }

  if (normalizedType.includes("curvedconnector3")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.22);
    const adj2 = getConnectorAdjustment(element, "adj2", 0.78);
    const control1X = width * adj1;
    const control2X = width * adj2;
    const control1Y = 0;
    const control2Y = height;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} C ${point(control1X, control1Y)} ${point(control2X, control2Y)} ${point(width, height)}`,
    };
  }

  if (normalizedType.includes("curvedconnector")) {
    const adj1 = getConnectorAdjustment(element, "adj1", 0.5);
    const adj2 = getConnectorAdjustment(
      element,
      "adj2",
      horizontalDominant ? 0 : 1,
    );
    const controlX = width * adj1;
    const controlY = height * adj2;
    return {
      startX,
      startY,
      endX,
      endY,
      pathData: `M ${point(0, 0)} Q ${point(controlX, controlY)} ${point(width, height)}`,
    };
  }

  return {
    startX,
    startY,
    endX,
    endY,
    pathData: `M ${point(0, 0)} L ${point(width, height)}`,
  };
}

/** Map OOXML arrow size tokens to numeric scale factors. */
const ARROW_SIZE_SCALE: Record<string, number> = {
  sm: 0.6,
  med: 1.0,
  lg: 1.5,
};

export function renderConnectorMarker(
  markerId: string,
  arrowType: ConnectorArrowType | undefined,
  color: string,
  arrowWidth?: "sm" | "med" | "lg",
  arrowLength?: "sm" | "med" | "lg",
): React.ReactNode {
  if (!arrowType || arrowType === "none") {
    return null;
  }

  const wScale = ARROW_SIZE_SCALE[arrowWidth || "med"] ?? 1;
  const lScale = ARROW_SIZE_SCALE[arrowLength || "med"] ?? 1;

  // Base marker size is 10x10 viewBox; scale the actual marker dimensions
  const mw = Math.round(8 * lScale);
  const mh = Math.round(8 * wScale);

  return (
    <marker
      id={markerId}
      markerWidth={mw}
      markerHeight={mh}
      refX={8}
      refY={5}
      orient="auto-start-reverse"
      viewBox="0 0 10 10"
      markerUnits="strokeWidth"
    >
      {arrowType === "triangle" ? (
        <polygon points="0,0 10,5 0,10" fill={color} />
      ) : arrowType === "stealth" ? (
        <polygon points="0,0 10,5 0,10 3.4,5" fill={color} />
      ) : arrowType === "diamond" ? (
        <polygon points="0,5 5,0 10,5 5,10" fill={color} />
      ) : arrowType === "oval" ? (
        <ellipse cx={5} cy={5} rx={4} ry={3.3} fill={color} />
      ) : (
        <path
          d="M0 0 L10 5 L0 10"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
        />
      )}
    </marker>
  );
}

/**
 * Compute parallel offsets for compound (double/triple) line styles.
 * Returns an array of offset distances from the center line.
 */
export function getCompoundLineOffsets(
  compoundLine: string | undefined,
  strokeWidth: number,
): number[] {
  if (!compoundLine || compoundLine === "sng") return [0];
  const gap = Math.max(strokeWidth * 0.6, 1.5);
  if (compoundLine === "dbl") return [-gap, gap];
  if (compoundLine === "thickThin") return [-gap * 0.6, gap];
  if (compoundLine === "thinThick") return [-gap, gap * 0.6];
  if (compoundLine === "tri") return [-gap, 0, gap];
  return [0];
}

/**
 * Get stroke widths for each parallel path in a compound line.
 */
export function getCompoundLineWidths(
  compoundLine: string | undefined,
  strokeWidth: number,
): number[] {
  const base = Math.max(strokeWidth, 1);
  if (!compoundLine || compoundLine === "sng") return [base];
  if (compoundLine === "dbl") return [base * 0.5, base * 0.5];
  if (compoundLine === "thickThin") return [base * 0.7, base * 0.3];
  if (compoundLine === "thinThick") return [base * 0.3, base * 0.7];
  if (compoundLine === "tri") return [base * 0.3, base * 0.4, base * 0.3];
  return [base];
}

/**
 * Compute connection sites for a rectangular bounding box.
 * Returns positions in element-local coordinates (top, right, bottom, left midpoints).
 */
export function getConnectionSites(
  width: number,
  height: number,
): Array<{ x: number; y: number; index: number }> {
  return [
    { x: width / 2, y: 0, index: 0 }, // top center
    { x: width, y: height / 2, index: 1 }, // right center
    { x: width / 2, y: height, index: 2 }, // bottom center
    { x: 0, y: height / 2, index: 3 }, // left center
  ];
}
