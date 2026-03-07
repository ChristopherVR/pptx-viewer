/**
 * Toolbar section definitions and keyboard shortcut reference items.
 */

import type { ShortcutReferenceItem, ToolbarSection } from "../types";

export const TOOLBAR_SECTIONS: Array<{ id: ToolbarSection; label: string }> = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "text", label: "Text" },
  { id: "draw", label: "Draw" },
  { id: "arrange", label: "Arrange" },
  { id: "design", label: "Design" },
  { id: "transitions", label: "Transitions" },
  { id: "review", label: "Review" },
  { id: "view", label: "View" },
];

export const SHORTCUT_REFERENCE_ITEMS: ShortcutReferenceItem[] = [
  { action: "Undo", shortcut: "Ctrl/Cmd+Z" },
  { action: "Redo", shortcut: "Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y" },
  { action: "Copy selected element", shortcut: "Ctrl/Cmd+C" },
  { action: "Cut selected element", shortcut: "Ctrl/Cmd+X" },
  { action: "Paste element", shortcut: "Ctrl/Cmd+V" },
  { action: "Duplicate selected element", shortcut: "Ctrl/Cmd+D" },
  { action: "Delete selected element", shortcut: "Delete / Backspace" },
  { action: "Nudge selected element", shortcut: "Arrow keys" },
  { action: "Nudge selected element (large)", shortcut: "Shift+Arrow keys" },
  { action: "Zoom canvas", shortcut: "Ctrl/Cmd+Mouse wheel" },
  { action: "Commit inline text edit", shortcut: "Ctrl/Cmd+Enter" },
  { action: "Cancel inline text / close menus", shortcut: "Escape" },
];
