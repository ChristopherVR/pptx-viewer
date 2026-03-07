import { useCallback, useMemo, useRef, useState } from "react";
import type React from "react";

import type { PptxSlide } from "../../../core";
import type { SlideSectionGroup } from "../../types";
import { DEFAULT_ZOOM, type SorterContextMenuState } from "./types";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

interface UseSlideSorterStateParams {
  slides: PptxSlide[];
  activeSlideIndex: number;
  canEdit: boolean;
  sectionGroups: SlideSectionGroup[];
  onSelectSlide: (index: number) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onDeleteSlides: (indexes: number[]) => void;
  onDuplicateSlides: (indexes: number[]) => void;
  onToggleHideSlides: (indexes: number[]) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSlideSorterState(params: UseSlideSorterStateParams) {
  const {
    slides,
    activeSlideIndex,
    canEdit,
    sectionGroups,
    onSelectSlide,
    onMoveSlide,
    onDeleteSlides,
    onDuplicateSlides,
    onToggleHideSlides,
    onClose,
  } = params;

  // -- State --------------------------------------------------------------

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>(() => {
    const activeSlide = slides[activeSlideIndex];
    return activeSlide?.id ? [activeSlide.id] : [];
  });
  const [lastClickedIndex, setLastClickedIndex] =
    useState<number>(activeSlideIndex);
  const [contextMenu, setContextMenu] = useState<SorterContextMenuState | null>(
    null,
  );
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [clipboardSlideIds, setClipboardSlideIds] = useState<string[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  // -- Helpers -------------------------------------------------------------

  const slideIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    slides.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [slides]);

  const selectedIndexes = useMemo(
    () =>
      selectedSlideIds
        .map((id) => slideIdToIndex.get(id))
        .filter((i): i is number => i !== undefined)
        .sort((a, b) => a - b),
    [selectedSlideIds, slideIdToIndex],
  );

  const isSelected = useCallback(
    (slideId: string) => selectedSlideIds.includes(slideId),
    [selectedSlideIds],
  );

  // -- Selection -----------------------------------------------------------

  const handleSlideClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      const slide = slides[index];
      if (!slide) return;

      if (e.ctrlKey || e.metaKey) {
        setSelectedSlideIds((prev) =>
          prev.includes(slide.id)
            ? prev.filter((id) => id !== slide.id)
            : [...prev, slide.id],
        );
        setLastClickedIndex(index);
      } else if (e.shiftKey) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        const rangeIds: string[] = [];
        for (let i = start; i <= end; i++) {
          if (slides[i]?.id) {
            rangeIds.push(slides[i].id);
          }
        }
        setSelectedSlideIds(rangeIds);
      } else {
        setSelectedSlideIds([slide.id]);
        setLastClickedIndex(index);
      }
    },
    [slides, lastClickedIndex],
  );

  // -- Context menu --------------------------------------------------------

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const slide = slides[index];
      if (!slide) return;

      if (!selectedSlideIds.includes(slide.id)) {
        setSelectedSlideIds([slide.id]);
        setLastClickedIndex(index);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, slideIndex: index });
    },
    [slides, selectedSlideIds],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // -- Slide operations ----------------------------------------------------

  const handleDeleteSelected = useCallback(() => {
    if (selectedIndexes.length === 0) return;
    onDeleteSlides(selectedIndexes);
    setSelectedSlideIds([]);
    closeContextMenu();
  }, [selectedIndexes, onDeleteSlides, closeContextMenu]);

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIndexes.length === 0) return;
    onDuplicateSlides(selectedIndexes);
    closeContextMenu();
  }, [selectedIndexes, onDuplicateSlides, closeContextMenu]);

  const handleCopySelected = useCallback(() => {
    setClipboardSlideIds([...selectedSlideIds]);
    closeContextMenu();
  }, [selectedSlideIds, closeContextMenu]);

  const handlePaste = useCallback(() => {
    if (clipboardSlideIds.length === 0) return;
    const indexes = clipboardSlideIds
      .map((id) => slideIdToIndex.get(id))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    if (indexes.length > 0) {
      onDuplicateSlides(indexes);
    }
    closeContextMenu();
  }, [clipboardSlideIds, slideIdToIndex, onDuplicateSlides, closeContextMenu]);

  const handleToggleHideSelected = useCallback(() => {
    if (selectedIndexes.length === 0) return;
    onToggleHideSlides(selectedIndexes);
    closeContextMenu();
  }, [selectedIndexes, onToggleHideSlides, closeContextMenu]);

  const handleSelectAll = useCallback(() => {
    setSelectedSlideIds(slides.map((s) => s.id));
  }, [slides]);

  // -- Keyboard shortcuts --------------------------------------------------

  useKeyboardShortcuts({
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
  });

  // -- Backdrop click ------------------------------------------------------

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // -- Drag handlers -------------------------------------------------------

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverIndex(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        onMoveSlide(fromIndex, toIndex);
      }
    },
    [onMoveSlide],
  );

  // -- Double-click --------------------------------------------------------

  const handleDoubleClick = useCallback(
    (index: number) => onSelectSlide(index),
    [onSelectSlide],
  );

  // -- Zoom ----------------------------------------------------------------

  const zoomScale = zoom / 100;

  const gridCols = useMemo(() => {
    if (zoomScale >= 1.8) return 2;
    if (zoomScale >= 1.4) return 3;
    if (zoomScale >= 1.0) return 4;
    if (zoomScale >= 0.7) return 5;
    return 6;
  }, [zoomScale]);

  // -- Derived state -------------------------------------------------------

  const showSectionHeaders = sectionGroups.length > 1;

  const hasHiddenInSelection = useMemo(
    () => selectedIndexes.some((i) => slides[i]?.hidden),
    [selectedIndexes, slides],
  );
  const hasVisibleInSelection = useMemo(
    () => selectedIndexes.some((i) => !slides[i]?.hidden),
    [selectedIndexes, slides],
  );

  return {
    dragOverIndex,
    selectedSlideIds,
    contextMenu,
    zoom,
    setZoom,
    clipboardSlideIds,
    backdropRef,
    selectedIndexes,
    isSelected,
    handleSlideClick,
    handleContextMenu,
    closeContextMenu,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleCopySelected,
    handlePaste,
    handleToggleHideSelected,
    handleBackdropClick,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDoubleClick,
    zoomScale,
    gridCols,
    showSectionHeaders,
    hasHiddenInSelection,
    hasVisibleInSelection,
  };
}
