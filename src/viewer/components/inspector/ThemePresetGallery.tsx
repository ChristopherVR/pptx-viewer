import React from "react";
import { useTranslation } from "react-i18next";

import type { PresetTheme } from "./theme-editor-presets";
import { PRESET_THEMES } from "./theme-editor-presets";
import {
  THEME_EDITOR_CARD,
  THEME_EDITOR_HEADING,
} from "./theme-editor-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemePresetGalleryProps {
  canEdit: boolean;
  currentThemeName: string;
  onSelectPreset: (preset: PresetTheme) => void;
}

// ---------------------------------------------------------------------------
// Accent keys rendered in each preset swatch
// ---------------------------------------------------------------------------

const ACCENT_KEYS = [
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThemePresetGallery({
  canEdit,
  currentThemeName,
  onSelectPreset,
}: ThemePresetGalleryProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={THEME_EDITOR_CARD}>
      <div className={THEME_EDITOR_HEADING}>
        {t("pptx.themeEditor.presetThemes")}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESET_THEMES.map((preset) => (
          <button
            key={preset.name}
            type="button"
            disabled={!canEdit}
            className={`flex flex-col items-start gap-1 rounded border p-1.5 text-left transition-colors ${
              currentThemeName === preset.name
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground hover:bg-muted"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            onClick={() => onSelectPreset(preset)}
            title={preset.name}
          >
            <div className="flex gap-px w-full">
              {ACCENT_KEYS.map((key) => (
                <div
                  key={key}
                  className="h-3 flex-1 first:rounded-l-sm last:rounded-r-sm"
                  style={{ backgroundColor: preset.colorScheme[key] }}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full">
              {preset.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
