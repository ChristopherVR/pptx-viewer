/**
 * NotesPageLayout — Renders a print-ready preview of slides in notes page format.
 *
 * Each page shows one slide thumbnail on the top half and the slide's
 * speaker notes text below — the standard PowerPoint "Notes Page" print layout.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxSlide } from "pptx-viewer-core";
import type { NotesPageData } from "../../utils/notes-page-layout-utils";
import {
  computeAllNotesPages,
  getNotesPrintableArea,
} from "../../utils/notes-page-layout-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotesPageLayoutProps {
  /** Ordered indices of slides to include. */
  slideIndices: number[];
  /** Full slide data (needed for notes text). */
  slides: PptxSlide[];
  /** Whether to draw a border around each slide thumbnail. */
  frameSlides: boolean;
  /** Optional colour filter CSS (`grayscale(1)`, etc.). */
  colorFilter?: string;
  /** Map of slide index → image data URL (PNG). */
  slideImages?: Map<number, string>;
  /** Scale for the preview (1 = A4 at 1mm = 1px). */
  previewScale?: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NotesThumbnailProps {
  slideIndex: number;
  width: number;
  height: number;
  frameSlides: boolean;
  colorFilter?: string;
  imageSrc?: string;
}

function NotesThumbnail({
  slideIndex,
  width,
  height,
  frameSlides,
  colorFilter,
  imageSrc,
}: NotesThumbnailProps): React.ReactElement {
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
          alt={t("pptx.print.notes.slideAlt", {
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

interface NotesTextSectionProps {
  notes: string | undefined;
  width: number;
  height: number;
}

function NotesTextSection({
  notes,
  width,
  height,
}: NotesTextSectionProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden text-left" style={{ width, height }}>
      {notes ? (
        <div className="space-y-1">
          {notes.split("\n").map((paragraph, idx) => (
            <p key={idx} className="text-[10px] leading-relaxed text-gray-700">
              {paragraph || "\u00A0"}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[10px] italic text-gray-400">
          {t("pptx.print.notes.noNotes")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Renderer
// ---------------------------------------------------------------------------

interface NotesPageRendererProps {
  page: NotesPageData;
  slide: PptxSlide | undefined;
  frameSlides: boolean;
  colorFilter?: string;
  slideImages?: Map<number, string>;
  scale: number;
}

function NotesPageRenderer({
  page,
  slide,
  frameSlides,
  colorFilter,
  slideImages,
  scale,
}: NotesPageRendererProps): React.ReactElement {
  const printable = getNotesPrintableArea();
  const scaledWidth = printable.width * scale;
  const scaledHeight = printable.height * scale;

  return (
    <div
      className="relative bg-white border border-gray-200 shadow-sm rounded"
      style={{
        width: scaledWidth,
        height: scaledHeight,
        overflow: "hidden",
      }}
    >
      {/* Slide thumbnail */}
      <div
        className="absolute"
        style={{
          left: page.slideArea.x * scale,
          top: page.slideArea.y * scale,
        }}
      >
        <NotesThumbnail
          slideIndex={page.slideIndex}
          width={page.slideArea.width * scale}
          height={page.slideArea.height * scale}
          frameSlides={frameSlides}
          colorFilter={colorFilter}
          imageSrc={slideImages?.get(page.slideIndex)}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute left-2 right-2 border-b border-gray-300"
        style={{
          top: page.textArea.y * scale - 2,
        }}
      />

      {/* Notes text */}
      <div
        className="absolute px-1"
        style={{
          left: page.textArea.x * scale,
          top: page.textArea.y * scale,
          width: page.textArea.width * scale,
          height: page.textArea.height * scale,
        }}
      >
        <NotesTextSection
          notes={slide?.notes}
          width={page.textArea.width * scale}
          height={page.textArea.height * scale}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotesPageLayout({
  slideIndices,
  slides,
  frameSlides,
  colorFilter,
  slideImages,
  previewScale = 1.5,
}: NotesPageLayoutProps): React.ReactElement {
  const pages = computeAllNotesPages(slideIndices);

  return (
    <div className="flex flex-col items-center gap-4">
      {pages.map((page) => (
        <NotesPageRenderer
          key={page.pageIndex}
          page={page}
          slide={slides[page.slideIndex]}
          frameSlides={frameSlides}
          colorFilter={colorFilter}
          slideImages={slideImages}
          scale={previewScale}
        />
      ))}
    </div>
  );
}
