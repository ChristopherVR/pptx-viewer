import { useCallback, useEffect, useState } from "react";

import type { SectionContextMenuState, SlideContextMenuState } from "./types";

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface SlidePaneCallbacks {
  collapsedSections: Record<string, boolean>;
  renamingSectionId: string | null;
  renameValue: string;
  sectionContextMenu: SectionContextMenuState | null;
  slideCtxMenu: SlideContextMenuState | null;
  setRenameValue: (value: string) => void;
  handleDragStart: (e: React.DragEvent, slideIndex: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, toIndex: number) => void;
  toggleSection: (sectionId: string) => void;
  startRename: (sectionId: string, currentLabel: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
  handleSectionContextMenu: (
    e: React.MouseEvent,
    sectionId: string,
    sectionIndex: number,
    totalSections: number,
  ) => void;
  handleOpenSlideCtxMenu: (x: number, y: number, slideIndex: number) => void;
  closeSectionContextMenu: () => void;
  closeSlideCtxMenu: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSlidePaneCallbacks(
  onMoveSlide: (fromIndex: number, toIndex: number) => void,
  onRenameSection?: (sectionId: string, newName: string) => void,
): SlidePaneCallbacks {
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [sectionContextMenu, setSectionContextMenu] =
    useState<SectionContextMenuState | null>(null);
  const [slideCtxMenu, setSlideCtxMenu] =
    useState<SlideContextMenuState | null>(null);

  // Close context menus on outside click
  useEffect(() => {
    if (!sectionContextMenu && !slideCtxMenu) return;
    const handler = () => {
      setSectionContextMenu(null);
      setSlideCtxMenu(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [sectionContextMenu, slideCtxMenu]);

  // ── Drag handlers ──
  const handleDragStart = useCallback(
    (e: React.DragEvent, slideIndex: number) => {
      e.dataTransfer.setData("text/plain", String(slideIndex));
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData("text/plain");
      const fromIndex = parseInt(fromStr, 10);
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        onMoveSlide(fromIndex, toIndex);
      }
    },
    [onMoveSlide],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  // ── Rename handlers ──
  const startRename = useCallback((sectionId: string, currentLabel: string) => {
    setRenamingSectionId(sectionId);
    setRenameValue(currentLabel);
    setSectionContextMenu(null);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingSectionId && renameValue.trim().length > 0) {
      onRenameSection?.(renamingSectionId, renameValue.trim());
    }
    setRenamingSectionId(null);
    setRenameValue("");
  }, [renamingSectionId, renameValue, onRenameSection]);

  const cancelRename = useCallback(() => {
    setRenamingSectionId(null);
    setRenameValue("");
  }, []);

  // ── Section context menu handler ──
  const handleSectionContextMenu = useCallback(
    (
      e: React.MouseEvent,
      sectionId: string,
      sectionIndex: number,
      totalSections: number,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setSectionContextMenu({
        x: e.clientX,
        y: e.clientY,
        sectionId,
        sectionIndex,
        totalSections,
      });
    },
    [],
  );

  const handleOpenSlideCtxMenu = useCallback(
    (x: number, y: number, slideIndex: number) => {
      setSlideCtxMenu({ x, y, slideIndex });
    },
    [],
  );

  const closeSectionContextMenu = useCallback(() => {
    setSectionContextMenu(null);
  }, []);

  const closeSlideCtxMenu = useCallback(() => {
    setSlideCtxMenu(null);
  }, []);

  return {
    collapsedSections,
    renamingSectionId,
    renameValue,
    sectionContextMenu,
    slideCtxMenu,
    setRenameValue,
    handleDragStart,
    handleDragOver,
    handleDrop,
    toggleSection,
    startRename,
    commitRename,
    cancelRename,
    handleSectionContextMenu,
    handleOpenSlideCtxMenu,
    closeSectionContextMenu,
    closeSlideCtxMenu,
  };
}
