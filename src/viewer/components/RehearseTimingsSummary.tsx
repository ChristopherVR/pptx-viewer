/**
 * RehearseTimingsSummary — Dialog shown after rehearsal ends.
 * Displays recorded per-slide timings and total time, with
 * Save / Discard actions.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxSlide } from "../../core";
import type { CanvasSize } from "../types";
import { SlideThumbnail } from "./SlideThumbnail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RehearseTimingsSummaryProps {
  slides: PptxSlide[];
  canvasSize: CanvasSize;
  recordedTimings: Record<number, number>;
  onSave: () => void;
  onDiscard: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RehearseTimingsSummary({
  slides,
  canvasSize,
  recordedTimings,
  onSave,
  onDiscard,
}: RehearseTimingsSummaryProps): React.ReactElement {
  const { t } = useTranslation();

  const totalMs = Object.values(recordedTimings).reduce(
    (sum, ms) => sum + ms,
    0,
  );
  const sortedEntries = Object.entries(recordedTimings)
    .map(([idx, ms]) => ({ slideIndex: Number(idx), ms }))
    .sort((a, b) => a.slideIndex - b.slideIndex);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("pptx.rehearse.summaryTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pptx.rehearse.totalPresentationTime")}:{" "}
            <span className="font-mono text-foreground">
              {formatMs(totalMs)}
            </span>
          </p>
        </div>

        {/* Slide table */}
        <div className="max-h-72 overflow-y-auto px-5 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-wide">
                <th className="pb-2 text-left">#</th>
                <th className="pb-2 text-left">{t("pptx.rehearse.slide")}</th>
                <th className="pb-2 text-right">{t("pptx.rehearse.time")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map(({ slideIndex, ms }) => {
                const slide = slides[slideIndex];
                return (
                  <tr key={slideIndex} className="border-t border-border">
                    <td className="py-2 text-muted-foreground tabular-nums">
                      {slideIndex + 1}
                    </td>
                    <td className="py-2">
                      {slide && (
                        <div className="w-20 rounded overflow-hidden bg-white">
                          <SlideThumbnail
                            slide={slide}
                            templateElements={[]}
                            canvasSize={canvasSize}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-foreground tabular-nums">
                      {formatMs(ms)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            {t("pptx.rehearse.discard")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/80 transition-colors"
          >
            {t("pptx.rehearse.saveTimings")}
          </button>
        </div>
      </div>
    </div>
  );
}
