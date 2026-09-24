/**
 * The right-click menu for the empty slide canvas (no element under the
 * cursor), as distinct from {@link ./context-menu-commands}'s per-element menu.
 *
 * Right-clicking empty canvas used to do nothing at all in every binding: React
 * and Vue both bailed out early (`getElementIdFromEvent` returns `null`, so the
 * handler just returns) rather than opening a menu, and the other three never
 * wired a handler for it either. PowerPoint offers Paste, Layout, Reset,
 * Format Background and view toggles (Grid and Guides, Ruler) from this menu;
 * this module is the one list every binding renders instead of five omissions.
 *
 * @module render/canvas-context-menu-commands
 */

/** Every command the empty-canvas context menu can offer, in no particular order. */
export type CanvasContextMenuCommandId =
	| 'paste'
	| 'layout'
	| 'reset-slide'
	| 'format-background'
	| 'grid-and-guides'
	| 'ruler';

/** One rendered entry: a command, plus how it is presented. */
export interface CanvasContextMenuEntry {
	id: CanvasContextMenuCommandId;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
	/** Draw a rule above this entry (it opens a new group of commands). */
	separatorBefore?: boolean;
	/** Offered but not usable right now (greyed out, still announced). */
	disabled?: boolean;
	/**
	 * This entry is a checkbox-style toggle (Grid and Guides, Ruler) currently
	 * in this state, rather than a one-shot command.
	 */
	checked?: boolean;
}

/** What the empty-canvas menu is being opened over. */
export interface CanvasContextMenuContext {
	/**
	 * Whether there is anything to paste. Omit when the binding does not track
	 * it: Paste is then offered enabled, matching the element menu's default.
	 */
	hasClipboard?: boolean;
	/** Whether the grid is currently shown, for the "Grid and Guides" checkbox. */
	showGrid?: boolean;
	/** Whether the ruler is currently shown, for the "Ruler" checkbox. */
	showRulers?: boolean;
}

const LABEL_KEYS: Record<CanvasContextMenuCommandId, string> = {
	paste: 'pptx.contextMenu.paste',
	layout: 'pptx.canvasContextMenu.layout',
	'reset-slide': 'pptx.canvasContextMenu.resetSlide',
	'format-background': 'pptx.canvasContextMenu.formatBackground',
	'grid-and-guides': 'pptx.canvasContextMenu.gridAndGuides',
	ruler: 'pptx.canvasContextMenu.ruler',
};

/** The i18n key for a command, so a binding never spells one out itself. */
export function canvasContextMenuLabelKey(id: CanvasContextMenuCommandId): string {
	return LABEL_KEYS[id];
}

function entry(
	id: CanvasContextMenuCommandId,
	extra: Partial<CanvasContextMenuEntry> = {},
): CanvasContextMenuEntry {
	return { id, labelKey: LABEL_KEYS[id], ...extra };
}

/**
 * The empty-canvas menu for `context`, in order, separators included:
 * Paste; Layout, Reset Slide; Format Background; Grid and Guides, Ruler.
 */
export function buildCanvasContextMenuEntries(
	context: CanvasContextMenuContext = {},
): CanvasContextMenuEntry[] {
	const { hasClipboard, showGrid, showRulers } = context;
	return [
		entry('paste', hasClipboard === false ? { disabled: true } : {}),
		entry('layout', { separatorBefore: true }),
		entry('reset-slide'),
		entry('format-background', { separatorBefore: true }),
		entry('grid-and-guides', { separatorBefore: true, checked: Boolean(showGrid) }),
		entry('ruler', { checked: Boolean(showRulers) }),
	];
}
