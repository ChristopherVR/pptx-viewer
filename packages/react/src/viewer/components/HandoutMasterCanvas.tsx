import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { PptxHandoutMaster } from "pptx-viewer-core";
import type { CanvasSize } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HandoutMasterCanvasProps {
  handoutMaster: PptxHandoutMaster | undefined;
  canvasSize: CanvasSize;
  slidesPerPage: number;
  /** Optional slide thumbnail data URLs to render in slots. */
  slideThumbnails?: string[];
  /** 1-based page number for multi-page handout sets. */
  pageNumber?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** US Letter portrait page proportions (7.5 x 10 inches at 96 dpi). */
const PAGE_WIDTH = 720;
const PAGE_HEIGHT = 960;

/** Margin fraction of the page dimensions. */
const MARGIN = 0.06;

// ---------------------------------------------------------------------------
// Layout calculation: positions of slide placeholders per slides-per-page
// ---------------------------------------------------------------------------

interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeSlotLayout(
  slidesPerPage: number,
  slideAspect: number,
): SlotRect[] {
  const mx = MARGIN;
  const my = MARGIN;
  const contentW = 1 - 2 * mx;
  const contentH = 1 - 2 * my;

  const GAP = 0.02;

  switch (slidesPerPage) {
    case 1: {
      const w = contentW * 0.8;
      const h = w / slideAspect;
      return [{ x: mx + (contentW - w) / 2, y: my + (contentH - h) / 2, w, h }];
    }
    case 2: {
      const w = contentW * 0.75;
      const h = w / slideAspect;
      const totalH = h * 2 + GAP;
      const startY = my + (contentH - totalH) / 2;
      return [0, 1].map((i) => ({
        x: mx + (contentW - w) / 2,
        y: startY + i * (h + GAP),
        w,
        h,
      }));
    }
    case 3: {
      const w = contentW * 0.5;
      const h = w / slideAspect;
      const totalH = h * 3 + GAP * 2;
      const startY = my + (contentH - totalH) / 2;
      return [0, 1, 2].map((i) => ({
        x: mx,
        y: startY + i * (h + GAP),
        w,
        h,
      }));
    }
    case 4: {
      const cols = 2;
      const rows = 2;
      const w = (contentW - GAP) / cols;
      const h = w / slideAspect;
      const totalH = h * rows + GAP * (rows - 1);
      const startY = my + (contentH - totalH) / 2;
      return Array.from({ length: 4 }, (_, i) => ({
        x: mx + (i % cols) * (w + GAP),
        y: startY + Math.floor(i / cols) * (h + GAP),
        w,
        h,
      }));
    }
    case 6: {
      const cols = 2;
      const rows = 3;
      const w = (contentW - GAP) / cols;
      const h = w / slideAspect;
      const totalH = h * rows + GAP * (rows - 1);
      const startY = my + (contentH - totalH) / 2;
      return Array.from({ length: 6 }, (_, i) => ({
        x: mx + (i % cols) * (w + GAP),
        y: startY + Math.floor(i / cols) * (h + GAP),
        w,
        h,
      }));
    }
    case 9: {
      const cols = 3;
      const rows = 3;
      const w = (contentW - GAP * 2) / cols;
      const h = w / slideAspect;
      const totalH = h * rows + GAP * (rows - 1);
      const startY = my + (contentH - totalH) / 2;
      return Array.from({ length: 9 }, (_, i) => ({
        x: mx + (i % cols) * (w + GAP),
        y: startY + Math.floor(i / cols) * (h + GAP),
        w,
        h,
      }));
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HandoutMasterCanvas({
  handoutMaster,
  canvasSize,
  slidesPerPage,
  slideThumbnails,
  pageNumber,
}: HandoutMasterCanvasProps): React.ReactElement {
  const { t } = useTranslation();

  // Standard 4:3 slide aspect for slot placeholders
  const slideAspect = 4 / 3;

  // Scale page to fit canvas
  const scale = useMemo(() => {
    const scaleX = canvasSize.width / PAGE_WIDTH;
    const scaleY = canvasSize.height / PAGE_HEIGHT;
    return Math.min(scaleX, scaleY, 1) * 0.85;
  }, [canvasSize.width, canvasSize.height]);

  const scaledWidth = PAGE_WIDTH * scale;
  const scaledHeight = PAGE_HEIGHT * scale;

  const slots = useMemo(
    () => computeSlotLayout(slidesPerPage, slideAspect),
    [slidesPerPage, slideAspect],
  );

  if (!handoutMaster) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("pptx.master.noHandoutMaster")}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <div
        className="relative bg-white shadow-lg border border-gray-300 rounded"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Background */}
        {handoutMaster.backgroundColor && (
          <div
            className="absolute inset-0 rounded"
            style={{ backgroundColor: handoutMaster.backgroundColor }}
          />
        )}

        {/* Slide placeholder slots */}
        {slots.map((slot, i) => {
          const thumbnail = slideThumbnails?.[i];
          return (
            <div
              key={i}
              className={`absolute flex items-center justify-center overflow-hidden ${
                thumbnail
                  ? "border border-solid border-gray-300"
                  : "border border-dashed border-blue-400/50 bg-blue-50/30"
              }`}
              style={{
                left: slot.x * scaledWidth,
                top: slot.y * scaledHeight,
                width: slot.w * scaledWidth,
                height: slot.h * scaledHeight,
              }}
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={`Slide ${(pageNumber ? (pageNumber - 1) * slidesPerPage : 0) + i + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span
                  className="text-blue-400/60 font-medium"
                  style={{
                    fontSize: Math.max(
                      8,
                      Math.min(14, slot.w * scaledWidth * 0.08),
                    ),
                  }}
                >
                  {t("pptx.master.handoutSlideSlot", { number: i + 1 })}
                </span>
              )}
            </div>
          );
        })}

        {/* Header / Footer / Date / Page number indicators */}
        <div
          className="absolute left-0 top-0 px-1 text-gray-400/50 border-b border-r border-dashed border-gray-300/40"
          style={{ fontSize: Math.max(6, 8 * scale) }}
        >
          {t("pptx.master.notesMasterHeader")}
        </div>
        <div
          className="absolute right-0 top-0 px-1 text-gray-400/50 border-b border-l border-dashed border-gray-300/40"
          style={{ fontSize: Math.max(6, 8 * scale) }}
        >
          {t("pptx.master.notesMasterDate")}
        </div>
        <div
          className="absolute left-0 bottom-0 px-1 text-gray-400/50 border-t border-r border-dashed border-gray-300/40"
          style={{ fontSize: Math.max(6, 8 * scale) }}
        >
          {t("pptx.master.notesMasterFooter")}
        </div>
        <div
          className="absolute right-0 bottom-0 px-1 text-gray-400/50 border-t border-l border-dashed border-gray-300/40"
          style={{ fontSize: Math.max(6, 8 * scale) }}
        >
          {pageNumber !== undefined
            ? String(pageNumber)
            : t("pptx.master.notesMasterPageNumber")}
        </div>
      </div>
    </div>
  );
}
