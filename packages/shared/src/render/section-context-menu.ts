/**
 * The slides pane's section-header right-click menu: one command list behind
 * all five bindings.
 *
 * React alone offered a popup menu (`pptx.sections.*` keys); Vue, Angular,
 * Svelte and Vanilla rendered hover buttons per header, Vue under a second
 * key namespace (`pptx.sectionList.*`), and Svelte, Vanilla and Angular
 * renamed through `window.prompt`. The canonical behaviour follows PowerPoint:
 * right-click (or the keyboard context-menu key) on a section header opens a
 * menu with Rename, Delete, Move Up, Move Down and Add Section After; Move Up
 * is disabled on the first section and Move Down on the last.
 *
 * @module render/section-context-menu
 */

/** Every command the section menu can offer. */
export type SectionContextMenuCommandId =
	| 'rename'
	| 'delete'
	| 'move-up'
	| 'move-down'
	| 'add-after';

/** One rendered entry. */
export interface SectionContextMenuEntry {
	id: SectionContextMenuCommandId;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
	separatorBefore?: boolean;
	disabled?: boolean;
}

/** What the menu is being opened over. */
export interface SectionContextMenuContext {
	/** Position of the section among the declared sections. */
	sectionIndex: number;
	/** Number of declared sections. */
	totalSections: number;
}

const LABEL_KEYS: Record<SectionContextMenuCommandId, string> = {
	rename: 'pptx.sections.rename',
	delete: 'pptx.sections.delete',
	'move-up': 'pptx.sections.moveUp',
	'move-down': 'pptx.sections.moveDown',
	'add-after': 'pptx.sections.addAfter',
};

/** The i18n key for a section command, so a binding never spells one out itself. */
export function sectionContextMenuLabelKey(id: SectionContextMenuCommandId): string {
	return LABEL_KEYS[id];
}

/** The section menu for `context`, in order, separators included. */
export function buildSectionContextMenuEntries(
	context: SectionContextMenuContext,
): SectionContextMenuEntry[] {
	return [
		{ id: 'rename', labelKey: LABEL_KEYS.rename },
		{ id: 'delete', labelKey: LABEL_KEYS.delete },
		{
			id: 'move-up',
			labelKey: LABEL_KEYS['move-up'],
			separatorBefore: true,
			disabled: context.sectionIndex <= 0,
		},
		{
			id: 'move-down',
			labelKey: LABEL_KEYS['move-down'],
			disabled: context.sectionIndex >= context.totalSections - 1,
		},
		{ id: 'add-after', labelKey: LABEL_KEYS['add-after'], separatorBefore: true },
	];
}

/**
 * The slide index a new section starts at when added after a section: the
 * slide following the section's last slide, clamped to the last slide so an
 * "add after" on the final section still splits the deck rather than failing.
 */
export function sectionAddAfterSlideIndex(
	lastSlideIndexOfSection: number | undefined,
	totalSlides: number,
): number {
	return Math.max(0, Math.min((lastSlideIndexOfSection ?? 0) + 1, totalSlides - 1));
}
