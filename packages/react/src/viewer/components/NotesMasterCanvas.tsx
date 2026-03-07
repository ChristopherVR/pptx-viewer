import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PptxNotesMaster } from "pptx-viewer-core";
import type { CanvasSize } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesMasterCanvasProps {
  notesMaster: PptxNotesMaster | undefined;
  canvasSize: CanvasSize;
  notesCanvasSize: CanvasSize | undefined;
  /** Optional slide thumbnail data URL to render in the slide image area. */
  slideThumbnail?: string;
  /** Optional notes text to render in the body area. */
  notesText?: string;
  /** 1-based slide number for labelling. */
  slideNumber?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Standard notes page proportions: US Letter portrait (7.5 x 10 inches). */
const DEFAULT_NOTES_WIDTH = 720;
const DEFAULT_NOTES_HEIGHT = 960;

/** Placeholder type to human-readable label key map. */
const PLACEHOLDER_LABEL_KEYS: Record<string, string> = {
  sldImg: "pptx.master.notesMasterSlideImage",
  body: "pptx.master.notesMasterBody",
  hdr: "pptx.master.notesMasterHeader",
  ftr: "pptx.master.notesMasterFooter",
  dt: "pptx.master.notesMasterDate",
  sldNum: "pptx.master.notesMasterPageNumber",
};

/** Default layout positions (fraction of page) for known placeholder types. */
const DEFAULT_POSITIONS: Record<
  string,
  { x: number; y: number; w: number; h: number }
> = {
  sldImg: { x: 0.1, y: 0.05, w: 0.8, h: 0.4 },
  body: { x: 0.1, y: 0.5, w: 0.8, h: 0.4 },
  hdr: { x: 0.0, y: 0.0, w: 0.4, h: 0.04 },
  ftr: { x: 0.0, y: 0.96, w: 0.4, h: 0.04 },
  dt: { x: 0.6, y: 0.0, w: 0.4, h: 0.04 },
  sldNum: { x: 0.6, y: 0.96, w: 0.4, h: 0.04 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotesMasterCanvas({
  notesMaster,
  canvasSize,
  notesCanvasSize,
  slideThumbnail,
  notesText,
  slideNumber,
}: NotesMasterCanvasProps): React.ReactElement {
  const { t } = useTranslation();

  const pageWidth = notesCanvasSize?.width ?? DEFAULT_NOTES_WIDTH;
  const pageHeight = notesCanvasSize?.height ?? DEFAULT_NOTES_HEIGHT;

  // Scale to fit available canvas area
  const scale = useMemo(() => {
    const scaleX = canvasSize.width / pageWidth;
    const scaleY = canvasSize.height / pageHeight;
    return Math.min(scaleX, scaleY, 1) * 0.85;
  }, [canvasSize.width, canvasSize.height, pageWidth, pageHeight]);

  const scaledWidth = pageWidth * scale;
  const scaledHeight = pageHeight * scale;

  const placeholders = useMemo(() => {
    if (!notesMaster?.placeholders) {
      // Show default notes page layout
      return [
        { type: "sldImg", idx: undefined },
        { type: "body", idx: undefined },
        { type: "hdr", idx: undefined },
        { type: "ftr", idx: undefined },
        { type: "dt", idx: undefined },
        { type: "sldNum", idx: undefined },
      ];
    }
    return notesMaster.placeholders;
  }, [notesMaster?.placeholders]);

  if (!notesMaster) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("pptx.master.noNotesMaster")}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div
        className="relative bg-white shadow-lg border border-border rounded"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Background color */}
        {notesMaster.backgroundColor && (
          <div
            className="absolute inset-0 rounded"
            style={{ backgroundColor: notesMaster.backgroundColor }}
          />
        )}

        {/* Placeholder regions */}
        {placeholders.map((ph) => {
          const pos = DEFAULT_POSITIONS[ph.type];
          if (!pos) return null;
          const labelKey = PLACEHOLDER_LABEL_KEYS[ph.type] ?? ph.type;

          const isSlideArea = ph.type === "sldImg";
          const isBody = ph.type === "body";
          const isPageNum = ph.type === "sldNum";

          // Render slide thumbnail in the sldImg area when provided
          if (isSlideArea && slideThumbnail) {
            return (
              <div
                key={`${ph.type}-${ph.idx ?? "default"}`}
                className="absolute overflow-hidden border border-solid border-gray-300"
                style={{
                  left: pos.x * scaledWidth,
                  top: pos.y * scaledHeight,
                  width: pos.w * scaledWidth,
                  height: pos.h * scaledHeight,
                }}
              >
                <img
                  src={slideThumbnail}
                  alt={slideNumber ? `Slide ${slideNumber}` : "Slide"}
                  className="w-full h-full object-contain"
                />
              </div>
            );
          }

          // Render notes text in the body area when provided
          if (isBody && notesText !== undefined) {
            return (
              <div
                key={`${ph.type}-${ph.idx ?? "default"}`}
                className="absolute overflow-auto border border-solid border-gray-200 p-2"
                style={{
                  left: pos.x * scaledWidth,
                  top: pos.y * scaledHeight,
                  width: pos.w * scaledWidth,
                  height: pos.h * scaledHeight,
                  fontSize: Math.max(8, Math.min(11, scaledWidth * 0.015)),
                  lineHeight: 1.4,
                  color: "#374151",
                  whiteSpace: "pre-wrap",
                }}
              >
                {notesText || t("pptx.notes.noNotes")}
              </div>
            );
          }

          // Render page number
          if (isPageNum && slideNumber !== undefined) {
            return (
              <div
                key={`${ph.type}-${ph.idx ?? "default"}`}
                className="absolute flex items-center justify-center"
                style={{
                  left: pos.x * scaledWidth,
                  top: pos.y * scaledHeight,
                  width: pos.w * scaledWidth,
                  height: pos.h * scaledHeight,
                  fontSize: Math.max(8, Math.min(12, scaledWidth * 0.018)),
                  color: "rgba(156, 163, 175, 0.6)",
                }}
              >
                {slideNumber}
              </div>
            );
          }

          return (
            <div
              key={`${ph.type}-${ph.idx ?? "default"}`}
              className="absolute flex items-center justify-center border border-dashed"
              style={{
                left: pos.x * scaledWidth,
                top: pos.y * scaledHeight,
                width: pos.w * scaledWidth,
                height: pos.h * scaledHeight,
                borderColor: isSlideArea
                  ? "rgba(59, 130, 246, 0.5)"
                  : isBody
                    ? "rgba(34, 197, 94, 0.5)"
                    : "rgba(156, 163, 175, 0.4)",
                backgroundColor: isSlideArea
                  ? "rgba(59, 130, 246, 0.05)"
                  : isBody
                    ? "rgba(34, 197, 94, 0.05)"
                    : "transparent",
              }}
            >
              <span
                className="text-center px-1"
                style={{
                  fontSize: Math.max(8, Math.min(12, scaledWidth * 0.018)),
                  color: isSlideArea
                    ? "rgba(59, 130, 246, 0.7)"
                    : isBody
                      ? "rgba(34, 197, 94, 0.7)"
                      : "rgba(156, 163, 175, 0.6)",
                }}
              >
                {t(labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
