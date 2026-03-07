import React from "react";
import { useTranslation } from "react-i18next";
import type { AutosaveStatus } from "../hooks/useAutosave";

interface StatusBarProps {
  slideCount: number;
  activeSlideIndex: number;
  isDirty: boolean;
  autosaveStatus?: AutosaveStatus;
}

function formatAutosaveAge(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

export function StatusBar({
  slideCount,
  activeSlideIndex,
  isDirty,
  autosaveStatus,
}: StatusBarProps): React.ReactElement {
  const { t } = useTranslation();

  // Build the right-side status text
  let statusText: string;
  if (autosaveStatus?.state === "saving") {
    statusText = t("pptx.autosave.saving");
  } else if (autosaveStatus?.state === "saved") {
    statusText = t("pptx.autosave.saved", {
      time: formatAutosaveAge(autosaveStatus.timestamp),
    });
  } else if (autosaveStatus?.state === "error") {
    statusText = t("pptx.autosave.error");
  } else if (isDirty) {
    statusText = t("pptx.statusBar.unsavedChanges");
  } else {
    statusText = t("pptx.statusBar.allSaved");
  }

  return (
    <div className="px-3 py-1 border-t border-border bg-background/50 text-[10px] text-muted-foreground flex items-center justify-between">
      <span>
        {slideCount > 0
          ? `Slide ${Math.min(activeSlideIndex + 1, slideCount)} of ${slideCount}`
          : "No slides"}
      </span>
      <span
        className={
          autosaveStatus?.state === "error"
            ? "text-red-400"
            : autosaveStatus?.state === "saving"
              ? "text-yellow-400"
              : ""
        }
      >
        {statusText}
      </span>
    </div>
  );
}
