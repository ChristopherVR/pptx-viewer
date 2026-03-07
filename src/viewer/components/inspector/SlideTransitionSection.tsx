import React from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxSlideTransition,
  PptxTransitionType,
} from "../../../core";
import { TRANSITION_VALID_DIRECTIONS } from "../../../core";
import { SLIDE_TRANSITION_OPTIONS } from "../../constants";
import { DirectionPicker } from "./DirectionPicker";
import { TransitionPreview } from "./TransitionPreview";

// ---------------------------------------------------------------------------
// Transition types that use orientation (horz/vert) instead of direction
// ---------------------------------------------------------------------------

const ORIENTATION_TYPES: ReadonlySet<PptxTransitionType> = new Set([
  "blinds",
  "checker",
  "comb",
  "randomBar",
]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SlideTransitionSectionProps {
  activeSlide: { transition?: PptxSlideTransition } | null;
  onTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideTransitionSection({
  activeSlide,
  onTransitionChange,
}: SlideTransitionSectionProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!activeSlide) return null;

  const transitionType: PptxTransitionType =
    activeSlide.transition?.type ?? "none";
  const validDirections = TRANSITION_VALID_DIRECTIONS[transitionType];
  const hasDirections =
    validDirections !== undefined && validDirections.length > 0;
  const usesOrientation = ORIENTATION_TYPES.has(transitionType);
  const isWheel = transitionType === "wheel";

  return (
    <div className="mb-3 rounded border border-border bg-card p-2 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Slide Transition
      </div>

      {/* Type */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">
          {t("pptx.transition.type")}
        </span>
        <select
          value={activeSlide.transition?.type || "none"}
          onChange={(e) =>
            onTransitionChange({
              type: e.target.value as NonNullable<PptxSlideTransition["type"]>,
            })
          }
          className="bg-muted border border-border rounded px-2 py-1"
        >
          {SLIDE_TRANSITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {/* Direction picker */}
      {hasDirections && !usesOrientation && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">
            {t("pptx.transition.direction")}
          </span>
          <DirectionPicker
            directions={validDirections}
            value={activeSlide.transition?.direction}
            onChange={(dir) => onTransitionChange({ direction: dir })}
          />
        </div>
      )}

      {/* Orientation picker */}
      {usesOrientation && (
        <div className="space-y-1">
          <span className="text-muted-foreground text-xs">
            {t("pptx.transition.orientation")}
          </span>
          <div className="flex gap-1">
            {(["horz", "vert"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onTransitionChange({ orient: o })}
                className={`px-2 py-1 rounded text-xs border ${
                  (activeSlide.transition?.orient ?? "horz") === o
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:bg-accent"
                }`}
              >
                {t(
                  o === "horz"
                    ? "pptx.transition.horizontal"
                    : "pptx.transition.vertical",
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spokes for wheel */}
      {isWheel && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t("pptx.transition.spokes")}
          </span>
          <input
            type="number"
            min={1}
            max={8}
            value={activeSlide.transition?.spokes ?? 4}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!Number.isFinite(val)) return;
              onTransitionChange({
                spokes: Math.max(1, Math.min(8, Math.round(val))),
              });
            }}
            className="bg-muted border border-border rounded px-2 py-1 text-xs w-16"
          />
        </label>
      )}

      {/* Duration */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">
          {t("pptx.transition.duration")}
        </span>
        <input
          type="number"
          min={0}
          max={10000}
          value={Math.round(activeSlide.transition?.durationMs || 320)}
          onChange={(e) => {
            const durationMs = Number(e.target.value);
            if (!Number.isFinite(durationMs)) return;
            onTransitionChange({
              durationMs: Math.max(0, Math.min(10000, durationMs)),
            });
          }}
          className="bg-muted border border-border rounded px-2 py-1"
        />
      </label>

      {/* Advance on click */}
      <label className="inline-flex items-center gap-2 text-foreground text-xs">
        <input
          type="checkbox"
          checked={activeSlide.transition?.advanceOnClick !== false}
          onChange={(e) =>
            onTransitionChange({ advanceOnClick: e.target.checked })
          }
        />
        {t("pptx.transition.advanceOnClick")}
      </label>

      {/* Sound */}
      {activeSlide.transition?.soundFileName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="text-muted-foreground">
            {t("pptx.transition.sound")}:
          </span>
          <span
            className="text-foreground truncate"
            title={activeSlide.transition.soundFileName}
          >
            {activeSlide.transition.soundFileName}
          </span>
        </div>
      )}

      {/* Preview */}
      {activeSlide.transition && (
        <TransitionPreview transition={activeSlide.transition} />
      )}
    </div>
  );
}
