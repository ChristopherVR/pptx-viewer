/**
 * Inspector panel for the duotone image effect — two colour pickers
 * (shadow + highlight) plus quick-apply presets.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PptxElement } from "../../../core";
import { normalizeHexColor } from "../../utils";
import { DUOTONE_PRESETS } from "../../utils/duotone-effects";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DuotonePanelProps {
  selectedElement: PptxElement;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Debounced colour input (matches InspectorPane's pattern)
// ---------------------------------------------------------------------------

function DebouncedColorInput({
  value,
  disabled,
  className,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onCommit: (hex: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocal(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    commitRef.current(local);
  }, [local]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => {
      commitRef.current(el.value);
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  return (
    <input
      ref={inputRef}
      type="color"
      disabled={disabled}
      className={className}
      value={local}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DuotonePanel({
  selectedElement,
  canEdit,
  onUpdateElement,
}: DuotonePanelProps): React.ReactElement {
  const { t } = useTranslation();
  const effects =
    "imageEffects" in selectedElement
      ? (
          selectedElement as unknown as {
            imageEffects?: { duotone?: { color1: string; color2: string } };
          }
        ).imageEffects
      : undefined;

  const commitDuotone = useCallback(
    (color1: string, color2: string) => {
      onUpdateElement({
        imageEffects: {
          ...(effects ?? {}),
          duotone: { color1, color2 },
        },
      } as Partial<PptxElement>);
    },
    [effects, onUpdateElement],
  );

  const clearDuotone = useCallback(() => {
    onUpdateElement({
      imageEffects: {
        ...(effects ?? {}),
        duotone: undefined,
      },
    } as Partial<PptxElement>);
  }, [effects, onUpdateElement]);

  const shadowColor = normalizeHexColor(effects?.duotone?.color1, "#000000");
  const highlightColor = normalizeHexColor(effects?.duotone?.color2, "#ffffff");

  return (
    <div className="space-y-2 text-[11px]">
      <div className="text-muted-foreground font-medium">
        {t("pptx.image.duotone")}
      </div>

      {/* Colour pickers */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {t("pptx.image.duotoneShadows")}
          </span>
          <DebouncedColorInput
            disabled={!canEdit}
            value={shadowColor}
            className="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
            onCommit={(hex) => commitDuotone(hex, highlightColor)}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">
            {t("pptx.image.duotoneHighlights")}
          </span>
          <DebouncedColorInput
            disabled={!canEdit}
            value={highlightColor}
            className="h-6 w-8 rounded border border-border bg-transparent cursor-pointer"
            onCommit={(hex) => commitDuotone(shadowColor, hex)}
          />
        </label>
      </div>

      {/* Presets grid */}
      <div className="space-y-1">
        <div className="text-muted-foreground text-[10px]">
          {t("pptx.image.duotonePresets")}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {DUOTONE_PRESETS.map((preset) => (
            <button
              key={preset.labelKey}
              type="button"
              disabled={!canEdit}
              className="flex flex-col items-center gap-0.5 rounded border border-border hover:bg-accent p-1 transition-colors"
              title={t(preset.labelKey)}
              onClick={() => commitDuotone(preset.shadow, preset.highlight)}
            >
              <div className="flex h-4 w-full rounded overflow-hidden">
                <div
                  className="flex-1"
                  style={{ backgroundColor: preset.shadow }}
                />
                <div
                  className="flex-1"
                  style={{ backgroundColor: preset.highlight }}
                />
              </div>
              <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                {t(preset.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Clear button */}
      {effects?.duotone && (
        <button
          type="button"
          disabled={!canEdit}
          className="w-full rounded bg-muted hover:bg-accent border border-border px-2 py-1 text-foreground transition-colors"
          onClick={clearDuotone}
        >
          {t("pptx.image.duotoneClear")}
        </button>
      )}
    </div>
  );
}
