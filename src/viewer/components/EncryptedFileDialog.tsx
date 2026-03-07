import React from "react";
import { LuLock, LuX, LuInfo } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EncryptedFileDialog({
  isOpen,
  onClose,
}: EncryptedFileDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[420px] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <LuLock className="w-5 h-5 text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.encryptedFile.title")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3">
              <LuInfo className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs text-red-200">
                  {t("pptx.encryptedFile.message")}
                </p>
                <p className="text-[11px] text-red-300/70">
                  {t("pptx.encryptedFile.instructions")}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg bg-accent text-foreground hover:bg-accent/80 transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
