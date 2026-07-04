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
	actionKey: string;
	shortcut: string;
}

export const SHORTCUT_REFERENCE_ITEMS: ShortcutReferenceItem[] = [
	{ actionKey: 'pptx.toolbar.undo', shortcut: 'Ctrl/Cmd+Z' },
	{ actionKey: 'pptx.toolbar.redo', shortcut: 'Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y' },
	{ actionKey: 'pptx.shortcuts.action.copyElement', shortcut: 'Ctrl/Cmd+C' },
	{ actionKey: 'pptx.shortcuts.action.cutElement', shortcut: 'Ctrl/Cmd+X' },
	{ actionKey: 'pptx.shortcuts.action.pasteElement', shortcut: 'Ctrl/Cmd+V' },
	{ actionKey: 'pptx.shortcuts.action.duplicateElement', shortcut: 'Ctrl/Cmd+D' },
	{ actionKey: 'pptx.shortcuts.action.deleteElement', shortcut: 'Delete / Backspace' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElement', shortcut: 'Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.nudgeElementLarge', shortcut: 'Shift+Arrow keys' },
	{ actionKey: 'pptx.shortcuts.action.zoomCanvas', shortcut: 'Ctrl/Cmd+Mouse wheel' },
	{ actionKey: 'pptx.shortcuts.action.commitTextEdit', shortcut: 'Ctrl/Cmd+Enter' },
	{ actionKey: 'pptx.shortcuts.action.cancelTextEdit', shortcut: 'Escape' },
];
