/**
 * shortcut-reference.ts: Keyboard shortcut cheat-sheet data.
 *
 * Angular copy of the React constant `SHORTCUT_REFERENCE_ITEMS` from
 * `packages/react/src/viewer/constants/toolbar.ts`. Kept as a tiny, purely
 * declarative data module so the `pptx-shortcut-panel` component stays thin.
 * Entries are copied verbatim from the React source and must stay in sync.
 */

/** A single row in the keyboard-shortcut reference list. */
export interface ShortcutReferenceItem {
	action: string;
	shortcut: string;
}

export const SHORTCUT_REFERENCE_ITEMS: ShortcutReferenceItem[] = [
	{ action: 'Undo', shortcut: 'Ctrl/Cmd+Z' },
	{ action: 'Redo', shortcut: 'Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y' },
	{ action: 'Copy selected element', shortcut: 'Ctrl/Cmd+C' },
	{ action: 'Cut selected element', shortcut: 'Ctrl/Cmd+X' },
	{ action: 'Paste element', shortcut: 'Ctrl/Cmd+V' },
	{ action: 'Duplicate selected element', shortcut: 'Ctrl/Cmd+D' },
	{ action: 'Delete selected element', shortcut: 'Delete / Backspace' },
	{ action: 'Nudge selected element', shortcut: 'Arrow keys' },
	{ action: 'Nudge selected element (large)', shortcut: 'Shift+Arrow keys' },
	{ action: 'Zoom canvas', shortcut: 'Ctrl/Cmd+Mouse wheel' },
	{ action: 'Commit inline text edit', shortcut: 'Ctrl/Cmd+Enter' },
	{ action: 'Cancel inline text / close menus', shortcut: 'Escape' },
];
