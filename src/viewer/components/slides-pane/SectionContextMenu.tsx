import type React from "react";
import { useTranslation } from "react-i18next";

import type { SlideSectionGroup } from "../../types";
import type { SectionContextMenuState } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionContextMenuProps {
  state: SectionContextMenuState;
  sectionGroups: SlideSectionGroup[];
  totalSlides: number;
  onStartRename: (sectionId: string, currentLabel: string) => void;
  onDeleteSection?: (sectionId: string) => void;
  onMoveSectionUp?: (sectionId: string) => void;
  onMoveSectionDown?: (sectionId: string) => void;
  onAddSection?: (name: string, afterSlideIndex: number) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectionContextMenu({
  state,
  sectionGroups,
  totalSlides,
  onStartRename,
  onDeleteSection,
  onMoveSectionUp,
  onMoveSectionDown,
  onAddSection,
  onClose,
}: SectionContextMenuProps): React.ReactElement {
  const { t } = useTranslation();

  const handleAddSectionAfter = () => {
    const group = sectionGroups.find((g) => g.id === state.sectionId);
    if (!group) return;
    const lastSlideIndex =
      group.slideIndexes[group.slideIndexes.length - 1] ?? 0;
    const nextSlideIndex = Math.min(lastSlideIndex + 1, totalSlides - 1);
    onAddSection?.(t("pptx.sections.defaultName"), nextSlideIndex);
    onClose();
  };

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-xl"
      style={{ left: state.x, top: state.y }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        onClick={() => {
          const group = sectionGroups.find((g) => g.id === state.sectionId);
          if (group) {
            onStartRename(state.sectionId, group.label);
          }
        }}
      >
        {t("pptx.sections.rename")}
      </button>
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        onClick={() => {
          onDeleteSection?.(state.sectionId);
          onClose();
        }}
      >
        {t("pptx.sections.delete")}
      </button>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={state.sectionIndex === 0}
        onClick={() => {
          onMoveSectionUp?.(state.sectionId);
          onClose();
        }}
      >
        {t("pptx.sections.moveUp")}
      </button>
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={state.sectionIndex >= state.totalSections - 1}
        onClick={() => {
          onMoveSectionDown?.(state.sectionId);
          onClose();
        }}
      >
        {t("pptx.sections.moveDown")}
      </button>
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        onClick={handleAddSectionAfter}
      >
        {t("pptx.sections.addAfter")}
      </button>
    </div>
  );
}
