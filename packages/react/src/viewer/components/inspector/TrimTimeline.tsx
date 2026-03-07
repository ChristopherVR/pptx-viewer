import React, { useRef, useState, useCallback, useEffect } from "react";

import type { MediaBookmark } from "pptx-viewer-core";

// ==========================================================================
// Helpers
// ==========================================================================

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

export function generateBookmarkId(): string {
  return `bmk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ==========================================================================
// Style constants (shared with MediaPropertiesPanel)
// ==========================================================================

export const HEADING =
  "text-[11px] uppercase tracking-wide text-muted-foreground";
export const CARD = "rounded border border-border bg-card p-2 space-y-2";
export const INPUT =
  "flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full";
export const BTN =
  "rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors";
export const LABEL_CLS = "flex items-center justify-between gap-2";
export const LABEL_TEXT = "text-muted-foreground";

// ==========================================================================
// TrimTimeline
// ==========================================================================

interface TrimTimelineProps {
  duration: number;
  trimStartMs: number;
  trimEndMs: number;
  currentTime: number;
  bookmarks: MediaBookmark[];
  canEdit: boolean;
  onTrimChange: (trimStartMs: number, trimEndMs: number) => void;
  onSeek: (time: number) => void;
}

export function TrimTimeline({
  duration,
  trimStartMs,
  trimEndMs,
  currentTime,
  bookmarks,
  canEdit,
  onTrimChange,
  onSeek,
}: TrimTimelineProps): React.ReactElement {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const trimStartSec = trimStartMs / 1000;
  const trimEndSec = trimEndMs > 0 ? trimEndMs / 1000 : duration;
  const safeDuration = duration > 0 ? duration : 1;

  const startPct = (trimStartSec / safeDuration) * 100;
  const endPct = (trimEndSec / safeDuration) * 100;
  const playheadPct = (currentTime / safeDuration) * 100;

  const getTimeFromPointer = useCallback(
    (clientX: number): number => {
      const bar = barRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * safeDuration;
    },
    [safeDuration],
  );

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (e: PointerEvent): void => {
      const t = getTimeFromPointer(e.clientX);
      if (dragging === "start") {
        const newStart = Math.min(t, trimEndSec - 0.1);
        onTrimChange(Math.max(0, newStart) * 1000, trimEndMs);
      } else {
        const newEnd = Math.max(t, trimStartSec + 0.1);
        onTrimChange(trimStartMs, Math.min(newEnd, duration) * 1000);
      }
    };

    const handlePointerUp = (): void => {
      setDragging(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    dragging,
    duration,
    getTimeFromPointer,
    onTrimChange,
    trimEndMs,
    trimEndSec,
    trimStartMs,
    trimStartSec,
  ]);

  const handleBarClick = (e: React.MouseEvent): void => {
    const t = getTimeFromPointer(e.clientX);
    onSeek(t);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatTime(trimStartSec)}</span>
        <span>{formatTime(trimEndSec)}</span>
      </div>
      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative h-5 rounded bg-muted cursor-pointer select-none"
        onClick={handleBarClick}
      >
        {/* Trimmed region highlight */}
        <div
          className="absolute top-0 bottom-0 bg-primary/30 rounded"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
          style={{ left: `${Math.min(playheadPct, 100)}%` }}
        />

        {/* Trim start handle */}
        {canEdit && (
          <div
            className="absolute top-0 bottom-0 w-2 bg-primary rounded-l cursor-ew-resize z-20 hover:bg-primary/80"
            style={{ left: `calc(${startPct}% - 4px)` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragging("start");
            }}
          />
        )}

        {/* Trim end handle */}
        {canEdit && (
          <div
            className="absolute top-0 bottom-0 w-2 bg-primary rounded-r cursor-ew-resize z-20 hover:bg-primary/80"
            style={{ left: `calc(${endPct}% - 4px)` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragging("end");
            }}
          />
        )}

        {/* Bookmark markers */}
        {bookmarks.map((bmk) => {
          const pct = (bmk.time / safeDuration) * 100;
          return (
            <div
              key={bmk.id}
              className="absolute top-0 bottom-0 w-1 bg-yellow-400/70 z-10 cursor-pointer"
              style={{ left: `${pct}%` }}
              title={bmk.label}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(bmk.time);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
