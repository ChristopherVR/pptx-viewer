import { useEffect } from "react";
import type React from "react";

import type { PptxSlide } from "../../../core";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  type SorterContextMenuState,
} from "./types";

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

interface UseKeyboardShortcutsParams {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canEdit: boolean;
  selectedSlideIds: string[];
  selectedIndexes: number[];
  contextMenu: SorterContextMenuState | null;
  setContextMenu: React.Dispatch<
    React.SetStateAction<SorterContextMenuState | null>
  >;
  setSelectedSlideIds: React.Dispatch<React.SetStateAction<string[]>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  handleDeleteSelected: () => void;
  handleCopySelected: () => void;
  handlePaste: () => void;
  handleDuplicateSelected: () => void;
  handleSelectAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): void {
  const {
    slides,
    activeSlideIndex,
    canEdit,
    selectedSlideIds,
    selectedIndexes,
    contextMenu,
    setContextMenu,
    setSelectedSlideIds,
    setZoom,
    onClose,
    handleDeleteSelected,
    handleCopySelected,
    handlePaste,
    handleDuplicateSelected,
    handleSelectAll,
  } = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (contextMenu) setContextMenu(null);
      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        e.stopPropagation();
        if (selectedSlideIds.length > 1) {
          const activeSlide = slides[activeSlideIndex];
          setSelectedSlideIds(activeSlide?.id ? [activeSlide.id] : []);
        } else {
          onClose();
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && canEdit) {
        e.preventDefault();
        if (selectedIndexes.length > 0) handleDeleteSelected();
        return;
      }
      if (isCtrl && e.key === "c") {
        e.preventDefault();
        handleCopySelected();
        return;
      }
      if (isCtrl && e.key === "v" && canEdit) {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (isCtrl && e.key === "d" && canEdit) {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (isCtrl && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (isCtrl && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
        return;
      }
      if (isCtrl && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClose,
    canEdit,
    selectedSlideIds,
    selectedIndexes,
    activeSlideIndex,
    slides,
    contextMenu,
    setContextMenu,
    setSelectedSlideIds,
    setZoom,
    handleDeleteSelected,
    handleCopySelected,
    handlePaste,
    handleDuplicateSelected,
    handleSelectAll,
  ]);
}
