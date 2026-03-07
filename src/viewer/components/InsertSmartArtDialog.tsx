import React, { useState, useCallback } from "react";
import { LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { cn } from "../utils";
import type { SmartArtLayout } from "../../core";
import type { SmartArtCategory } from "./smart-art-presets";
import { PRESETS, CATEGORIES } from "./smart-art-presets";
import { getPreviewForLayout } from "./SmartArtPreviews";

// ── Dialog Component ────────────────────────────────────────────────────────

export interface InsertSmartArtDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (layout: SmartArtLayout, defaultItems: string[]) => void;
}

export function InsertSmartArtDialog({
  isOpen,
  onClose,
  onInsert,
}: InsertSmartArtDialogProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] =
    useState<SmartArtCategory>("list");
  const [selectedLayout, setSelectedLayout] = useState<SmartArtLayout | null>(
    null,
  );

  const filteredPresets = PRESETS.filter((p) => p.category === activeCategory);

  const handleInsert = useCallback(() => {
    if (!selectedLayout) return;
    const preset = PRESETS.find((p) => p.layout === selectedLayout);
    if (!preset) return;
    onInsert(preset.layout, preset.defaultItems);
    onClose();
  }, [selectedLayout, onInsert, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-[600px] max-w-[90vw] max-h-[80vh] rounded-lg border border-border bg-background shadow-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={t("pptx.smartart.insertTitle")}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">
              {t("pptx.smartart.insertTitle")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
              aria-label={t("pptx.smartart.close")}
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Category sidebar */}
            <div className="w-40 border-r border-border py-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedLayout(null);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs transition-colors",
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {t(cat.label)}
                </button>
              ))}
            </div>

            {/* Gallery grid */}
            <div className="flex-1 p-3 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.layout}
                    type="button"
                    onClick={() => setSelectedLayout(preset.layout)}
                    onDoubleClick={() => {
                      setSelectedLayout(preset.layout);
                      onInsert(preset.layout, preset.defaultItems);
                      onClose();
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded border transition-colors",
                      selectedLayout === preset.layout
                        ? "border-primary bg-primary/20"
                        : "border-border hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="w-16 h-12 flex items-center justify-center bg-muted rounded">
                      {getPreviewForLayout(preset.layout)}
                    </div>
                    <span className="text-[10px] text-foreground text-center leading-tight">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded bg-muted hover:bg-accent text-foreground transition-colors"
            >
              {t("pptx.smartart.cancel")}
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={!selectedLayout}
              className={cn(
                "px-3 py-1.5 text-xs rounded transition-colors",
                selectedLayout
                  ? "bg-primary hover:bg-primary/80 text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              {t("pptx.smartart.insert")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
