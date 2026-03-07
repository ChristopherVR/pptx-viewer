/**
 * PrintPreview — Renders a miniature preview of the handout layout
 * inside the PrintDialog.
 *
 * Shows a scaled-down page with numbered placeholder cells
 * to give users a visual feel for their selected layout.
 */
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { HandoutSlidesPerPage } from "../../utils/handout-layout-utils";
import {
  computeHandoutLayout,
  getPrintableArea,
  generateNoteLineCount,
} from "../../utils/handout-layout-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrintPreviewProps {
  /** Total slides to include (already filtered by range). */
  slideIndices: number[];
  /** How many slides per page. */
  slidesPerPage: HandoutSlidesPerPage;
  /** Page orientation. */
  orientation: "portrait" | "landscape";
  /** Whether to draw a border around each slide. */
  frameSlides: boolean;
  /** Maximum page previews to render (default: 3). */
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Preview scale: mm → px for the miniature. */
const PREVIEW_SCALE = 0.9;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrintPreview({
  slideIndices,
  slidesPerPage,
  orientation,
  frameSlides,
  maxPages = 3,
}: PrintPreviewProps): React.ReactElement {
  const { t } = useTranslation();

  const pages = useMemo(
    () => computeHandoutLayout(slideIndices, slidesPerPage, orientation),
    [slideIndices, slidesPerPage, orientation],
  );

  const printable = useMemo(() => getPrintableArea(orientation), [orientation]);

  const visiblePages = pages.slice(0, maxPages);
  const isThreePerPage = slidesPerPage === 3;
  const noteLineCount = generateNoteLineCount();

  const scaledW = printable.width * PREVIEW_SCALE;
  const scaledH = printable.height * PREVIEW_SCALE;
  const noteAreaFraction = 0.5;

  if (slideIndices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        {t("pptx.print.preview.noSlides")}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {t("pptx.print.preview.title")}
      </span>
      {visiblePages.map((page) => (
        <div
          key={page.pageIndex}
          className="relative bg-white border border-gray-200 shadow-sm rounded"
          style={{
            width: scaledW,
            height: scaledH,
            overflow: "hidden",
          }}
        >
          {page.cells.map((cell, idx) => {
            const isEmpty = cell.slideIndex < 0;
            const cx = cell.x * PREVIEW_SCALE;
            const cy = cell.y * PREVIEW_SCALE;
            const cw = cell.width * PREVIEW_SCALE;
            const ch = cell.height * PREVIEW_SCALE;

            const borderCls = frameSlides
              ? "border-2 border-gray-800"
              : "border border-gray-300";

            return (
              <div
                key={idx}
                className="absolute flex items-start"
                style={{
                  left: cx,
                  top: cy,
                  gap: isThreePerPage ? 2 : 0,
                }}
              >
                {/* Slide cell */}
                <div
                  className={`flex items-center justify-center rounded-sm bg-gray-50 ${
                    isEmpty ? "opacity-30" : ""
                  } ${borderCls}`}
                  style={{ width: cw, height: ch }}
                >
                  {!isEmpty && (
                    <span className="text-[9px] font-medium text-gray-400">
                      {cell.slideIndex + 1}
                    </span>
                  )}
                </div>

                {/* Note lines (3-per-page only) */}
                {isThreePerPage && !isEmpty && (
                  <div
                    className="relative border-l border-gray-200 pl-1"
                    style={{
                      width: scaledW * noteAreaFraction,
                      height: ch,
                    }}
                  >
                    {Array.from({ length: noteLineCount }, (_, li) => {
                      const lineY = (ch / (noteLineCount + 1)) * (li + 1);
                      return (
                        <div
                          key={li}
                          className="absolute left-1 right-0 border-b border-gray-200"
                          style={{ top: lineY }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {pages.length > maxPages && (
        <span className="text-[10px] text-muted-foreground">
          {t("pptx.print.preview.morePages", {
            count: pages.length - maxPages,
          })}
        </span>
      )}
    </div>
  );
}
