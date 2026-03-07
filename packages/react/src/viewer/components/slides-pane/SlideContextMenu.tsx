import type React from "react";
import { useTranslation } from "react-i18next";

import type { SlideContextMenuState } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SlideContextMenuProps {
  state: SlideContextMenuState;
  onAddSection?: (name: string, afterSlideIndex: number) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlideContextMenu({
  state,
  onAddSection,
  onClose,
}: SlideContextMenuProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-xl"
      style={{ left: state.x, top: state.y }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        onClick={() => {
          onAddSection?.(t("pptx.sections.defaultName"), state.slideIndex);
          onClose();
        }}
      >
        {t("pptx.sections.addBefore")}
      </button>
    </div>
  );
}
