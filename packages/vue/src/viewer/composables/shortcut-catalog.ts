/**
 * The keyboard-shortcut help catalog: data for `ShortcutPanel.vue`.
 *
 * Split out of `useKeyboardShortcuts.ts` to keep that file under this repo's
 * file-size limit; the catalog is presentation data for the "?" help overlay,
 * not dispatch logic, so it stands on its own.
 *
 * @module composables/shortcut-catalog
 */

/** Logical grouping for the help overlay. */
export type ShortcutGroup = 'history' | 'clipboard' | 'editing' | 'navigation' | 'general';

/** A single entry in the shortcut catalog (drives the help UI). */
export interface ShortcutDefinition {
	/** Stable identifier (also the action name where 1:1). */
	id: string;
	/**
	 * Human-readable, platform-neutral key combo (e.g. `'Mod+Z'`, `'Mod+Shift+Z'`,
	 * `'Delete'`, `'ArrowUp'`). `Mod` renders as ⌘ on macOS, Ctrl elsewhere.
	 */
	combo: string;
	/** Logical group for the help overlay. */
	group: ShortcutGroup;
	/** i18n key for the help-panel description. */
	descriptionKey: string;
}

/**
 * The full catalog of shortcuts, grouped for the help overlay. The `combo`
 * strings use `Mod` as a platform-neutral Ctrl/Cmd token (rendered per-platform
 * by `ShortcutPanel.vue`). This is the single source of truth for the help UI.
 */
export const SHORTCUT_CATALOG: readonly ShortcutDefinition[] = [
	{ id: 'undo', combo: 'Mod+Z', group: 'history', descriptionKey: 'pptx.toolbar.undo' },
	{ id: 'redo', combo: 'Mod+Shift+Z', group: 'history', descriptionKey: 'pptx.toolbar.redo' },
	{
		id: 'redo-y',
		combo: 'Mod+Y',
		group: 'history',
		descriptionKey: 'pptx.shortcuts.action.redoAlternate',
	},
	{
		id: 'copy',
		combo: 'Mod+C',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.copyElement',
	},
	{
		id: 'cut',
		combo: 'Mod+X',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.cutElement',
	},
	{
		id: 'paste',
		combo: 'Mod+V',
		group: 'clipboard',
		descriptionKey: 'pptx.shortcuts.action.pasteElement',
	},
	{
		id: 'duplicate',
		combo: 'Mod+D',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.duplicateElement',
	},
	{
		id: 'delete',
		combo: 'Delete',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.deleteElement',
	},
	{
		id: 'select-all',
		combo: 'Mod+A',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.selectAll',
	},
	{ id: 'group', combo: 'Mod+G', group: 'editing', descriptionKey: 'pptx.ribbon.group' },
	{
		id: 'ungroup',
		combo: 'Mod+Shift+G',
		group: 'editing',
		descriptionKey: 'pptx.ribbon.ungroup',
	},
	{
		id: 'nudge',
		combo: 'ArrowKeys',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.nudgeElement',
	},
	{
		id: 'nudge-large',
		combo: 'Shift+ArrowKeys',
		group: 'editing',
		descriptionKey: 'pptx.shortcuts.action.nudgeElementLarge',
	},
	{
		id: 'prev-slide',
		combo: 'ArrowLeft',
		group: 'navigation',
		descriptionKey: 'pptx.shortcuts.action.prevSlide',
	},
	{
		id: 'next-slide',
		combo: 'ArrowRight',
		group: 'navigation',
		descriptionKey: 'pptx.shortcuts.action.nextSlide',
	},
	{
		id: 'escape',
		combo: 'Escape',
		group: 'general',
		descriptionKey: 'pptx.shortcuts.action.clearSelection',
	},
	{ id: 'find', combo: 'Mod+F', group: 'general', descriptionKey: 'pptx.findReplace.title' },
	{ id: 'shortcuts', combo: '?', group: 'general', descriptionKey: 'pptx.shortcuts.title' },
	// F5 / Shift+F5 are matched by `mapSlideShowStartKey` (pptx-viewer-shared),
	// not by `useKeyboardShortcuts.ts`'s `mapEditorKey` catalog - see
	// `dispatchSlideShowStartKey` in `useEditorKeyboard.ts`. Listed here only so
	// the help panel shows them.
	{
		id: 'present-from-beginning',
		combo: 'F5',
		group: 'general',
		descriptionKey: 'pptx.slideShow.fromBeginning',
	},
	{
		id: 'present-from-current',
		combo: 'Shift+F5',
		group: 'general',
		descriptionKey: 'pptx.slideShow.fromCurrent',
	},
] as const;

/** i18n keys for each group's label, in display order. */
export const SHORTCUT_GROUP_LABEL_KEYS: Record<ShortcutGroup, string> = {
	history: 'pptx.editorToolbar.history',
	clipboard: 'pptx.ribbon.clipboard',
	editing: 'pptx.shortcuts.group.editing',
	navigation: 'pptx.shortcuts.group.navigation',
	general: 'pptx.settings.general',
};

/** The catalog grouped by `group`, in `SHORTCUT_GROUP_LABEL_KEYS` order. */
export interface ShortcutCatalogGroup {
	group: ShortcutGroup;
	labelKey: string;
	shortcuts: ShortcutDefinition[];
}

/** Group the catalog for display (preserves the label order). */
export function groupShortcutCatalog(
	catalog: readonly ShortcutDefinition[] = SHORTCUT_CATALOG,
): ShortcutCatalogGroup[] {
	const order = Object.keys(SHORTCUT_GROUP_LABEL_KEYS) as ShortcutGroup[];
	return order
		.map((group) => ({
			group,
			labelKey: SHORTCUT_GROUP_LABEL_KEYS[group],
			shortcuts: catalog.filter((entry) => entry.group === group),
		}))
		.filter((bucket) => bucket.shortcuts.length > 0);
}
