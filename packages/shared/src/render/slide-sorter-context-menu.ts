/**
 * The slide sorter's per-tile right-click menu: one command list behind all
 * five bindings.
 *
 * React offered Copy, Paste, Duplicate, Hide/Show and Delete (with a count
 * suffix on a multi-selection, under `pptx.slideSorter.contextMenu.*`); Vue,
 * Angular and Svelte offered Duplicate, Hide/Show and Delete under
 * `pptx.slideMenu.*`; Vanilla had no menu, only inline per-card buttons. The
 * canonical menu is React's, because PowerPoint's own sorter menu carries
 * Copy and Paste, with one change: Hide and Show are a single toggle entry,
 * exactly like the slide rail menu, instead of two entries on a mixed
 * selection.
 *
 * @module render/slide-sorter-context-menu
 */

/** Every command the sorter menu can offer. */
export type SlideSorterContextMenuCommandId =
	| 'copy'
	| 'paste'
	| 'duplicate'
	| 'toggle-hidden'
	| 'delete';

/** One rendered entry. */
export interface SlideSorterContextMenuEntry {
	id: SlideSorterContextMenuCommandId;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
	/** Append " (n)" to the translated label when more than one slide is selected. */
	countSuffix: boolean;
	separatorBefore?: boolean;
	disabled?: boolean;
}

/** What the menu is being opened over. */
export interface SlideSorterContextMenuContext {
	/** How many slides are selected; the right-clicked one counts even alone. */
	selectedCount: number;
	/** A slide has been copied in this sorter session. */
	hasClipboard: boolean;
	hasHiddenInSelection: boolean;
	hasVisibleInSelection: boolean;
	/** Deleting every slide is not allowed; disables Delete when it would. */
	wouldDeleteAllSlides: boolean;
}

/** The i18n keys, exported so tests and bindings never respell them. */
export const SLIDE_SORTER_MENU_LABEL_KEYS = {
	copy: 'pptx.slideSorter.contextMenu.copy',
	paste: 'pptx.slideSorter.contextMenu.paste',
	duplicate: 'pptx.slideSorter.contextMenu.duplicate',
	hide: 'pptx.slideSorter.contextMenu.hideSlides',
	show: 'pptx.slideSorter.contextMenu.showSlides',
	delete: 'pptx.slideSorter.contextMenu.delete',
} as const;

/**
 * The sorter menu for `context`, in order: Copy; Paste (only while something
 * is copied); Duplicate; Hide/Show; Delete. "Show" appears only when every
 * selected slide is already hidden, matching the rail's toggle.
 */
export function buildSlideSorterContextMenuEntries(
	context: SlideSorterContextMenuContext,
): SlideSorterContextMenuEntry[] {
	const keys = SLIDE_SORTER_MENU_LABEL_KEYS;
	const showsHide = context.hasVisibleInSelection || !context.hasHiddenInSelection;
	const entries: SlideSorterContextMenuEntry[] = [
		{ id: 'copy', labelKey: keys.copy, countSuffix: true },
	];
	if (context.hasClipboard) {
		entries.push({ id: 'paste', labelKey: keys.paste, countSuffix: false });
	}
	entries.push(
		{ id: 'duplicate', labelKey: keys.duplicate, countSuffix: true },
		{
			id: 'toggle-hidden',
			labelKey: showsHide ? keys.hide : keys.show,
			countSuffix: true,
			separatorBefore: true,
		},
		{
			id: 'delete',
			labelKey: keys.delete,
			countSuffix: true,
			separatorBefore: true,
			disabled: context.wouldDeleteAllSlides,
		},
	);
	return entries;
}

/** The label to show for `entry`: the translation plus the selection-count suffix. */
export function slideSorterContextMenuLabel(
	translated: string,
	entry: Pick<SlideSorterContextMenuEntry, 'countSuffix'>,
	selectedCount: number,
): string {
	return entry.countSuffix && selectedCount > 1 ? `${translated} (${selectedCount})` : translated;
}

/**
 * Where a paste lands: the current positions of the slides that were copied,
 * in deck order. A copied slide that has since been deleted is skipped, so a
 * paste after a delete never throws. Paste inserts a copy after each source
 * slide (a duplicate of the copied slides), which is React's long-standing
 * behaviour; positional paste is not implemented.
 */
export function slideSorterPasteIndexes(
	clipboardSlideIds: readonly string[],
	slides: readonly { id: string }[],
): number[] {
	const wanted = new Set(clipboardSlideIds);
	const indexes: number[] = [];
	slides.forEach((slide, index) => {
		if (wanted.has(slide.id)) {
			indexes.push(index);
		}
	});
	return indexes;
}

/** The slide rail's persistent action row: Add Slide, and nothing else. */
export const SLIDE_RAIL_FOOTER_ACTIONS = [
	{ id: 'add-slide', labelKey: 'pptx.sections.addSlide' },
] as const;
