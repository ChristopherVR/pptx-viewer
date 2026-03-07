/**
 * NotesPagePreview — Renders a miniature preview of the notes page layout
 * inside the PrintDialog.
 *
 * Shows a scaled-down page with a slide placeholder on the top half
 * and ruled lines on the bottom half representing the notes area.
 */
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PptxSlide } from "../../../core";
import {
  computeAllNotesPages,
  getNotesPrintableArea,
} from "../../utils/notes-page-layout-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotesPagePreviewProps {
  /** Slide indices to include (already filtered by range). */
  slideIndices: number[];
  /** Full slide data (for notes text detection). */
  slides: PptxSlide[];
  /** Whether to draw a border around each slide thumbnail. */
  frameSlides: boolean;
  /** Maximum page previews to render (default: 3). */
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Preview scale: mm → px for the miniature. */
const PREVIEW_SCALE = 0.9;

/** Number of note indicator lines in preview. */
const NOTE_LINE_COUNT = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotesPagePreview({
  slideIndices,
  slides,
  frameSlides,
  maxPages = 3,
}: NotesPagePreviewProps): React.ReactElement {
  const { t } = useTranslation();

  const pages = useMemo(
    () => computeAllNotesPages(slideIndices),
    [slideIndices],
  );

  const printable = useMemo(() => getNotesPrintableArea(), []);

  const visiblePages = pages.slice(0, maxPages);
  const scaledW = printable.width * PREVIEW_SCALE;
  const scaledH = printable.height * PREVIEW_SCALE;

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
      {visiblePages.map((page) => {
        const slide = slides[page.slideIndex];
        const hasNotes = !!slide?.notes;
        const borderCls = frameSlides
          ? "border-2 border-gray-800"
          : "border border-gray-300";

        return (
          <div
            key={page.pageIndex}
            className="relative bg-white border border-gray-200 shadow-sm rounded"
            style={{
              width: scaledW,
              height: scaledH,
              overflow: "hidden",
            }}
          >
            {/* Slide placeholder */}
            <div
              className={`absolute flex items-center justify-center rounded-sm bg-gray-50 ${borderCls}`}
              style={{
                left: page.slideArea.x * PREVIEW_SCALE,
                top: page.slideArea.y * PREVIEW_SCALE,
                width: page.slideArea.width * PREVIEW_SCALE,
                height: page.slideArea.height * PREVIEW_SCALE,
              }}
            >
              <span className="text-[9px] font-medium text-gray-400">
                {page.slideIndex + 1}
              </span>
            </div>

            {/* Divider */}
            <div
              className="absolute left-1 right-1 border-b border-gray-200"
              style={{
                top: page.textArea.y * PREVIEW_SCALE - 1,
              }}
            />

            {/* Note lines preview */}
            <div
              className="absolute"
              style={{
                left: page.textArea.x * PREVIEW_SCALE + 4,
                top: page.textArea.y * PREVIEW_SCALE,
                width: page.textArea.width * PREVIEW_SCALE - 8,
                height: page.textArea.height * PREVIEW_SCALE,
              }}
            >
              {Array.from({ length: NOTE_LINE_COUNT }, (_, li) => {
                const lineSpacing =
                  (page.textArea.height * PREVIEW_SCALE) /
                  (NOTE_LINE_COUNT + 1);
                return (
                  <div
                    key={li}
                    className={`absolute left-0 right-0 border-b ${
                      hasNotes ? "border-gray-300" : "border-gray-200"
                    }`}
                    style={{ top: lineSpacing * (li + 1) }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
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
