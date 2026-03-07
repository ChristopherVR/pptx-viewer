/**
 * SetUpSlideShowDialog
 *
 * Modal dialog for configuring slide show settings (show type, slides range,
 * advance mode, loop, narration, animation, subtitles).
 */
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxPresentationProperties,
  PptxCustomShow,
} from "../../core";
import { ShowSlidesFieldset } from "./ShowSlidesFieldset";
import { ShowOptionsFieldset } from "./ShowOptionsFieldset";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SetUpSlideShowDialogProps {
  open: boolean;
  onClose: () => void;
  properties: PptxPresentationProperties;
  onSave: (properties: PptxPresentationProperties) => void;
  customShows: PptxCustomShow[];
  slideCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetUpSlideShowDialog({
  open,
  onClose,
  properties,
  onSave,
  customShows,
  slideCount,
}: SetUpSlideShowDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<PptxPresentationProperties>({
    ...properties,
  });

  const update = useCallback((patch: Partial<PptxPresentationProperties>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
    onClose();
  }, [draft, onSave, onClose]);

  if (!open) return null;

  const showType = draft.showType ?? "presented";
  const showSlidesMode = draft.showSlidesMode ?? "all";

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-[200] bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[440px] rounded-xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {t("pptx.slideShow.setUpTitle")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-5 text-[12px] text-foreground max-h-[70vh] overflow-y-auto">
            {/* Show Type */}
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {t("pptx.slideShow.showType")}
              </legend>
              {(
                [
                  ["presented", t("pptx.slideShow.presentedBySpeaker")],
                  ["browsed", t("pptx.slideShow.browsedByIndividual")],
                  ["kiosk", t("pptx.slideShow.browsedAtKiosk")],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="showType"
                    value={value}
                    checked={showType === value}
                    onChange={() =>
                      update({
                        showType: value,
                        ...(value === "kiosk"
                          ? { loopContinuously: true }
                          : {}),
                      })
                    }
                    className="accent-primary"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <ShowSlidesFieldset
              draft={draft}
              update={update}
              showSlidesMode={showSlidesMode}
              slideCount={slideCount}
              customShows={customShows}
            />

            {/* Advance Slides */}
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {t("pptx.slideShow.advanceSlides")}
              </legend>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="advanceMode"
                  value="manual"
                  checked={(draft.advanceMode ?? "manual") === "manual"}
                  onChange={() => update({ advanceMode: "manual" })}
                  className="accent-primary"
                />
                <span>{t("pptx.slideShow.manually")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="advanceMode"
                  value="useTimings"
                  checked={draft.advanceMode === "useTimings"}
                  onChange={() => update({ advanceMode: "useTimings" })}
                  className="accent-primary"
                />
                <span>{t("pptx.slideShow.useTimings")}</span>
              </label>
            </fieldset>

            <ShowOptionsFieldset draft={draft} update={update} />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded bg-primary hover:bg-primary/80 text-[12px] text-white transition-colors"
            >
              {t("common.ok")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
