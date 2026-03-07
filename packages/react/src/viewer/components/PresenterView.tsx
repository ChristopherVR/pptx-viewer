/**
 * PresenterView — Split-screen presenter layout with current slide,
 * next slide preview, speaker notes, timer, and navigation controls.
 *
 * Rendered as an absolute overlay when presenterMode is active during
 * presentation mode. Uses ScaledSlidePreview for slide rendering.
 */
import React, { useEffect, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type { PptxElement, PptxSlide } from "pptx-viewer-core";
import type { CanvasSize } from "../types";
import { ScaledSlidePreview } from "./ScaledSlidePreview";
import {
  formatTime,
  formatElapsed,
  renderNotesSegments,
} from "./presenter-view-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresenterViewProps {
  slides: PptxSlide[];
  currentSlideIndex: number;
  canvasSize: CanvasSize;
  templateElements: PptxElement[];
  presentationStartTime: number | null;
  onMovePresentationSlide: (direction: 1 | -1) => void;
  onExit: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenterView({
  slides,
  currentSlideIndex,
  canvasSize,
  templateElements,
  presentationStartTime,
  onMovePresentationSlide,
  onExit,
}: PresenterViewProps): React.ReactElement {
  const { t } = useTranslation();

  // -- Clock + elapsed timer -----------------------------------------------
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsed = presentationStartTime ? now - presentationStartTime : 0;

  // -- Slide data ----------------------------------------------------------
  const currentSlide = slides[currentSlideIndex];
  const nextSlide =
    currentSlideIndex + 1 < slides.length
      ? slides[currentSlideIndex + 1]
      : undefined;

  const notesText = currentSlide?.notes ?? "";
  const notesSegments = currentSlide?.notesSegments;
  const hasRichNotes = notesSegments && notesSegments.length > 0;

  // -- Keyboard navigation -------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        onMovePresentationSlide(1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onMovePresentationSlide(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit, onMovePresentationSlide]);

  if (!currentSlide) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-card text-muted-foreground">
        {t("pptx.presenter.noSlides")}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex bg-card text-foreground">
      {/* Left panel -- current slide (70%) */}
      <div className="flex-[7] flex items-center justify-center bg-black p-6 min-w-0">
        <ScaledSlidePreview
          slide={currentSlide}
          templateElements={templateElements}
          canvasSize={canvasSize}
        />
      </div>

      {/* Right panel -- controls (30%) */}
      <div className="flex-[3] flex flex-col bg-background border-l border-border min-w-[260px] max-w-[440px]">
        {/* Header: clock + elapsed + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("pptx.presenter.currentTime")}
            </span>
            <span className="text-lg font-mono tabular-nums text-foreground">
              {formatTime(new Date(now))}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("pptx.presenter.elapsed")}
            </span>
            <span className="text-lg font-mono tabular-nums text-primary">
              {formatElapsed(elapsed)}
            </span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t("pptx.presenter.endPresentation")}
            aria-label={t("pptx.presenter.endPresentation")}
          >
            <LuX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
          <button
            type="button"
            onClick={() => onMovePresentationSlide(-1)}
            disabled={currentSlideIndex === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
            title={t("pptx.presenter.previousSlide")}
          >
            <LuChevronLeft className="w-4 h-4" />
            {t("pptx.presenter.prev")}
          </button>
          <span className="text-sm font-mono tabular-nums text-foreground">
            {currentSlideIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={() => onMovePresentationSlide(1)}
            disabled={currentSlideIndex >= slides.length - 1}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
            title={t("pptx.presenter.nextSlide")}
          >
            {t("pptx.presenter.next")}
            <LuChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Next slide preview */}
        <div className="px-4 py-3 border-b border-border/60">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            {t("pptx.presenter.nextSlidePreview")}
          </div>
          {nextSlide ? (
            <ScaledSlidePreview
              slide={nextSlide}
              templateElements={templateElements}
              canvasSize={canvasSize}
            />
          ) : (
            <div className="flex items-center justify-center h-16 rounded border border-border/30 bg-muted/40 text-xs text-muted-foreground italic">
              {t("pptx.presenter.endOfPresentation")}
            </div>
          )}
        </div>

        {/* Speaker notes */}
        <div className="flex-1 flex flex-col min-h-0 px-4 py-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            {t("pptx.presenter.speakerNotes")}
          </div>
          <div className="flex-1 overflow-y-auto rounded border border-border/30 bg-muted/40 px-3 py-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {hasRichNotes ? (
              renderNotesSegments(notesSegments)
            ) : notesText.trim().length > 0 ? (
              notesText
            ) : (
              <span className="italic text-muted-foreground">
                {t("pptx.presenter.noNotes")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
