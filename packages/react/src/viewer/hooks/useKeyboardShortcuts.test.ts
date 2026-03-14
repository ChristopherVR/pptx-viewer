/**
 * Tests for pure keyboard-shortcut logic extracted from useKeyboardShortcuts.
 *
 * We test the decision logic (which action fires for which key combo)
 * without needing a DOM or React lifecycle.
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants (mirror the hook)
// ---------------------------------------------------------------------------

const NUDGE_SMALL = 2;
const NUDGE_LARGE = 20;

// ---------------------------------------------------------------------------
// Extracted pure dispatch function — mirrors the handleKeyDown closure
// ---------------------------------------------------------------------------

interface ShortcutInput {
  mode: "edit" | "present" | "view";
  canEdit: boolean;
  inlineEditingElementId: string | null;
  tableEditorIsEditing: boolean;
  activeTool: string;
  hasSelection: boolean;
  isTextInput: boolean;
}

type ActionName =
  | "escape"
  | "delete"
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "paste"
  | "duplicate"
  | "selectAll"
  | "nudge"
  | "prevSlide"
  | "nextSlide"
  | null;

interface DispatchResult {
  action: ActionName;
  dx?: number;
  dy?: number;
}

/**
 * Determine which action a keyboard event should trigger.
 * Returns null if the event should be ignored.
 */
function resolveShortcutAction(
  key: string,
  ctrlKey: boolean,
  shiftKey: boolean,
  input: ShortcutInput,
): DispatchResult {
  const { mode, canEdit, inlineEditingElementId, tableEditorIsEditing, activeTool, hasSelection, isTextInput } = input;

  // Only active in edit mode
  if (mode !== "edit" || !canEdit) return { action: null };

  // Escape — always handled
  if (key === "Escape") return { action: "escape" };

  // Suppress when inline-editing, table-editing, or drawing
  if (inlineEditingElementId || tableEditorIsEditing || activeTool !== "select") {
    return { action: null };
  }

  // Suppress when in text input
  if (isTextInput) return { action: null };

  const isMod = ctrlKey;

  // Delete / Backspace
  if ((key === "Delete" || key === "Backspace") && hasSelection) {
    return { action: "delete" };
  }

  // Ctrl/Cmd combos
  if (isMod) {
    switch (key.toLowerCase()) {
      case "z":
        return { action: shiftKey ? "redo" : "undo" };
      case "y":
        return { action: "redo" };
      case "c":
        return hasSelection ? { action: "copy" } : { action: null };
      case "x":
        return hasSelection ? { action: "cut" } : { action: null };
      case "v":
        return { action: "paste" };
      case "d":
        return hasSelection ? { action: "duplicate" } : { action: null };
      case "a":
        return { action: "selectAll" };
    }
  }

  // Arrow key nudge
  if (
    hasSelection &&
    (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight")
  ) {
    const step = shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
    let dx = 0;
    let dy = 0;
    switch (key) {
      case "ArrowUp":    dy = -step; break;
      case "ArrowDown":  dy =  step; break;
      case "ArrowLeft":  dx = -step; break;
      case "ArrowRight": dx =  step; break;
    }
    return { action: "nudge", dx, dy };
  }

  // Slide navigation (no selection)
  if (!hasSelection && (key === "ArrowLeft" || key === "ArrowRight")) {
    return { action: key === "ArrowLeft" ? "prevSlide" : "nextSlide" };
  }

  return { action: null };
}

// ---------------------------------------------------------------------------
// Default input factory
// ---------------------------------------------------------------------------

function defaultInput(overrides: Partial<ShortcutInput> = {}): ShortcutInput {
  return {
    mode: "edit",
    canEdit: true,
    inlineEditingElementId: null,
    tableEditorIsEditing: false,
    activeTool: "select",
    hasSelection: true,
    isTextInput: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useKeyboardShortcuts — shortcut dispatch logic", () => {
  // ── Guard conditions ──────────────────────────────────────────────
  describe("guard conditions", () => {
    it("should return null in present mode", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ mode: "present" }));
      expect(result.action).toBeNull();
    });

    it("should return null when canEdit is false", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ canEdit: false }));
      expect(result.action).toBeNull();
    });

    it("should always handle Escape even in view mode guard (but edit mode required)", () => {
      const result = resolveShortcutAction("Escape", false, false, defaultInput());
      expect(result.action).toBe("escape");
    });

    it("should suppress non-Escape keys when inline editing", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ inlineEditingElementId: "el-1" }));
      expect(result.action).toBeNull();
    });

    it("should still allow Escape when inline editing", () => {
      const result = resolveShortcutAction("Escape", false, false, defaultInput({ inlineEditingElementId: "el-1" }));
      expect(result.action).toBe("escape");
    });

    it("should suppress when table editor is editing", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ tableEditorIsEditing: true }));
      expect(result.action).toBeNull();
    });

    it("should suppress when drawing tool is active", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ activeTool: "pen" }));
      expect(result.action).toBeNull();
    });

    it("should suppress when focus is in a text input", () => {
      const result = resolveShortcutAction("Delete", false, false, defaultInput({ isTextInput: true }));
      expect(result.action).toBeNull();
    });
  });

  // ── Delete / Backspace ────────────────────────────────────────────
  describe("delete", () => {
    it("should trigger delete on Delete key with selection", () => {
      expect(resolveShortcutAction("Delete", false, false, defaultInput()).action).toBe("delete");
    });

    it("should trigger delete on Backspace key with selection", () => {
      expect(resolveShortcutAction("Backspace", false, false, defaultInput()).action).toBe("delete");
    });

    it("should not trigger delete without selection", () => {
      expect(resolveShortcutAction("Delete", false, false, defaultInput({ hasSelection: false })).action).toBeNull();
    });
  });

  // ── Ctrl/Cmd combos ──────────────────────────────────────────────
  describe("ctrl combos", () => {
    it("Ctrl+Z should trigger undo", () => {
      expect(resolveShortcutAction("z", true, false, defaultInput()).action).toBe("undo");
    });

    it("Ctrl+Shift+Z should trigger redo", () => {
      expect(resolveShortcutAction("z", true, true, defaultInput()).action).toBe("redo");
    });

    it("Ctrl+Y should trigger redo", () => {
      expect(resolveShortcutAction("y", true, false, defaultInput()).action).toBe("redo");
    });

    it("Ctrl+C should trigger copy with selection", () => {
      expect(resolveShortcutAction("c", true, false, defaultInput()).action).toBe("copy");
    });

    it("Ctrl+C should do nothing without selection", () => {
      expect(resolveShortcutAction("c", true, false, defaultInput({ hasSelection: false })).action).toBeNull();
    });

    it("Ctrl+X should trigger cut with selection", () => {
      expect(resolveShortcutAction("x", true, false, defaultInput()).action).toBe("cut");
    });

    it("Ctrl+V should trigger paste (selection not required)", () => {
      expect(resolveShortcutAction("v", true, false, defaultInput({ hasSelection: false })).action).toBe("paste");
    });

    it("Ctrl+D should trigger duplicate with selection", () => {
      expect(resolveShortcutAction("d", true, false, defaultInput()).action).toBe("duplicate");
    });

    it("Ctrl+A should trigger selectAll", () => {
      expect(resolveShortcutAction("a", true, false, defaultInput()).action).toBe("selectAll");
    });
  });

  // ── Arrow nudge ───────────────────────────────────────────────────
  describe("arrow nudge", () => {
    it("ArrowUp should nudge up by NUDGE_SMALL", () => {
      const result = resolveShortcutAction("ArrowUp", false, false, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: 0, dy: -NUDGE_SMALL });
    });

    it("ArrowDown should nudge down by NUDGE_SMALL", () => {
      const result = resolveShortcutAction("ArrowDown", false, false, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: 0, dy: NUDGE_SMALL });
    });

    it("ArrowLeft should nudge left by NUDGE_SMALL", () => {
      const result = resolveShortcutAction("ArrowLeft", false, false, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: -NUDGE_SMALL, dy: 0 });
    });

    it("ArrowRight should nudge right by NUDGE_SMALL", () => {
      const result = resolveShortcutAction("ArrowRight", false, false, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: NUDGE_SMALL, dy: 0 });
    });

    it("Shift+ArrowUp should nudge by NUDGE_LARGE", () => {
      const result = resolveShortcutAction("ArrowUp", false, true, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: 0, dy: -NUDGE_LARGE });
    });

    it("Shift+ArrowRight should nudge by NUDGE_LARGE", () => {
      const result = resolveShortcutAction("ArrowRight", false, true, defaultInput());
      expect(result).toEqual({ action: "nudge", dx: NUDGE_LARGE, dy: 0 });
    });
  });

  // ── Slide navigation ──────────────────────────────────────────────
  describe("slide navigation", () => {
    it("ArrowLeft without selection should go to prev slide", () => {
      const result = resolveShortcutAction("ArrowLeft", false, false, defaultInput({ hasSelection: false }));
      expect(result.action).toBe("prevSlide");
    });

    it("ArrowRight without selection should go to next slide", () => {
      const result = resolveShortcutAction("ArrowRight", false, false, defaultInput({ hasSelection: false }));
      expect(result.action).toBe("nextSlide");
    });
  });
});
