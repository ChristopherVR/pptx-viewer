import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuMinus,
  LuMove,
  LuPlus,
  LuType,
  LuX,
} from "react-icons/lu";

import { cn } from "../utils";
import type { CanvasSize } from "../types";
import type { SlideDiff, ElementChange } from "../utils/compare";
import { SlideThumbnail } from "./SlideThumbnail";

// ---------------------------------------------------------------------------
// Change kind icon
// ---------------------------------------------------------------------------

function ChangeKindIcon({
  kind,
}: {
  kind: ElementChange["kind"];
}): React.ReactElement {
  switch (kind) {
    case "added":
      return <LuPlus className="w-3 h-3 text-green-400" />;
    case "removed":
      return <LuMinus className="w-3 h-3 text-red-400" />;
    case "moved":
      return <LuMove className="w-3 h-3 text-primary" />;
    case "resized":
      return <LuMove className="w-3 h-3 text-amber-400" />;
    case "textChanged":
      return <LuType className="w-3 h-3 text-purple-400" />;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlideDiffRowProps {
  diff: SlideDiff;
  diffIndex: number;
  canvasSize: CanvasSize;
  accepted: boolean;
  rejected: boolean;
  onAccept: (i: number) => void;
  onReject: (i: number) => void;
}

// ---------------------------------------------------------------------------
// Single diff row
// ---------------------------------------------------------------------------

export function SlideDiffRow({
  diff,
  diffIndex,
  canvasSize,
  accepted,
  rejected,
  onAccept,
  onReject,
}: SlideDiffRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(diff.status === "changed");

  const statusLabel = (() => {
    switch (diff.status) {
      case "added":
        return t("pptx.compare.statusAdded");
      case "removed":
        return t("pptx.compare.statusRemoved");
      case "changed":
        return t("pptx.compare.statusChanged");
      case "unchanged":
        return t("pptx.compare.statusUnchanged");
    }
  })();

  const statusColor = (() => {
    switch (diff.status) {
      case "added":
        return "text-green-400 bg-green-900/30";
      case "removed":
        return "text-red-400 bg-red-900/30";
      case "changed":
        return "text-amber-400 bg-amber-900/30";
      case "unchanged":
        return "text-muted-foreground bg-muted/30";
    }
  })();

  if (diff.status === "unchanged") return <React.Fragment />;

  const isResolved = accepted || rejected;
  const slideNumber =
    diff.baseIndex >= 0 ? diff.baseIndex + 1 : diff.compareIndex + 1;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isResolved
          ? "border-border/60 bg-card/40 opacity-60"
          : "border-border bg-background/70",
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <LuChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <LuChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-foreground">
          {t("pptx.compare.slideNumber", { number: slideNumber })}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusColor,
          )}
        >
          {statusLabel}
        </span>
        {diff.changes.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {diff.changes.length}{" "}
            {diff.changes.length === 1 ? "change" : "changes"}
          </span>
        )}
        <span className="flex-1" />
        {isResolved && (
          <span
            className={cn(
              "text-[10px] font-medium",
              accepted ? "text-green-400" : "text-muted-foreground",
            )}
          >
            {accepted ? t("pptx.compare.accepted") : t("pptx.compare.rejected")}
          </span>
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Side-by-side thumbnails */}
          <div className="flex gap-2">
            {diff.baseSlide && (
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">
                  {t("pptx.compare.current")}
                </div>
                <div className="rounded border border-border overflow-hidden">
                  <SlideThumbnail
                    slide={diff.baseSlide}
                    templateElements={[]}
                    canvasSize={canvasSize}
                  />
                </div>
              </div>
            )}
            {diff.compareSlide && (
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground mb-1">
                  {t("pptx.compare.incoming")}
                </div>
                <div
                  className={cn(
                    "rounded border overflow-hidden",
                    diff.status === "added"
                      ? "border-green-700/60"
                      : diff.status === "changed"
                        ? "border-amber-700/60"
                        : "border-border",
                  )}
                >
                  <SlideThumbnail
                    slide={diff.compareSlide}
                    templateElements={[]}
                    canvasSize={canvasSize}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Change list */}
          {diff.changes.length > 0 && (
            <div className="space-y-1">
              {diff.changes.map((change, ci) => (
                <div
                  key={`${change.elementId}-${change.kind}-${ci}`}
                  className="flex items-start gap-2 rounded bg-muted/60 px-2 py-1.5 text-[11px]"
                >
                  <ChangeKindIcon kind={change.kind} />
                  <span className="text-foreground">{change.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Accept / Reject buttons */}
          {!isResolved && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-green-700/80 px-2.5 py-1 text-[11px] text-green-50 hover:bg-green-600 transition-colors"
                onClick={() => onAccept(diffIndex)}
              >
                <LuCheck className="w-3 h-3" />
                {t("pptx.compare.accept")}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-[11px] text-foreground hover:bg-accent/80 transition-colors"
                onClick={() => onReject(diffIndex)}
              >
                <LuX className="w-3 h-3" />
                {t("pptx.compare.reject")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
