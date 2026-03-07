/**
 * KeepAnnotationsDialog — Prompted when the user exits presentation mode
 * with ink annotations present. Offers to persist annotations as ink
 * elements on the respective slides, or discard them.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { LuPenTool, LuTrash2 } from "react-icons/lu";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KeepAnnotationsDialogProps {
  isOpen: boolean;
  annotationCount: number;
  slideCount: number;
  onKeep: () => void;
  onDiscard: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeepAnnotationsDialog({
  isOpen,
  annotationCount,
  slideCount,
  onKeep,
  onDiscard,
}: KeepAnnotationsDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-[420px] max-w-[90vw] p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <LuPenTool className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("pptx.presentation.keepAnnotationsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("pptx.presentation.keepAnnotationsDescription", {
                count: annotationCount,
                slides: slideCount,
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors"
            onClick={onDiscard}
          >
            <LuTrash2 className="w-4 h-4" />
            {t("pptx.presentation.discardAnnotations")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={onKeep}
          >
            <LuPenTool className="w-4 h-4" />
            {t("pptx.presentation.keepAnnotations")}
          </button>
        </div>
      </div>
    </div>
  );
}
