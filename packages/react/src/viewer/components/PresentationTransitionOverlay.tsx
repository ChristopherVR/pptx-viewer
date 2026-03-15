/**
 * Overlay rendered during slide transitions in presentation mode.
 *
 * Displays the *outgoing* (previous) slide as an absolutely-positioned layer
 * with CSS exit animation. The *incoming* (new) slide is rendered by the
 * main SlideCanvas underneath (or on top, depending on `outgoingOnTop`).
 */
import React, { useEffect, useRef, useMemo, useState } from "react";

import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import {
  hasShapeProperties,
  hasTextProperties,
} from "pptx-viewer-core";
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
import { getSlideTransitionAnimations } from "../utils/slide-transitions";
import type { SlideTransitionAnimations } from "../utils/slide-transitions";
import type { PptxSlideTransition } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationTransitionOverlayProps {
  /** The outgoing (old) slide to render in the overlay layer. */
  outgoingSlide: PptxSlide;
  /** Template/master elements that belong to the outgoing slide. */
  templateElements: PptxElement[];
  /** Canvas dimensions (slide width × height in EMU-derived px). */
  canvasSize: CanvasSize;
  /** Transition definition from the incoming slide. */
  transition: PptxSlideTransition;
  /** Resolved transition duration in ms. */
  durationMs: number;
  /** Called when the transition animation completes. */
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Slide layer renderer (simplified non-interactive slide, like SlideThumbnail)
// ---------------------------------------------------------------------------

interface SlideLayerProps {
  slide: PptxSlide;
  templateElements: PptxElement[];
  canvasSize: CanvasSize;
}

function SlideLayer({
  slide,
  templateElements,
  canvasSize,
}: SlideLayerProps): React.ReactElement {
  const safeWidth = Math.max(canvasSize.width, 1);
  const safeHeight = Math.max(canvasSize.height, 1);
  const elements = [...templateElements, ...slide.elements];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: safeWidth,
        height: safeHeight,
        backgroundColor: slide.backgroundColor
          ? normalizeHexColor(slide.backgroundColor, "#ffffff")
          : "#ffffff",
        backgroundImage: slide.backgroundImage
          ? `url(${slide.backgroundImage})`
          : slide.backgroundGradient
            ? slide.backgroundGradient
            : undefined,
        backgroundSize: slide.backgroundImage ? "cover" : undefined,
        backgroundPosition: slide.backgroundImage ? "center" : undefined,
      }}
    >
      {elements.map((element) => {
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
          ) ||
          (elShapeStyle?.fillMode === "pattern" &&
            Boolean(elShapeStyle.fillPatternPreset));
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
          element.type === "shape" && hasFill ? "#ffffff" : DEFAULT_TEXT_COLOR;
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
        const fallbackLabel = shouldRenderFallbackLabel(element, canRenderText)
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
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationTransitionOverlay({
  outgoingSlide,
  templateElements,
  canvasSize,
  transition,
  durationMs,
  onComplete,
}: PresentationTransitionOverlayProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Measure container to compute scale
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
  }, []);

  // Play transition sound if present
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!transition.soundPath) return;
    const audio = new Audio(transition.soundPath);
    audioRef.current = audio;
    audio.play().catch(() => {
      // Browser autoplay policy may block; silently ignore
    });
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [transition.soundPath]);

  // Fire completion callback after duration
  useEffect(() => {
    const timer = window.setTimeout(onComplete, durationMs + 50);
    return () => {
      window.clearTimeout(timer);
    };
  }, [durationMs, onComplete]);

  // Compute transition animations
  const animations: SlideTransitionAnimations = useMemo(
    () =>
      getSlideTransitionAnimations(
        transition.type,
        durationMs,
        transition.direction,
        transition.orient,
        transition.spokes,
      ),
    [
      transition.type,
      transition.direction,
      transition.orient,
      transition.spokes,
      durationMs,
    ],
  );

  // Compute scale for the slide layer to fit inside the container
  const scale = useMemo(() => {
    if (!containerSize) return 1;
    const scaleX = containerSize.width / Math.max(canvasSize.width, 1);
    const scaleY = containerSize.height / Math.max(canvasSize.height, 1);
    return Math.min(scaleX, scaleY);
  }, [containerSize, canvasSize]);

  const outgoingZIndex = animations.outgoingOnTop ? 40 : 20;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: outgoingZIndex }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          animation:
            animations.outgoing !== "none" ? animations.outgoing : undefined,
        }}
      >
        <div
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
            transform: `scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          <SlideLayer
            slide={outgoingSlide}
            templateElements={templateElements}
            canvasSize={canvasSize}
          />
        </div>
      </div>
    </div>
  );
}
