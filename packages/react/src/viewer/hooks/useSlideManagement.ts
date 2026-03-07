/**
 * useSlideManagement — Slide CRUD operations: add, move, delete,
 * duplicate, toggle-hide, insert-from-layout, and context menu.
 */
import type { PptxSlide } from "pptx-viewer-core";
import type { ElementOperations } from "./useElementOperations";
import type { EditorHistoryResult } from "./useEditorHistory";

export interface UseSlideManagementInput {
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  activeSlideIndex: number;
  setActiveSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  ops: ElementOperations;
  history: EditorHistoryResult;
}

export interface SlideManagementHandlers {
  handleAddSlide: () => void;
  handleMoveSlide: (fromIndex: number, toIndex: number) => void;
  handleSlideContextMenu: (e: React.MouseEvent, index: number) => void;
  handleDeleteSlides: (indexes: number[]) => void;
  handleDuplicateSlides: (indexes: number[]) => void;
  handleToggleHideSlides: (indexes: number[]) => void;
  handleInsertSlideFromLayout: (layoutPath: string) => void;
}

export function useSlideManagement(
  input: UseSlideManagementInput,
): SlideManagementHandlers {
  const { slides, activeSlideIndex, setActiveSlideIndex, ops, history } = input;

  const handleAddSlide = () => {
    const newSlide: PptxSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      rId: "",
      slideNumber: slides.length + 1,
      elements: [],
    };
    ops.updateSlides((prev) => {
      const next = [...prev];
      next.splice(activeSlideIndex + 1, 0, newSlide);
      return next;
    });
    setActiveSlideIndex(activeSlideIndex + 1);
    history.markDirty();
  };

  const handleMoveSlide = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    ops.updateSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setActiveSlideIndex(toIndex);
    history.markDirty();
  };

  const handleSlideContextMenu = (_e: React.MouseEvent, _index: number) => {
    // Slide context menu — handled inside SlideSorterOverlay's own context menu.
  };

  const handleDeleteSlides = (indexes: number[]) => {
    if (indexes.length === 0 || slides.length <= 1) return;
    const sorted = [...indexes].sort((a, b) => b - a);
    ops.updateSlides((prev) => {
      const next = [...prev];
      for (const i of sorted) {
        if (next.length > 1) next.splice(i, 1);
      }
      return next;
    });
    const minIdx = Math.min(...indexes);
    setActiveSlideIndex(
      Math.min(
        minIdx,
        slides.length - indexes.length - 1,
        Math.max(slides.length - indexes.length - 1, 0),
      ),
    );
    history.markDirty();
  };

  const handleDuplicateSlides = (indexes: number[]) => {
    if (indexes.length === 0) return;
    const sorted = [...indexes].sort((a, b) => a - b);
    ops.updateSlides((prev) => {
      const next = [...prev];
      let offset = 0;
      for (const i of sorted) {
        const src = next[i + offset];
        if (!src) continue;
        const clone: PptxSlide = {
          ...src,
          id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          elements: src.elements.map((el) => ({
            ...el,
            id: `${el.id}-dup-${Math.random().toString(36).slice(2, 6)}`,
          })),
        };
        next.splice(i + offset + 1, 0, clone);
        offset++;
      }
      return next;
    });
    history.markDirty();
  };

  const handleToggleHideSlides = (indexes: number[]) => {
    if (indexes.length === 0) return;
    ops.updateSlides((prev) => {
      const next = [...prev];
      for (const i of indexes) {
        const slide = next[i];
        if (slide) next[i] = { ...slide, hidden: !slide.hidden };
      }
      return next;
    });
    history.markDirty();
  };

  const handleInsertSlideFromLayout = (_layoutPath: string) => {
    // Layout-based slide insertion depends on the PPTX handler;
    // fall back to adding a blank slide for now.
    handleAddSlide();
  };

  return {
    handleAddSlide,
    handleMoveSlide,
    handleSlideContextMenu,
    handleDeleteSlides,
    handleDuplicateSlides,
    handleToggleHideSlides,
    handleInsertSlideFromLayout,
  };
}
