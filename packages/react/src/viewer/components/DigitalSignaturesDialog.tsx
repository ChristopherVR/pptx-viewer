import React from "react";
import {
  LuShieldCheck,
  LuShieldAlert,
  LuX,
  LuInfo,
  LuSignature,
} from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the {@link DigitalSignaturesDialog} component.
 */
export interface DigitalSignaturesDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Callback invoked when the dialog is dismissed. */
  onClose: () => void;
  /** Whether the presentation contains digital signatures. */
  hasSignatures: boolean;
  /** Number of digital signatures present in the file. */
  signatureCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog that displays the digital signature status of a PPTX file.
 *
 * When signatures are present the dialog shows a signed-status banner with
 * the signature count and a warning that editing will invalidate signatures.
 * When no signatures are found, an informational notice is displayed instead.
 *
 * @param props - {@link DigitalSignaturesDialogProps}
 * @returns The dialog element, or `null` when `isOpen` is `false`.
 */
export function DigitalSignaturesDialog({
  isOpen,
  onClose,
  hasSignatures,
  signatureCount,
}: DigitalSignaturesDialogProps): React.ReactElement | null {
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
              {hasSignatures ? (
                <LuShieldCheck className="w-5 h-5 text-green-400" />
              ) : (
                <LuShieldAlert className="w-5 h-5 text-amber-400" />
              )}
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.digitalSignatures.title")}
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
            {hasSignatures ? (
              <>
                {/* Signed status */}
                <div className="flex items-start gap-3 rounded-lg bg-green-900/20 border border-green-700/30 px-4 py-3">
                  <LuSignature className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs text-green-200">
                      {t("pptx.digitalSignatures.signed")}
                    </p>
                    <p className="text-[11px] text-green-300/70">
                      {t("pptx.digitalSignatures.signatureCount", {
                        count: signatureCount,
                      })}
                    </p>
                  </div>
                </div>

                {/* Edit warning */}
                <div className="flex items-start gap-3 rounded-lg bg-amber-900/20 border border-amber-700/30 px-4 py-3">
                  <LuInfo className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">
                    {t("pptx.digitalSignatures.editWarning")}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* No signatures */}
                <div className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border/40 px-4 py-3">
                  <LuInfo className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    {t("pptx.digitalSignatures.noSignatures")}
                  </p>
                </div>
              </>
            )}
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
