import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxTheme,
  PptxThemeColorScheme,
  PptxThemeFontScheme,
} from "pptx-viewer-core";

import type { PresetTheme } from "./theme-editor-presets";
import { PRESET_THEMES } from "./theme-editor-presets";
import {
  THEME_EDITOR_CARD,
  THEME_EDITOR_HEADING,
  THEME_EDITOR_INPUT,
  THEME_EDITOR_BTN,
  THEME_EDITOR_BTN_SECONDARY,
} from "./theme-editor-constants";
import { ThemePresetGallery } from "./ThemePresetGallery";
import { ThemeColorSchemeEditor } from "./ThemeColorSchemeEditor";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThemeEditorPanelProps {
  theme: PptxTheme | undefined;
  canEdit: boolean;
  onUpdateColorScheme: (colorScheme: PptxThemeColorScheme) => void;
  onUpdateFontScheme: (fontScheme: PptxThemeFontScheme) => void;
  onUpdateThemeName: (name: string) => void;
  onApplyToPresentation: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThemeEditorPanel({
  theme,
  canEdit,
  onUpdateColorScheme,
  onUpdateFontScheme,
  onUpdateThemeName,
  onApplyToPresentation,
  onClose,
}: ThemeEditorPanelProps): React.ReactElement {
  const { t } = useTranslation();

  // Local editing state — seeded from the current theme
  const [editColors, setEditColors] = useState<PptxThemeColorScheme>(
    () => theme?.colorScheme ?? PRESET_THEMES[0].colorScheme,
  );
  const [majorFont, setMajorFont] = useState(
    () => theme?.fontScheme?.majorFont?.latin ?? "Calibri Light",
  );
  const [minorFont, setMinorFont] = useState(
    () => theme?.fontScheme?.minorFont?.latin ?? "Calibri",
  );
  const [themeName, setThemeName] = useState(
    () => theme?.name ?? "Custom Theme",
  );

  // Which color slot is being edited with the native picker
  const [activePickerKey, setActivePickerKey] = useState<
    keyof PptxThemeColorScheme | null
  >(null);

  // Handle a single color change
  const handleColorChange = useCallback(
    (key: keyof PptxThemeColorScheme, hex: string) => {
      const next = { ...editColors, [key]: hex };
      setEditColors(next);
      onUpdateColorScheme(next);
    },
    [editColors, onUpdateColorScheme],
  );

  // Apply a preset
  const handleSelectPreset = useCallback(
    (preset: PresetTheme) => {
      setEditColors(preset.colorScheme);
      setMajorFont(preset.majorFont);
      setMinorFont(preset.minorFont);
      setThemeName(preset.name);
      onUpdateColorScheme(preset.colorScheme);
      onUpdateFontScheme({
        majorFont: { latin: preset.majorFont },
        minorFont: { latin: preset.minorFont },
      });
      onUpdateThemeName(preset.name);
    },
    [onUpdateColorScheme, onUpdateFontScheme, onUpdateThemeName],
  );

  // Reset to original theme from file
  const handleReset = useCallback(() => {
    if (!theme?.colorScheme) return;
    setEditColors(theme.colorScheme);
    setMajorFont(theme.fontScheme?.majorFont?.latin ?? "Calibri Light");
    setMinorFont(theme.fontScheme?.minorFont?.latin ?? "Calibri");
    setThemeName(theme.name ?? "Custom Theme");
    onUpdateColorScheme(theme.colorScheme);
    onUpdateFontScheme({
      majorFont: {
        latin: theme.fontScheme?.majorFont?.latin ?? "Calibri Light",
      },
      minorFont: { latin: theme.fontScheme?.minorFont?.latin ?? "Calibri" },
    });
    onUpdateThemeName(theme.name ?? "Custom Theme");
  }, [theme, onUpdateColorScheme, onUpdateFontScheme, onUpdateThemeName]);

  const handleMajorFontChange = useCallback(
    (font: string) => {
      setMajorFont(font);
      onUpdateFontScheme({
        majorFont: { latin: font },
        minorFont: { latin: minorFont },
      });
    },
    [minorFont, onUpdateFontScheme],
  );

  const handleMinorFontChange = useCallback(
    (font: string) => {
      setMinorFont(font);
      onUpdateFontScheme({
        majorFont: { latin: majorFont },
        minorFont: { latin: font },
      });
    },
    [majorFont, onUpdateFontScheme],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      setThemeName(name);
      onUpdateThemeName(name);
    },
    [onUpdateThemeName],
  );

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("pptx.themeEditor.title")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={t("pptx.themeEditor.close")}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Theme Name */}
      <div className={THEME_EDITOR_CARD}>
        <div className={THEME_EDITOR_HEADING}>
          {t("pptx.themeEditor.themeName")}
        </div>
        <input
          type="text"
          className={THEME_EDITOR_INPUT}
          disabled={!canEdit}
          value={themeName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={t("pptx.themeEditor.themeNamePlaceholder")}
        />
      </div>

      {/* Preset Theme Gallery */}
      <ThemePresetGallery
        canEdit={canEdit}
        currentThemeName={themeName}
        onSelectPreset={handleSelectPreset}
      />

      {/* Color Scheme, Preview Grid & Font Pair */}
      <ThemeColorSchemeEditor
        editColors={editColors}
        canEdit={canEdit}
        activePickerKey={activePickerKey}
        majorFont={majorFont}
        minorFont={minorFont}
        onSetActivePickerKey={setActivePickerKey}
        onColorChange={handleColorChange}
        onMajorFontChange={handleMajorFontChange}
        onMinorFontChange={handleMinorFontChange}
      />

      {/* Actions */}
      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          disabled={!canEdit}
          className={THEME_EDITOR_BTN}
          onClick={onApplyToPresentation}
        >
          {t("pptx.themeEditor.applyToPresentation")}
        </button>
        <button
          type="button"
          disabled={!canEdit}
          className={THEME_EDITOR_BTN_SECONDARY}
          onClick={handleReset}
        >
          {t("pptx.themeEditor.reset")}
        </button>
      </div>
    </div>
  );
}
