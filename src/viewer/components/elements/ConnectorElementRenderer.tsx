import React from "react";
import {
  hasShapeProperties,
  hasTextProperties,
} from "../../../core";
import { DEFAULT_STROKE_COLOR, MIN_ELEMENT_SIZE } from "../../constants";
import {
  colorWithOpacity,
  getElementTransform,
  getSvgStrokeDasharray,
  normalizeHexColor,
  normalizeStrokeDashType,
  buildLineShadowCss,
  buildLineGlowFilter,
} from "../../utils";
import {
  getCompoundLineOffsets,
  getCompoundLineWidths,
  getConnectorPathGeometry,
  renderConnectorMarker,
} from "../../utils/shape-connector";
import { ConnectorTextOverlay } from "./ConnectorTextOverlay";
import { ResizeHandles } from "./ResizeHandles";
export type { ConnectorRendererProps } from "./element-renderer-types";
import type { ConnectorRendererProps } from "./element-renderer-types";

export const ConnectorElementRenderer: React.FC<ConnectorRendererProps> =
  React.memo(function ConnectorElementRendererInner({
    el,
    isSelected,
    canInteract,
    showResizeHandles,
    showHoverBorder,
    selectionColorClass: selClr,
    opacity,
    zIndex,
    adjustmentHandleDescriptor: adjH,
    onResizePointerDown,
    onAdjustmentPointerDown,
    animationState,
  }) {
    const shapeEl = hasShapeProperties(el) ? el : undefined;
    const viewWidth = Math.max(el.width, 1);
    const viewHeight = Math.max(el.height, 1);
    const ss = shapeEl?.shapeStyle;
    const strokeWidth = Math.max(0, ss?.strokeWidth ?? 2);
    const strokeColor = normalizeHexColor(
      ss?.strokeColor,
      DEFAULT_STROKE_COLOR,
    );
    const strokePaint = colorWithOpacity(strokeColor, ss?.strokeOpacity);
    const dashType = normalizeStrokeDashType(ss?.strokeDash);
    const dashArray = getSvgStrokeDasharray(
      dashType,
      Math.max(strokeWidth, 1),
      ss?.customDashSegments,
    );
    const startArrow = ss?.connectorStartArrow;
    const endArrow = ss?.connectorEndArrow;
    const compoundLine = ss?.compoundLine;
    const markerSeed = el.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const startMarkerId = `${markerSeed}-sel-start`;
    const endMarkerId = `${markerSeed}-sel-end`;

    const compoundOffsets = getCompoundLineOffsets(compoundLine, strokeWidth);
    const compoundWidths = getCompoundLineWidths(compoundLine, strokeWidth);

    const textEl = hasTextProperties(el) ? el : undefined;
    const connectorText = textEl?.text?.trim() ?? "";
    const connectorTextSegments = textEl?.textSegments;
    const connectorTextStyle = textEl?.textStyle;

    const pathGeometry = shapeEl
      ? getConnectorPathGeometry(shapeEl)
      : {
          pathData: `M 0 0 L ${viewWidth} ${viewHeight}`,
          startX: 0,
          startY: 0,
          endX: viewWidth,
          endY: viewHeight,
        };

    const hitTargetWidth = Math.max(strokeWidth * 3, 14);
    const selColor = selClr === "blue-400" ? "#60a5fa" : "#3b82f6";
    const lineShadow = buildLineShadowCss(el);
    const lineGlow = buildLineGlowFilter(el);

    return (
      <div
        data-pptx-element="true"
        data-element-id={el.id}
        className="absolute"
        style={{
          left: el.x,
          top: el.y,
          width: Math.max(el.width, MIN_ELEMENT_SIZE),
          height: Math.max(el.height, MIN_ELEMENT_SIZE),
          transform: getElementTransform(el),
          transformOrigin: "center",
          background: "transparent",
          border: "none",
          pointerEvents: "none",
          opacity,
          zIndex,
          visibility: animationState?.visible === false ? "hidden" : "visible",
          animation: animationState?.cssAnimation,
          ...(lineGlow ? { filter: lineGlow } : {}),
        }}
      >
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
              ss?.connectorStartArrowWidth,
              ss?.connectorStartArrowLength,
            )}
            {renderConnectorMarker(
              endMarkerId,
              endArrow,
              strokePaint,
              ss?.connectorEndArrowWidth,
              ss?.connectorEndArrowLength,
            )}
            {lineShadow && (
              <filter
                id={`${markerSeed}-line-shadow`}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feDropShadow
                  dx={ss?.lineShadowOffsetX ?? 2}
                  dy={ss?.lineShadowOffsetY ?? 2}
                  stdDeviation={Math.max(0, (ss?.lineShadowBlur ?? 4) / 2)}
                  floodColor={ss?.lineShadowColor ?? "#000000"}
                  floodOpacity={ss?.lineShadowOpacity ?? 0.35}
                />
              </filter>
            )}
          </defs>

          {isSelected && (
            <path
              d={pathGeometry.pathData}
              fill="none"
              stroke={selColor}
              strokeWidth={Math.max(strokeWidth, 2) + 6}
              strokeOpacity={0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
          )}

          {!isSelected && showHoverBorder && (
            <path
              d={pathGeometry.pathData}
              fill="none"
              stroke="#93c5fd"
              strokeWidth={Math.max(strokeWidth, 2) + 4}
              strokeOpacity={0}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="transition-[stroke-opacity] duration-150 group-hover:stroke-opacity-40"
              style={{ pointerEvents: "none" }}
            />
          )}

          <path
            d={pathGeometry.pathData}
            fill="none"
            stroke="transparent"
            strokeWidth={hitTargetWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              pointerEvents: "stroke",
              cursor: canInteract ? "move" : "default",
            }}
          />

          {compoundOffsets.map((offset, idx) => (
            <path
              key={idx}
              d={pathGeometry.pathData}
              fill="none"
              stroke={strokePaint}
              strokeWidth={Math.max(compoundWidths[idx] ?? strokeWidth, 1)}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerStart={
                idx === 0 && startArrow && startArrow !== "none"
                  ? `url(#${startMarkerId})`
                  : undefined
              }
              markerEnd={
                idx === compoundOffsets.length - 1 &&
                endArrow &&
                endArrow !== "none"
                  ? `url(#${endMarkerId})`
                  : undefined
              }
              vectorEffect="non-scaling-stroke"
              filter={
                idx === 0 && lineShadow
                  ? `url(#${markerSeed}-line-shadow)`
                  : undefined
              }
              style={{
                pointerEvents: "none",
                ...(offset !== 0
                  ? {
                      transform: `translate(0, ${offset}px)`,
                    }
                  : {}),
              }}
            />
          ))}

          {isSelected && (
            <>
              <circle
                cx={pathGeometry.startX}
                cy={pathGeometry.startY}
                r={4}
                fill={selColor}
                stroke="white"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
              <circle
                cx={pathGeometry.endX}
                cy={pathGeometry.endY}
                r={4}
                fill={selColor}
                stroke="white"
                strokeWidth={1.5}
                style={{ pointerEvents: "none" }}
              />
            </>
          )}
        </svg>

        {connectorTextSegments && (
          <ConnectorTextOverlay
            connectorText={connectorText}
            connectorTextSegments={connectorTextSegments}
            connectorTextStyle={connectorTextStyle}
          />
        )}

        {showResizeHandles && (
          <ResizeHandles
            elementId={el.id}
            adjustmentHandleDescriptor={adjH}
            onResizePointerDown={onResizePointerDown}
            onAdjustmentPointerDown={onAdjustmentPointerDown}
            forcePointerEvents
          />
        )}
      </div>
    );
  });
