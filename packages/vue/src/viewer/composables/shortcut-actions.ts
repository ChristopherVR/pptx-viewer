/**
 * The keyboard-shortcut action contract: the names `mapEditorKey` can
 * resolve to, and the callbacks `useKeyboardShortcuts` dispatches them to.
 *
 * Split out of `useKeyboardShortcuts.ts` to keep that file under this repo's
 * file-size limit; this module is the public contract, the other file is the
 * dispatch implementation.
 *
 * @module composables/shortcut-actions
 */
import type { EditorKeyActionName } from 'pptx-viewer-shared';

/**
 * The set of action identifiers the registry can dispatch: an alias of the
 * shared keymap's own action union, not a hand-copied one, so a new shared
 * action can never silently fall through the dispatcher.
 */
export type ShortcutActionName = EditorKeyActionName;

/**
 * Action callbacks the registry dispatches to. All are optional; a missing
 * callback simply means the corresponding shortcut is a no-op (but it is still
 * matched/suppressed, so the browser default is still prevented).
 */
export interface ShortcutActions {
	/** Undo the last edit (Ctrl/Cmd+Z). */
	undo?: () => void;
	/** Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y). */
	redo?: () => void;
	/** Copy the selection (Ctrl/Cmd+C). */
	copy?: () => void;
	/** Cut the selection (Ctrl/Cmd+X). */
	cut?: () => void;
	/** Paste (Ctrl/Cmd+V). */
	paste?: () => void;
	/** Duplicate the selection (Ctrl/Cmd+D). */
	duplicate?: () => void;
	/** Delete the selection (Delete / Backspace). */
	delete?: () => void;
	/** Select all elements on the active slide (Ctrl/Cmd+A). */
	selectAll?: () => void;
	/** Group the selection into one group element (Ctrl/Cmd+G). */
	group?: () => void;
	/** Ungroup the selected group (Ctrl/Cmd+Shift+G). */
	ungroup?: () => void;
	/** Show or hide the keyboard-shortcut reference ("?"). */
	toggleShortcuts?: () => void;
	/** Nudge the selection by (dx, dy) pixels (Arrow keys / Shift+Arrow). */
	nudge?: (dx: number, dy: number) => void;
	/** Navigate to the previous slide (ArrowLeft, no selection). */
	prevSlide?: () => void;
	/** Navigate to the next slide (ArrowRight, no selection). */
	nextSlide?: () => void;
	/** Escape: clear selection / close menus / cancel inline edit. */
	escape?: () => void;
	/** Open or close the find bar (Ctrl/Cmd+F). */
	find?: () => void;
	/** Open Find & Replace (Ctrl/Cmd+H). */
	findReplace?: () => void;
	/** Left-align the current paragraph (Ctrl/Cmd+L). */
	alignLeft?: () => void;
	/** Centre-align the current paragraph (Ctrl/Cmd+E). */
	alignCenter?: () => void;
	/** Right-align the current paragraph (Ctrl/Cmd+R). */
	alignRight?: () => void;
	/** Justify the current paragraph (Ctrl/Cmd+J). */
	alignJustify?: () => void;
	/** Step the font size up PowerPoint's size ladder (Ctrl/Cmd+Shift+> or +]). */
	increaseFontSize?: () => void;
	/** Step the font size down PowerPoint's size ladder (Ctrl/Cmd+Shift+< or +[). */
	decreaseFontSize?: () => void;
	/** Copy the selection's formatting (Ctrl/Cmd+Shift+C). */
	copyFormat?: () => void;
	/** Apply the copied formatting to the selection (Ctrl/Cmd+Shift+V). */
	pasteFormat?: () => void;
	/** Insert a new slide (Ctrl/Cmd+M). */
	newSlide?: () => void;
	/** Open the hyperlink dialog (Ctrl/Cmd+K). */
	hyperlink?: () => void;
	/** Clear direct character formatting on the selection (Ctrl/Cmd+Space). */
	clearFormatting?: () => void;
	/** Select the next element on the slide (Tab). */
	cycleSelectionNext?: () => void;
	/** Select the previous element on the slide (Shift+Tab). */
	cycleSelectionPrev?: () => void;
}

/** Result of matching a keyboard event against the catalog. */
export interface MatchedShortcut {
	/** The dispatched action, or `null` when the event matches nothing. */
	action: ShortcutActionName | null;
	/** Nudge delta (only set when `action === 'nudge'`). */
	dx?: number;
	/** Nudge delta (only set when `action === 'nudge'`). */
	dy?: number;
}
