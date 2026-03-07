/**
 * Inspector panel for alpha (transparency) and bi-level (1-bit threshold)
 * image adjustments.  Maps to `a:alphaModFix` and `a:biLevel` in OOXML.
 */
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxElement,
  PptxImageEffects,
} from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImageAdjustmentsPanelProps {
  selectedElement: PptxElement;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageAdjustmentsPanel({
  selectedElement,
  canEdit,
  onUpdateElement,
}: ImageAdjustmentsPanelProps): React.ReactElement {
  const { t } = useTranslation();

  const effects: PptxImageEffects | undefined = useMemo(
    () =>
      "imageEffects" in selectedElement
        ? (selectedElement as unknown as { imageEffects?: PptxImageEffects })
            .imageEffects
        : undefined,
    [selectedElement],
  );

  // alphaModFix: 100 = fully opaque.  PowerPoint shows "Transparency" inverted.
  const alphaModFix = effects?.alphaModFix ?? 100;
  const transparency = 100 - alphaModFix;

  const biLevelThreshold = effects?.biLevel ?? 0;

  const hasValues =
    effects?.alphaModFix !== undefined || effects?.biLevel !== undefined;

  // ── handlers ──────────────────────────────────────────────────────────

  const commitEffects = useCallback(
    (patch: Partial<PptxImageEffects>) => {
      onUpdateElement({
        imageEffects: {
          ...(effects ?? {}),
          ...patch,
        },
      } as Partial<PptxElement>);
    },
    [effects, onUpdateElement],
  );

  const handleTransparencyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      commitEffects({ alphaModFix: 100 - val });
    },
    [commitEffects],
  );

  const handleBiLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      commitEffects({ biLevel: Number(e.target.value) });
    },
    [commitEffects],
  );

  const handleReset = useCallback(() => {
    commitEffects({ alphaModFix: undefined, biLevel: undefined });
  }, [commitEffects]);

  // ── render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground font-medium">
          {t("pptx.imageAdjustments.title")}
        </span>
        {hasValues && (
          <button
            type="button"
            disabled={!canEdit}
            className="rounded bg-muted hover:bg-accent border border-border px-1.5 py-0.5 text-[10px] text-foreground disabled:opacity-50"
            onClick={handleReset}
          >
            {t("common.reset")}
          </button>
        )}
      </div>

      {/* Transparency slider */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">
          {t("pptx.imageAdjustments.transparency")}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!canEdit}
            className="accent-primary flex-1"
            value={transparency}
            onChange={handleTransparencyChange}
          />
          <span className="w-8 text-right tabular-nums text-muted-foreground">
            {transparency}%
          </span>
        </div>
      </label>

      {/* Bi-Level threshold slider */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">
          {t("pptx.imageAdjustments.biLevelThreshold")}
        </span>
        <p className="text-[10px] text-muted-foreground/70">
          {t("pptx.imageAdjustments.biLevelDescription")}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!canEdit}
            className="accent-primary flex-1"
            value={biLevelThreshold}
            onChange={handleBiLevelChange}
          />
          <span className="w-8 text-right tabular-nums text-muted-foreground">
            {biLevelThreshold}
          </span>
        </div>
      </label>
    </div>
  );
}
