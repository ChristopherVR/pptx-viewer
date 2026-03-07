/**
 * HandoutLayout — Renders a print-ready preview of slides in handout format.
 *
 * Supports 1, 2, 3, 4, 6, and 9 slides per page.
 * The 3-per-page layout includes ruled note lines on the right.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import type {
  HandoutSlidesPerPage,
  HandoutPage,
} from "../../utils/handout-layout-utils";
import {
  computeHandoutLayout,
  getPrintableArea,
  generateNoteLineCount,
} from "../../utils/handout-layout-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HandoutLayoutProps {
  /** Ordered indices of slides to include in the handout. */
  slideIndices: number[];
  /** Number of slides per page. */
  slidesPerPage: HandoutSlidesPerPage;
  /** Page orientation. */
  orientation: "portrait" | "landscape";
  /** Whether to draw a border around each slide. */
  frameSlides: boolean;
  /**
   * Optional colour filter CSS (`grayscale(1)`, etc.).
   * Applied on each slide thumbnail.
   */
  colorFilter?: string;
  /**
   * Map of slide index → image data URL (PNG).
   * Used for rendering slide thumbnails.
   */
  slideImages?: Map<number, string>;
  /** Scale for the preview (1 = A4 at 1mm=1px). */
  previewScale?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NoteLinesSectionProps {
  lineCount: number;
  width: number;
  height: number;
}

function NoteLinesSection({
  lineCount,
  width,
  height,
}: NoteLinesSectionProps): React.ReactElement {
  const lineSpacing = height / (lineCount + 1);
  return (
    <div className="relative" style={{ width, height }}>
      {Array.from({ length: lineCount }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-b border-gray-300"
          style={{ top: lineSpacing * (i + 1) }}
        />
      ))}
    </div>
  );
}

interface SlideThumbProps {
  slideIndex: number;
  width: number;
  height: number;
  frameSlides: boolean;
  colorFilter?: string;
  imageSrc?: string;
}

function SlideThumb({
  slideIndex,
  width,
  height,
  frameSlides,
  colorFilter,
  imageSrc,
}: SlideThumbProps): React.ReactElement {
  const { t } = useTranslation();
  const borderClass = frameSlides
    ? "border-2 border-gray-800"
    : "border border-gray-300";

  return (
    <div
      className={`flex items-center justify-center overflow-hidden bg-white rounded-sm ${borderClass}`}
      style={{ width, height, filter: colorFilter || undefined }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={t("pptx.print.handout.slideAlt", {
            number: slideIndex + 1,
          })}
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-xs text-gray-400">{slideIndex + 1}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Renderer
// ---------------------------------------------------------------------------

interface HandoutPageRendererProps {
  page: HandoutPage;
  slidesPerPage: HandoutSlidesPerPage;
  orientation: "portrait" | "landscape";
  frameSlides: boolean;
  colorFilter?: string;
  slideImages?: Map<number, string>;
  scale: number;
}

function HandoutPageRenderer({
  page,
  slidesPerPage,
  orientation,
  frameSlides,
  colorFilter,
  slideImages,
  scale,
}: HandoutPageRendererProps): React.ReactElement {
  const printable = getPrintableArea(orientation);
  const scaledWidth = printable.width * scale;
  const scaledHeight = printable.height * scale;
  const isThreePerPage = slidesPerPage === 3;
  const noteLinesFraction = 0.5;

  return (
    <div
      className="relative bg-white border border-gray-200 shadow-sm rounded"
      style={{
        width: scaledWidth,
        height: scaledHeight,
        overflow: "hidden",
      }}
    >
      {page.cells.map((cell, idx) => {
        if (cell.slideIndex < 0) return null;

        const sx = cell.x * scale;
        const sy = cell.y * scale;
        const sw = cell.width * scale;
        const sh = cell.height * scale;

        return (
          <div
            key={idx}
            className="absolute flex items-start gap-1"
            style={{ left: sx, top: sy }}
          >
            <SlideThumb
              slideIndex={cell.slideIndex}
              width={sw}
              height={sh}
              frameSlides={frameSlides}
              colorFilter={colorFilter}
              imageSrc={slideImages?.get(cell.slideIndex)}
            />
            {isThreePerPage && (
              <NoteLinesSection
                lineCount={generateNoteLineCount()}
                width={scaledWidth * noteLinesFraction}
                height={sh}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HandoutLayout({
  slideIndices,
  slidesPerPage,
  orientation,
  frameSlides,
  colorFilter,
  slideImages,
  previewScale = 1.5,
}: HandoutLayoutProps): React.ReactElement {
  const pages = computeHandoutLayout(slideIndices, slidesPerPage, orientation);

  return (
    <div className="flex flex-col items-center gap-4">
      {pages.map((page) => (
        <HandoutPageRenderer
          key={page.pageIndex}
          page={page}
          slidesPerPage={slidesPerPage}
          orientation={orientation}
          frameSlides={frameSlides}
          colorFilter={colorFilter}
          slideImages={slideImages}
          scale={previewScale}
        />
      ))}
    </div>
  );
}
