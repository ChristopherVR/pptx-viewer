import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";

import type { CanvasSize } from "../types";
import type { CompareResult } from "../utils/compare";
import { SlideDiffRow } from "./SlideDiffRow";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the {@link ComparePanel} component.
 */
export interface ComparePanelProps {
  /** Whether the panel is visible. */
  isOpen: boolean;
  /** The comparison result containing slide diffs, or `null` if none. */
  compareResult: CompareResult | null;
  /** Current canvas dimensions used to render diff thumbnails. */
  canvasSize: CanvasSize;
  /** Callback to close the panel. */
  onClose: () => void;
  /** Callback to accept a single diff by its index. */
  onAcceptSlide: (diffIndex: number) => void;
  /** Callback to reject a single diff by its index. */
  onRejectSlide: (diffIndex: number) => void;
  /** Callback to accept all non-trivial diffs at once. */
  onAcceptAll: () => void;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/**
 * Side panel that displays slide-level diffs between two presentations.
 *
 * Users can accept or reject individual slide changes, or accept all
 * at once. Accepted / rejected states are tracked locally via `useState`
 * and propagated to the parent through the `onAcceptSlide` / `onRejectSlide`
 * callbacks.
 *
 * @param props - {@link ComparePanelProps}
 * @returns The rendered panel, or `null` when hidden or no result is available.
 */
export function ComparePanel({
  isOpen,
  compareResult,
  canvasSize,
  onClose,
  onAcceptSlide,
  onRejectSlide,
  onAcceptAll,
}: ComparePanelProps): React.ReactElement | null {
  const { t } = useTranslation();
  /** Map of diff indices the user has accepted. */
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  /** Map of diff indices the user has rejected. */
  const [rejected, setRejected] = useState<Record<number, boolean>>({});

  /** Accept a diff: mark it accepted, un-reject if previously rejected, then notify parent. */
  const handleAccept = useCallback(
    (index: number) => {
      setAccepted((p) => ({ ...p, [index]: true }));
      setRejected((p) => {
        const next = { ...p };
        delete next[index];
        return next;
      });
      onAcceptSlide(index);
    },
    [onAcceptSlide],
  );

  /** Reject a diff: mark it rejected, un-accept if previously accepted, then notify parent. */
  const handleReject = useCallback(
    (index: number) => {
      setRejected((p) => ({ ...p, [index]: true }));
      setAccepted((p) => {
        const next = { ...p };
        delete next[index];
        return next;
      });
      onRejectSlide(index);
    },
    [onRejectSlide],
  );

  /** Accept every non-unchanged diff in a single action. */
  const handleAcceptAll = useCallback(() => {
    if (!compareResult) return;
    const acc: Record<number, boolean> = {};
    compareResult.diffs.forEach((d, i) => {
      if (d.status !== "unchanged") acc[i] = true;
    });
    setAccepted(acc);
    setRejected({});
    onAcceptAll();
  }, [compareResult, onAcceptAll]);

  if (!isOpen || !compareResult) return null;

  const nonTrivialDiffs = compareResult.diffs.filter(
    (d) => d.status !== "unchanged",
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[440px] border-l border-border bg-popover backdrop-blur-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("pptx.compare.title")}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("pptx.compare.summary", {
              added: compareResult.addedCount,
              removed: compareResult.removedCount,
              changed: compareResult.changedCount,
            })}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={onClose}
          title={t("pptx.compare.close")}
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      {/* Accept All button */}
      {nonTrivialDiffs.length > 0 && (
        <div className="px-4 py-2 border-b border-border/60">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded bg-green-700/80 px-3 py-1.5 text-xs text-green-50 hover:bg-green-600 transition-colors"
            onClick={handleAcceptAll}
          >
            <LuCheck className="w-3.5 h-3.5" />
            {t("pptx.compare.acceptAll")}
          </button>
        </div>
      )}

      {/* Diff list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {nonTrivialDiffs.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {t("pptx.compare.noDifferences")}
          </div>
        ) : (
          compareResult.diffs.map((diff, i) => (
            <SlideDiffRow
              key={`diff-${i}-${diff.status}`}
              diff={diff}
              diffIndex={i}
              canvasSize={canvasSize}
              accepted={Boolean(accepted[i])}
              rejected={Boolean(rejected[i])}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))
        )}
      </div>
    </div>
  );
}
