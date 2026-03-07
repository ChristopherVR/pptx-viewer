/**
 * PrintDialog — Full-featured print dialog for PowerPoint presentations.
 *
 * Options: print what (slides/handouts/notes/outline), slides per page,
 * orientation, colour mode, frame slides, slide range.
 */
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuPrinter, LuX } from "react-icons/lu";

import { PrintPreview, NotesPagePreview } from "./print";
import type {
  PrintWhat,
  PrintOrientation,
  PrintColorMode,
  HandoutSlidesPerPage,
  PrintSlideRange,
  PrintDialogProps,
} from "./print-dialog-types";
import { HANDOUT_OPTIONS } from "./print-dialog-types";
import { PrintSettingsPanel } from "./PrintSettingsPanel";

// Re-export types so existing consumers don't break.
export type {
  PrintWhat,
  PrintOrientation,
  PrintColorMode,
  HandoutSlidesPerPage,
  PrintSlideRange,
  PrintDialogProps,
};
export type { PrintSettings } from "./print-dialog-types";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrintDialog({
  open,
  onClose,
  onPrint,
  slides,
  activeSlideIndex,
  defaultSlidesPerPage,
  defaultFrameSlides,
}: PrintDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  // ── State ───────────────────────────────────────────────────────────
  const [printWhat, setPrintWhat] = useState<PrintWhat>("slides");
  const [orientation, setOrientation] = useState<PrintOrientation>("landscape");
  const [colorMode, setColorMode] = useState<PrintColorMode>("color");
  const [frameSlides, setFrameSlides] = useState(defaultFrameSlides ?? false);
  const [slidesPerPage, setSlidesPerPage] = useState<HandoutSlidesPerPage>(
    (HANDOUT_OPTIONS.includes(defaultSlidesPerPage as HandoutSlidesPerPage)
      ? defaultSlidesPerPage
      : 6) as HandoutSlidesPerPage,
  );
  const [slideRange, setSlideRange] = useState<PrintSlideRange>("all");
  const [customFrom, setCustomFrom] = useState(1);
  const [customTo, setCustomTo] = useState(slides.length);

  // ── Derived ─────────────────────────────────────────────────────────
  const effectiveOrientation = useMemo<PrintOrientation>(() => {
    if (printWhat === "notes" || printWhat === "outline") return "portrait";
    if (printWhat === "handouts") return "portrait";
    return orientation;
  }, [printWhat, orientation]);

  const slideCount = useMemo(() => {
    if (slideRange === "all") return slides.length;
    if (slideRange === "current") return 1;
    const from = Math.max(1, Math.min(customFrom, slides.length));
    const to = Math.max(from, Math.min(customTo, slides.length));
    return to - from + 1;
  }, [slideRange, slides.length, customFrom, customTo]);

  const pageCount = useMemo(() => {
    if (printWhat === "slides") return slideCount;
    if (printWhat === "notes") return slideCount;
    if (printWhat === "outline") return 1;
    return Math.ceil(slideCount / slidesPerPage);
  }, [printWhat, slideCount, slidesPerPage]);

  const previewSlideIndices = useMemo<number[]>(() => {
    if (slideRange === "current") return [activeSlideIndex];
    if (slideRange === "custom") {
      const from = Math.max(0, customFrom - 1);
      const to = Math.min(slides.length - 1, customTo - 1);
      return Array.from(
        { length: Math.max(0, to - from + 1) },
        (_, i) => from + i,
      );
    }
    return Array.from({ length: slides.length }, (_, i) => i);
  }, [slideRange, activeSlideIndex, customFrom, customTo, slides.length]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    onPrint({
      printWhat,
      orientation: effectiveOrientation,
      colorMode,
      frameSlides,
      slidesPerPage,
      slideRange,
      customRangeFrom: Math.max(1, Math.min(customFrom, slides.length)),
      customRangeTo: Math.max(1, Math.min(customTo, slides.length)),
    });
  }, [
    printWhat,
    effectiveOrientation,
    colorMode,
    frameSlides,
    slidesPerPage,
    slideRange,
    customFrom,
    customTo,
    slides.length,
    onPrint,
  ]);

  if (!open) return null;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[780px] max-h-[90vh] rounded-xl border border-border bg-background shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <LuPrinter className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("pptx.print.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex gap-5">
          {/* Left: Settings */}
          <PrintSettingsPanel
            printWhat={printWhat}
            onPrintWhatChange={setPrintWhat}
            orientation={orientation}
            onOrientationChange={setOrientation}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            frameSlides={frameSlides}
            onFrameSlidesChange={setFrameSlides}
            slidesPerPage={slidesPerPage}
            onSlidesPerPageChange={setSlidesPerPage}
            slideRange={slideRange}
            onSlideRangeChange={setSlideRange}
            customFrom={customFrom}
            onCustomFromChange={setCustomFrom}
            customTo={customTo}
            onCustomToChange={setCustomTo}
            totalSlides={slides.length}
            activeSlideIndex={activeSlideIndex}
          />

          {/* Right: Preview */}
          {printWhat === "handouts" && (
            <div className="w-[230px] shrink-0 border-l border-border pl-4 overflow-y-auto">
              <PrintPreview
                slideIndices={previewSlideIndices}
                slidesPerPage={slidesPerPage}
                orientation={effectiveOrientation}
                frameSlides={frameSlides}
              />
            </div>
          )}
          {printWhat === "notes" && (
            <div className="w-[230px] shrink-0 border-l border-border pl-4 overflow-y-auto">
              <NotesPagePreview
                slideIndices={previewSlideIndices}
                slides={slides}
                frameSlides={frameSlides}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {t("pptx.print.pageEstimate", {
              pages: pageCount,
              slides: slideCount,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <LuPrinter className="w-3.5 h-3.5" />
              {t("pptx.print.printButton")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
