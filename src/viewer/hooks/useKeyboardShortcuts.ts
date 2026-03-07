/**
 * useKeyboardShortcuts — Global keyboard shortcut handler for the PowerPoint editor.
 *
 * Listens for keydown on the container element and dispatches to the
 * appropriate handler (delete, copy, paste, undo, redo, nudge, etc.).
 *
 * Shortcuts are only active in "edit" mode and are suppressed when an
 * inline text edit, table cell edit, or drawing tool is active.
 */
import { useEffect, useCallback, useRef } from "react";

import type { ViewerMode } from "../types-core";
import type { TableCellEditorState, DrawingTool } from "../types";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Small nudge step in EMU-equivalent pixels. */
const NUDGE_SMALL = 2;
/** Large nudge step (Shift+Arrow). */
const NUDGE_LARGE = 20;

/* ------------------------------------------------------------------ */
/*  Input interface                                                   */
/* ------------------------------------------------------------------ */

export interface UseKeyboardShortcutsInput {
  /** Container element ref — used to scope the listener. */
  containerRef: React.RefObject<HTMLDivElement | null>;

  mode: ViewerMode;
  canEdit: boolean;

  /** Whether any element is currently being inline-edited (text box). */
  inlineEditingElementId: string | null;
  /** Whether a table cell is being edited. */
  tableEditorState: TableCellEditorState | null;
  /** Current drawing tool — shortcuts are suppressed when drawing. */
  activeTool: DrawingTool;

  /** Whether at least one element is selected. */
  hasSelection: boolean;
  /** The IDs of the currently selected elements (effective). */
  effectiveSelectedIds: string[];

  // ── Action callbacks ────────────────────────────────────────────
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
  /** Move selected elements by (dx, dy). */
  onNudge: (dx: number, dy: number) => void;
  /** Navigate to previous visible slide (edit mode, no selection). */
  onPrevSlide?: () => void;
  /** Navigate to next visible slide (edit mode, no selection). */
  onNextSlide?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useKeyboardShortcuts(input: UseKeyboardShortcutsInput): void {
  // Store everything in a ref so the keydown closure never goes stale
  // and we don't need to re-attach the listener on every render.
  const inputRef = useRef(input);
  inputRef.current = input;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const {
      mode,
      canEdit,
      inlineEditingElementId,
      tableEditorState,
      activeTool,
      hasSelection,
      onDelete,
      onCopy,
      onCut,
      onPaste,
      onDuplicate,
      onUndo,
      onRedo,
      onSelectAll,
      onEscape,
      onNudge,
      onPrevSlide,
      onNextSlide,
    } = inputRef.current;

    // Only active in edit mode
    if (mode !== "edit" || !canEdit) return;

    // If the user is typing inside an <input>, <textarea>, or
    // contenteditable element, let the browser handle the event
    // (except for Escape which should always work).
    const target = e.target as HTMLElement | null;
    const isTextInput =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.isContentEditable;

    // ── Escape — always handled ─────────────────────────────────
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }

    // Suppress shortcuts when inline-editing text, actively editing a table
    // cell, or when a drawing tool is active.
    if (
      inlineEditingElementId ||
      tableEditorState?.isEditing ||
      activeTool !== "select"
    ) {
      return;
    }

    // ... and when focus is in a text input
    if (isTextInput) return;

    const isMod = e.metaKey || e.ctrlKey;

    // ── Delete / Backspace ──────────────────────────────────────
    if ((e.key === "Delete" || e.key === "Backspace") && hasSelection) {
      e.preventDefault();
      onDelete();
      return;
    }

    // ── Ctrl/Cmd combos ─────────────────────────────────────────
    if (isMod) {
      switch (e.key.toLowerCase()) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            onRedo();
          } else {
            onUndo();
          }
          return;
        case "y":
          e.preventDefault();
          onRedo();
          return;
        case "c":
          if (hasSelection) {
            e.preventDefault();
            onCopy();
          }
          return;
        case "x":
          if (hasSelection) {
            e.preventDefault();
            onCut();
          }
          return;
        case "v":
          e.preventDefault();
          onPaste();
          return;
        case "d":
          if (hasSelection) {
            e.preventDefault();
            onDuplicate();
          }
          return;
        case "a":
          e.preventDefault();
          onSelectAll();
          return;
      }
    }

    // ── Arrow key nudge ─────────────────────────────────────────
    if (
      hasSelection &&
      (e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight")
    ) {
      e.preventDefault();
      const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowUp":
          dy = -step;
          break;
        case "ArrowDown":
          dy = step;
          break;
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
      }
      onNudge(dx, dy);
      return;
    }

    // No element selection: use left/right arrows to navigate slides.
    if (!hasSelection && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      if (e.key === "ArrowLeft") {
        onPrevSlide?.();
      } else {
        onNextSlide?.();
      }
    }
  }, []);

  useEffect(() => {
    const container = input.containerRef.current;

    // Attach to the container so keydown events from the viewer
    // are captured.  We also listen on window as a fallback so
    // that shortcuts work even when the container itself doesn't
    // have focus (Electron can keep focus on the webview root).
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      if (container) {
        container.removeEventListener("keydown", handleKeyDown);
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
    // Re-attach only if the container ref changes (essentially once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.containerRef, handleKeyDown]);
}
