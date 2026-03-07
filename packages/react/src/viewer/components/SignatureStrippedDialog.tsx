import React from "react";
import { LuTriangleAlert, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignatureStrippedDialogProps {
  isOpen: boolean;
  signatureCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Warning dialog shown when the user first edits a signed document.
 * Informs that digital signatures will be invalidated and stripped on save.
 */
export function SignatureStrippedDialog({
  isOpen,
  signatureCount,
  onConfirm,
  onCancel,
}: SignatureStrippedDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label={t("common.close")}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[440px] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <LuTriangleAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.digitalSignatures.strippedTitle")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-6">
            <div className="flex items-start gap-3 rounded-lg bg-amber-900/20 border border-amber-700/30 px-4 py-3">
              <LuTriangleAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs text-amber-200">
                  {t("pptx.digitalSignatures.strippedMessage", {
                    count: signatureCount,
                  })}
                </p>
                <p className="text-[11px] text-amber-300/70">
                  {t("pptx.digitalSignatures.editWarning")}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs rounded-lg bg-accent text-foreground hover:bg-accent/80 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors"
            >
              {t("pptx.digitalSignatures.strippedConfirm")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
