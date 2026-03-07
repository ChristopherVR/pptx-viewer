import React, { useState, useRef } from "react";
import { LuX, LuUpload } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { BUILT_IN_THEMES } from "./theme-gallery-data";
import { ThemeThumbnail } from "./ThemeThumbnail";

export type { ThemeDefinition, ThemeGalleryProps } from "./theme-gallery-types";
export { BUILT_IN_THEMES } from "./theme-gallery-data";
export { ThemeThumbnail } from "./ThemeThumbnail";

import type { ThemeDefinition, ThemeGalleryProps } from "./theme-gallery-types";

export function ThemeGallery({
  open,
  currentTheme,
  canEdit,
  onClose,
  onApplyTheme,
  onImportTheme,
}: ThemeGalleryProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [selectedTheme, setSelectedTheme] = useState<ThemeDefinition | null>(
    currentTheme ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleApply = (): void => {
    if (selectedTheme) {
      onApplyTheme(selectedTheme);
      onClose();
    }
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const file = event.target.files?.[0];
    if (file && onImportTheme) {
      onImportTheme(file);
    }
    // Reset the input so the same file can be selected again
    event.target.value = "";
  };

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t("common.close")}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t("powerpoint.toolbar.themes.gallery.title")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("powerpoint.toolbar.themes.gallery.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {BUILT_IN_THEMES.map((theme) => (
                <ThemeThumbnail
                  key={theme.id}
                  theme={theme}
                  selected={selectedTheme?.id === theme.id}
                  onClick={() => setSelectedTheme(theme)}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2">
              {onImportTheme && (
                <>
                  <button
                    type="button"
                    onClick={handleImportClick}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <LuUpload className="w-3.5 h-3.5" />
                    {t("powerpoint.toolbar.themes.gallery.importTheme")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".thmx,.pptx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-accent hover:bg-accent/80 text-xs font-medium text-foreground transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!canEdit || !selectedTheme}
                className="px-3 py-1.5 rounded bg-primary hover:bg-primary/80 text-xs font-medium text-primary-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("common.apply")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
