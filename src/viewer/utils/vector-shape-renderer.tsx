import React from "react";

import { PptxElement, hasShapeProperties } from "../../core";
import { colorWithOpacity } from "./color";
import {
  getConnectorPathGeometry,
  renderConnectorMarker,
  getCompoundLineOffsets,
  getCompoundLineWidths,
} from "./connector-path";
import { normalizeStrokeDashType, getSvgStrokeDasharray } from "./style";
import { getShapeType } from "./shape-types";

export function renderVectorShape(
  element: PptxElement,
  hasFill: boolean,
  fillColor: string,
  strokeWidth: number,
  strokeColor: string,
): React.ReactNode | null {
  if (!hasShapeProperties(element)) return null;
  const normalizedType = (element.shapeType || "").toLowerCase();
  const fillPaint = colorWithOpacity(
    fillColor,
    element.shapeStyle?.fillOpacity,
  );
  const strokePaint = colorWithOpacity(
    strokeColor,
    element.shapeStyle?.strokeOpacity,
  );
  const dashType = normalizeStrokeDashType(element.shapeStyle?.strokeDash);
  const dashArray = getSvgStrokeDasharray(
    dashType,
    Math.max(strokeWidth, 1),
    element.shapeStyle?.customDashSegments,
  );
  if (normalizedType === "can" || normalizedType === "cylinder") {
    const width = Math.max(element.width, 1);
    const height = Math.max(element.height, 1);
    const rim = Math.max(Math.min(height * 0.16, 28), 6);
    const stroke = Math.max(strokeWidth, 1);
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        <ellipse
          cx={width / 2}
          cy={rim / 2}
          rx={width / 2}
          ry={rim / 2}
          fill={hasFill ? fillPaint : "none"}
          stroke={strokeWidth > 0 ? strokePaint : "none"}
          strokeWidth={stroke}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
        <rect
          x={0}
          y={rim / 2}
          width={width}
          height={Math.max(height - rim, 1)}
          fill={hasFill ? fillPaint : "none"}
          stroke={strokeWidth > 0 ? strokePaint : "none"}
          strokeWidth={stroke}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
        <ellipse
          cx={width / 2}
          cy={height - rim / 2}
          rx={width / 2}
          ry={rim / 2}
          fill={hasFill ? fillPaint : "none"}
          stroke={strokeWidth > 0 ? strokePaint : "none"}
          strokeWidth={stroke}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  if (
    (element.type === "shape" ||
      element.type === "image" ||
      element.type === "picture") &&
    element.pathData &&
    element.pathWidth &&
    element.pathHeight &&
    element.pathWidth > 0 &&
    element.pathHeight > 0
  ) {
    return (
      <svg
        viewBox={`0 0 ${element.pathWidth} ${element.pathHeight}`}
        className="w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        <path
          d={element.pathData}
          fill={hasFill ? fillPaint : "none"}
          stroke={strokeWidth > 0 ? strokePaint : "none"}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  if (
    element.type === "connector" ||
    getShapeType(element.shapeType) === "connector" ||
    element.shapeType === "line"
  ) {
    const viewWidth = Math.max(element.width, 1);
    const viewHeight = Math.max(element.height, 1);
    const { pathData } = getConnectorPathGeometry(element);
    const markerSeed = element.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const startMarkerId = `${markerSeed}-start-arrow`;
    const endMarkerId = `${markerSeed}-end-arrow`;
    const startArrow = element.shapeStyle?.connectorStartArrow;
    const endArrow = element.shapeStyle?.connectorEndArrow;
    const startArrowW = element.shapeStyle?.connectorStartArrowWidth;
    const startArrowL = element.shapeStyle?.connectorStartArrowLength;
    const endArrowW = element.shapeStyle?.connectorEndArrowWidth;
    const endArrowL = element.shapeStyle?.connectorEndArrowLength;
    const compoundLine = element.shapeStyle?.compoundLine;
    // Hit target width — wide invisible stroke so thin lines are easy to click
    const hitTargetWidth = Math.max(strokeWidth * 3, 12);
    const offsets = getCompoundLineOffsets(compoundLine, strokeWidth);
    const widths = getCompoundLineWidths(compoundLine, strokeWidth);

    return (
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        <defs>
          {renderConnectorMarker(
            startMarkerId,
            startArrow,
            strokePaint,
            startArrowW,
            startArrowL,
          )}
          {renderConnectorMarker(
            endMarkerId,
            endArrow,
            strokePaint,
            endArrowW,
            endArrowL,
          )}
        </defs>
        {/* Invisible fat hit-target path — catches pointer events */}
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth={hitTargetWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "stroke" }}
        />
        {/* Visible connector stroke(s) — compound lines render as parallel paths */}
        {offsets.map((offset, idx) => (
          <path
            key={idx}
            d={pathData}
            fill="none"
            stroke={strokePaint}
            strokeWidth={Math.max(widths[idx] ?? strokeWidth, 1)}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerStart={
              idx === 0 && startArrow && startArrow !== "none"
                ? `url(#${startMarkerId})`
                : undefined
            }
            markerEnd={
              idx === offsets.length - 1 && endArrow && endArrow !== "none"
                ? `url(#${endMarkerId})`
                : undefined
            }
            vectorEffect="non-scaling-stroke"
            style={{
              pointerEvents: "none",
              ...(offset !== 0
                ? { transform: `translate(0, ${offset}px)` }
                : {}),
            }}
          />
        ))}
      </svg>
    );
  }

  return null;
}
