/**
 * ExportProgressModal — A modal overlay that shows export progress
 * for video, GIF, and package-for-sharing operations.
 */
import { useTranslation } from "react-i18next";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExportProgressModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Title shown at the top of the modal. */
  title: string;
  /** Current progress (0-100). */
  progress: number;
  /** Optional status message. */
  statusMessage?: string;
  /** Callback to cancel the export. */
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ExportProgressModal({
  isOpen,
  title,
  progress,
  statusMessage,
  onCancel,
}: ExportProgressModalProps): React.ReactElement | null {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-xl border border-border bg-background p-6 shadow-2xl">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>

        {/* Progress bar */}
        <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {/* Status text */}
        <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{statusMessage ?? t("pptx.export.processing")}</span>
          <span className="tabular-nums">{clampedProgress}%</span>
        </div>

        {/* Cancel button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-muted px-4 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
          >
            {t("pptx.export.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
