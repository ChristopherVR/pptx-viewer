/**
 * BroadcastDialog
 *
 * Placeholder dialog for "Present Online" / broadcast feature.
 * The actual broadcast requires WebRTC/WebSocket server infrastructure
 * which is not implemented in the MVP.
 */
import React from "react";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the {@link BroadcastDialog} component.
 */
export interface BroadcastDialogProps {
  /** Whether the dialog is currently visible. */
  open: boolean;
  /** Callback invoked when the user dismisses the dialog. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Placeholder modal dialog for the "Present Online" broadcast feature.
 *
 * The "Start Broadcast" button is intentionally disabled because the
 * underlying WebRTC / WebSocket server infrastructure is not yet
 * implemented. This dialog exists to surface the feature in the UI and
 * inform the user of its planned availability.
 *
 * @param props - {@link BroadcastDialogProps}
 * @returns The dialog element, or `null` when `open` is `false`.
 */
export function BroadcastDialog({
  open,
  onClose,
}: BroadcastDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!open) return null;

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
        <div className="pointer-events-auto w-[380px] rounded-xl border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {t("pptx.broadcast.title")}
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
          <div className="px-5 py-6 text-center">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {t("pptx.broadcast.description")}
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors"
            >
              {t("common.close")}
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-1.5 rounded bg-primary/40 text-[12px] text-white/50 cursor-not-allowed"
            >
              {t("pptx.broadcast.startBroadcast")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
