/**
 * ScaledSlidePreview — renders a slide at any size by scaling the native
 * canvas dimensions into a container-determined bounding box.
 *
 * Used by PresenterView for current-slide and next-slide previews.
 */
import React, { useEffect, useRef, useState } from "react";

import type { PptxElement, PptxSlide } from "../../core";
import {
  hasShapeProperties,
  hasTextProperties,
} from "../../core";
import type { CanvasSize } from "../types";
import {
  normalizeHexColor,
  buildCssGradientFromShapeStyle,
  getShapeVisualStyle,
  renderVectorShape,
  getTextStyleForElement,
  getImageRenderStyle,
  isEditableTextElement,
  shouldRenderFallbackLabel,
  getElementLabel,
  getElementTransform,
  getTextCompensationTransform,
  getTextLayoutStyle,
  renderTextSegments,
  isImageTiled,
  getImageTilingStyle,
} from "../utils";
import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
} from "../constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScaledSlidePreviewProps {
  slide: PptxSlide;
  templateElements: PptxElement[];
  canvasSize: CanvasSize;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScaledSlidePreview({
  slide,
  templateElements,
  canvasSize,
  className,
}: ScaledSlidePreviewProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const safeCanvasWidth = Math.max(canvasSize.width, 1);
  const safeCanvasHeight = Math.max(canvasSize.height, 1);
  const scale = containerWidth > 0 ? containerWidth / safeCanvasWidth : 0.2;
  const previewHeight = Math.max(40, Math.round(safeCanvasHeight * scale));
  const previewElements = [...templateElements, ...slide.elements].slice(0, 80);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded border border-border bg-white ${className ?? ""}`}
      style={{ height: previewHeight }}
    >
      {slide.backgroundColor && slide.backgroundColor !== "transparent" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: normalizeHexColor(
              slide.backgroundColor,
              "#ffffff",
            ),
          }}
        />
      )}
      {slide.backgroundImage && (
        <img
          src={slide.backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      )}
      {slide.backgroundGradient && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: slide.backgroundGradient }}
        />
      )}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: safeCanvasWidth,
          height: safeCanvasHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {previewElements.map((element) => {
          const elementWidth = Math.max(element.width, 1);
          const elementHeight = Math.max(element.height, 1);
          const elShapeStyle = hasShapeProperties(element)
            ? element.shapeStyle
            : undefined;
          const hasFill =
            (elShapeStyle?.fillColor !== undefined &&
              elShapeStyle?.fillColor !== "transparent") ||
            Boolean(
              buildCssGradientFromShapeStyle(elShapeStyle) ||
              elShapeStyle?.fillGradient,
            );
          const fillColor = normalizeHexColor(
            elShapeStyle?.fillColor,
            DEFAULT_FILL_COLOR,
          );
          const strokeWidth = Math.max(0, elShapeStyle?.strokeWidth || 0);
          const strokeColor = normalizeHexColor(
            elShapeStyle?.strokeColor,
            DEFAULT_STROKE_COLOR,
          );
          const shapeVisualStyle = getShapeVisualStyle(
            element,
            hasFill,
            fillColor,
            strokeWidth,
            strokeColor,
          );
          const vectorShape = renderVectorShape(
            element,
            hasFill,
            fillColor,
            strokeWidth,
            strokeColor,
          );
          const fallbackTextColor =
            element.type === "shape" && hasFill
              ? "#ffffff"
              : DEFAULT_TEXT_COLOR;
          const textStyle = getTextStyleForElement(element, fallbackTextColor);
          const imageRenderStyle = getImageRenderStyle(element);
          const canRenderText = isEditableTextElement(element);
          const elText = hasTextProperties(element) ? element.text : undefined;
          const elTextSegments = hasTextProperties(element)
            ? element.textSegments
            : undefined;
          const hasText =
            (typeof elText === "string" && elText.trim().length > 0) ||
            (elTextSegments?.length ?? 0) > 0;
          const fallbackLabel = shouldRenderFallbackLabel(
            element,
            canRenderText,
          )
            ? getElementLabel(element)
            : "";

          return (
            <div
              key={element.id}
              className="absolute overflow-hidden"
              style={{
                left: element.x,
                top: element.y,
                width: elementWidth,
                height: elementHeight,
                transform: getElementTransform(element),
                transformOrigin: "center",
              }}
            >
              {(element.type === "picture" || element.type === "image") &&
              (element.svgData || element.imageData) ? (
                isImageTiled(element) ? (
                  <div
                    className="pointer-events-none w-full h-full"
                    style={getImageTilingStyle(element)}
                  />
                ) : (
                  <img
                    src={element.svgData || element.imageData}
                    alt=""
                    className="pointer-events-none"
                    style={imageRenderStyle}
                    draggable={false}
                  />
                )
              ) : (
                <div
                  className="relative w-full h-full overflow-hidden"
                  style={shapeVisualStyle}
                >
                  {vectorShape}
                  {canRenderText && hasText && (
                    <div
                      className="w-full h-full whitespace-pre-wrap break-words px-1 py-0.5 leading-[1.3]"
                      style={{
                        ...getTextLayoutStyle(element),
                        ...textStyle,
                        transform: getTextCompensationTransform(element),
                        transformOrigin: "center",
                      }}
                    >
                      {renderTextSegments(element, fallbackTextColor)}
                    </div>
                  )}
                  {!hasText && fallbackLabel.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                      {fallbackLabel}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
