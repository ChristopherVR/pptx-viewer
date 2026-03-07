import React, { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import type { PptxThemeColorScheme } from "../../../core";
import { THEME_COLOR_SCHEME_KEYS } from "../../../core";
import { buildThemeColorGrid, THEME_COLOR_LABELS } from "../../utils/theme";
import { COMMON_FONTS } from "./theme-editor-presets";
import {
  THEME_EDITOR_CARD as CARD,
  THEME_EDITOR_HEADING as HEADING,
  THEME_EDITOR_INPUT as INPUT,
} from "./theme-editor-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemeColorSchemeEditorProps {
  editColors: PptxThemeColorScheme;
  canEdit: boolean;
  activePickerKey: keyof PptxThemeColorScheme | null;
  majorFont: string;
  minorFont: string;
  onSetActivePickerKey: (key: keyof PptxThemeColorScheme | null) => void;
  onColorChange: (key: keyof PptxThemeColorScheme, hex: string) => void;
  onMajorFontChange: (font: string) => void;
  onMinorFontChange: (font: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThemeColorSchemeEditor({
  editColors,
  canEdit,
  activePickerKey,
  majorFont,
  minorFont,
  onSetActivePickerKey,
  onColorChange,
  onMajorFontChange,
  onMinorFontChange,
}: ThemeColorSchemeEditorProps): React.ReactElement {
  const { t } = useTranslation();

  const previewGrid = useMemo(
    () => buildThemeColorGrid(editColors),
    [editColors],
  );

  const handleColorText = useCallback(
    (val: string) => {
      if (activePickerKey && /^#[0-9a-fA-F]{6}$/.test(val)) {
        onColorChange(activePickerKey, val);
      }
    },
    [activePickerKey, onColorChange],
  );

  return (
    <>
      {/* Color Scheme Editor */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.themeEditor.colorScheme")}</div>
        <div className="grid grid-cols-4 gap-1.5">
          {THEME_COLOR_SCHEME_KEYS.map((key) => (
            <div key={key} className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                disabled={!canEdit}
                className={`h-6 w-full rounded-sm border transition-colors ${
                  activePickerKey === key
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                style={{ backgroundColor: editColors[key] }}
                title={`${THEME_COLOR_LABELS[key]}: ${editColors[key]}`}
                onClick={() =>
                  onSetActivePickerKey(activePickerKey === key ? null : key)
                }
              />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                {THEME_COLOR_LABELS[key]}
              </span>
            </div>
          ))}
        </div>

        {/* Inline color picker for active slot */}
        {activePickerKey && (
          <div className="mt-2 flex items-center gap-2 rounded bg-background p-2">
            <span className="text-[10px] text-muted-foreground min-w-[60px]">
              {THEME_COLOR_LABELS[activePickerKey]}
            </span>
            <input
              type="color"
              disabled={!canEdit}
              className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              value={editColors[activePickerKey]}
              onChange={(e) => onColorChange(activePickerKey, e.target.value)}
            />
            <input
              type="text"
              disabled={!canEdit}
              className="flex-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-foreground font-mono"
              value={editColors[activePickerKey]}
              onChange={(e) => handleColorText(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Live Preview Grid */}
      {previewGrid && (
        <div className={CARD}>
          <div className={HEADING}>{t("pptx.themeEditor.preview")}</div>
          <div className="flex flex-col gap-px">
            {previewGrid.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-12 gap-px">
                {row.map((cell) => (
                  <div
                    key={`${cell.schemeKey}-${rowIdx}`}
                    className="h-3.5 rounded-sm"
                    style={{ backgroundColor: cell.hex }}
                    title={`${cell.colLabel} -- ${cell.rowLabel} (${cell.hex})`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Font Pair */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.themeEditor.fonts")}</div>
        <div className="space-y-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">
              {t("pptx.themeEditor.headingFont")}
            </span>
            <select
              className={INPUT}
              disabled={!canEdit}
              value={
                COMMON_FONTS.includes(majorFont) ? majorFont : "__custom__"
              }
              onChange={(e) => {
                if (e.target.value !== "__custom__")
                  onMajorFontChange(e.target.value);
              }}
            >
              {COMMON_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              {!COMMON_FONTS.includes(majorFont) && (
                <option value="__custom__">{majorFont}</option>
              )}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground">
              {t("pptx.themeEditor.bodyFont")}
            </span>
            <select
              className={INPUT}
              disabled={!canEdit}
              value={
                COMMON_FONTS.includes(minorFont) ? minorFont : "__custom__"
              }
              onChange={(e) => {
                if (e.target.value !== "__custom__")
                  onMinorFontChange(e.target.value);
              }}
            >
              {COMMON_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              {!COMMON_FONTS.includes(minorFont) && (
                <option value="__custom__">{minorFont}</option>
              )}
            </select>
          </label>
          <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
            <span style={{ fontFamily: majorFont }} className="text-foreground">
              {t("pptx.themeEditor.headingSample")}
            </span>
            <span className="text-muted-foreground">|</span>
            <span style={{ fontFamily: minorFont }} className="text-foreground">
              {t("pptx.themeEditor.bodySample")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
