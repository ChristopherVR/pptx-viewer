import React from "react";
import { useTranslation } from "react-i18next";

import {
  LuClipboardPaste,
  LuCopy,
  LuCopyPlus,
  LuEye,
  LuEyeOff,
  LuTrash2,
} from "react-icons/lu";

import type { SlideSectionGroup } from "../../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SorterContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  hasClipboard: boolean;
  hasHiddenInSelection: boolean;
  hasVisibleInSelection: boolean;
  sectionGroups: SlideSectionGroup[];
  onDelete: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleHide: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SorterContextMenu({
  x,
  y,
  selectedCount,
  hasClipboard,
  hasHiddenInSelection,
  hasVisibleInSelection,
  sectionGroups: _sectionGroups,
  onDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onToggleHide,
  onClose,
}: SorterContextMenuProps): React.ReactElement {
  const { t } = useTranslation();

  // Constrain position to viewport
  const menuX = Math.max(8, Math.min(x, window.innerWidth - 220));
  const menuY = Math.max(8, Math.min(y, window.innerHeight - 300));

  const countLabel = selectedCount > 1 ? ` (${selectedCount})` : "";

  return (
    <>
      {/* Backdrop to close */}
      <div
        className="fixed inset-0 z-[119]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[120] min-w-[200px] rounded border border-border bg-popover shadow-2xl py-1.5 text-xs text-foreground"
        style={{ left: menuX, top: menuY }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
          onClick={onCopy}
        >
          <LuCopy className="h-3.5 w-3.5 text-muted-foreground" />
          {t("pptx.slideSorter.contextMenu.copy")}
          {countLabel}
        </button>
        {hasClipboard && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
            onClick={onPaste}
          >
            <LuClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
            {t("pptx.slideSorter.contextMenu.paste")}
          </button>
        )}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
          onClick={onDuplicate}
        >
          <LuCopyPlus className="h-3.5 w-3.5 text-muted-foreground" />
          {t("pptx.slideSorter.contextMenu.duplicate")}
          {countLabel}
        </button>

        <div className="my-1 border-t border-border" />

        {hasVisibleInSelection && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
            onClick={onToggleHide}
          >
            <LuEyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            {t("pptx.slideSorter.contextMenu.hideSlides")}
            {countLabel}
          </button>
        )}
        {hasHiddenInSelection && (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
            onClick={onToggleHide}
          >
            <LuEye className="h-3.5 w-3.5 text-muted-foreground" />
            {t("pptx.slideSorter.contextMenu.showSlides")}
            {countLabel}
          </button>
        )}

        <div className="my-1 border-t border-border" />

        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-300 hover:bg-red-900/40"
          onClick={onDelete}
        >
          <LuTrash2 className="h-3.5 w-3.5" />
          {t("pptx.slideSorter.contextMenu.delete")}
          {countLabel}
        </button>
      </div>
    </>
  );
}
