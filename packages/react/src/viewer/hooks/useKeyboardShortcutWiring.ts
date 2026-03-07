/**
 * useKeyboardShortcutWiring — Wires the composed editor results into the
 * generic `useKeyboardShortcuts` hook.  Keeps the orchestrator lean.
 */
import type { PptxSlide } from "pptx-viewer-core";
import type { ViewerMode } from "../types-core";
import type { ViewerState } from "./useViewerState";
import type { ElementOperations } from "./useElementOperations";
import type { ElementManipulationHandlers } from "./useElementManipulation";
import type { EditorHistoryResult } from "./useEditorHistory";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseKeyboardShortcutWiringInput {
  state: ViewerState;
  mode: ViewerMode;
  canEdit: boolean;
  slides: PptxSlide[];
  activeSlide: PptxSlide | undefined;
  ops: ElementOperations;
  manipulation: ElementManipulationHandlers;
  history: EditorHistoryResult;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardShortcutWiring(
  input: UseKeyboardShortcutWiringInput,
): void {
  const {
    state,
    mode,
    canEdit,
    slides,
    activeSlide,
    ops,
    manipulation,
    history,
  } = input;

  useKeyboardShortcuts({
    containerRef: state.containerRef,
    mode,
    canEdit,
    inlineEditingElementId: state.inlineEditingElementId,
    tableEditorState: state.tableEditorState,
    activeTool: state.activeTool,
    hasSelection: state.effectiveSelectedIds.length > 0,
    effectiveSelectedIds: state.effectiveSelectedIds,
    onDelete: manipulation.handleDelete,
    onCopy: manipulation.handleCopy,
    onCut: manipulation.handleCut,
    onPaste: manipulation.handlePaste,
    onDuplicate: manipulation.handleDuplicate,
    onUndo: history.handleUndo,
    onRedo: history.handleRedo,
    onSelectAll: () => {
      if (!activeSlide) return;
      const allIds = activeSlide.elements.map((el) => el.id);
      if (allIds.length > 0) ops.applySelection(allIds[0], allIds);
    },
    onEscape: () => {
      if (state.inlineEditingElementId) {
        state.setInlineEditingElementId(null);
        state.setInlineEditingText("");
      } else if (state.contextMenuState) {
        state.setContextMenuState(null);
      } else if (state.tableEditorState) {
        state.setTableEditorState(null);
      } else {
        ops.clearSelection();
      }
    },
    onNudge: (dx: number, dy: number) => {
      const ids = state.effectiveSelectedIds;
      if (!ids.length) return;
      for (const id of ids) {
        const el = state.elementLookup.get(id);
        if (el) {
          ops.updateElementById(id, {
            x: el.x + dx,
            y: el.y + dy,
          });
        }
      }
      history.markDirty();
    },
    onPrevSlide: () => {
      if (slides.length === 0) return;
      state.setActiveSlideIndex((prev) => Math.max(0, prev - 1));
    },
    onNextSlide: () => {
      if (slides.length === 0) return;
      state.setActiveSlideIndex((prev) =>
        Math.min(slides.length - 1, prev + 1),
      );
    },
  });
}
