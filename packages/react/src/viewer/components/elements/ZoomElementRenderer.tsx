import React from "react";
import type { ZoomPptxElement, PptxSlide } from "pptx-viewer-core";
import { renderImg } from "./ImageRenderer";

/** Props for the ZoomElementRenderer component. */
export interface ZoomElementRendererProps {
  /** The zoom element to render. */
  element: ZoomPptxElement;
  /** All slides in the presentation (used to render target slide preview). */
  slides?: readonly PptxSlide[];
  /** Whether the viewer is in presentation mode (non-interactive editing). */
  isPresentationMode?: boolean;
  /** Callback fired when the zoom element is clicked in presentation mode. */
  onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
  /** The index of the slide that contains this zoom element (for return navigation). */
  sourceSlideIndex?: number;
}

/**
 * Renders a zoom element as an interactive thumbnail.
 *
 * In edit mode, shows the zoom's preview image with a subtle visual indicator.
 * In presentation mode, clicking navigates to the target slide.
 */
export function ZoomElementRenderer({
  element,
  slides,
  isPresentationMode,
  onZoomClick,
  sourceSlideIndex,
}: ZoomElementRendererProps): React.ReactElement {
  const targetSlide = slides?.[element.targetSlideIndex];

  const handleClick = (e: React.MouseEvent) => {
    if (!isPresentationMode || !onZoomClick) return;
    e.stopPropagation();
    onZoomClick(element.targetSlideIndex, sourceSlideIndex ?? 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isPresentationMode || !onZoomClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onZoomClick(element.targetSlideIndex, sourceSlideIndex ?? 0);
    }
  };

  // If the zoom element has image data (its own preview thumbnail), render it
  const hasPreviewImage = Boolean(element.imageData);

  return (
    <div
      className="zoom-element-container"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        cursor: isPresentationMode ? "pointer" : "default",
        overflow: "hidden",
        borderRadius: "4px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
        transition: "box-shadow 0.2s ease, transform 0.15s ease",
      }}
      data-zoom-type={element.zoomType}
      data-zoom-target={element.targetSlideIndex}
      data-testid="zoom-element"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isPresentationMode ? "button" : undefined}
      tabIndex={isPresentationMode ? 0 : -1}
      aria-label={`Zoom to slide ${element.targetSlideIndex + 1}${
        element.zoomType === "section" && element.targetSectionId
          ? ` (section: ${element.targetSectionId})`
          : ""
      }`}
    >
      {hasPreviewImage ? (
        renderImg(
          element,
          {
            width: "100%",
            height: "100%",
            objectFit: "contain",
          },
          undefined,
          `Preview of slide ${element.targetSlideIndex + 1}`,
        )
      ) : (
        <ZoomSlideThumbnail
          targetSlide={targetSlide}
          slideIndex={element.targetSlideIndex}
        />
      )}

      {/* Hover overlay for presentation mode */}
      {isPresentationMode && (
        <div
          className="zoom-hover-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            transition: "background 0.2s ease",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Zoom type badge */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          fontSize: "9px",
          padding: "1px 4px",
          borderRadius: "2px",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          color: "#fff",
          pointerEvents: "none",
          lineHeight: "1.4",
        }}
      >
        {element.zoomType === "section" ? "Section" : "Slide"} Zoom
      </div>
    </div>
  );
}

/**
 * Renders a fallback thumbnail when the zoom element has no preview image.
 * Shows the target slide's background colour and a slide number label.
 */
function ZoomSlideThumbnail({
  targetSlide,
  slideIndex,
}: {
  targetSlide?: PptxSlide;
  slideIndex: number;
}): React.ReactElement {
  const bgColor = targetSlide?.backgroundColor || "#f0f0f0";
  const slideLabel = targetSlide
    ? `Slide ${targetSlide.slideNumber}`
    : `Slide ${slideIndex + 1}`;

  return (
    <div
      data-testid="zoom-thumbnail"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: bgColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Slide number indicator */}
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "rgba(0, 0, 0, 0.5)",
          marginBottom: "4px",
        }}
      >
        {slideLabel}
      </div>

      {/* Section name if available */}
      {targetSlide?.sectionName && (
        <div
          style={{
            fontSize: "10px",
            color: "rgba(0, 0, 0, 0.4)",
          }}
        >
          {targetSlide.sectionName}
        </div>
      )}
    </div>
  );
}
