/**
 * The slides pane's per-thumbnail right-click menu: one command list behind
 * all five bindings.
 *
 * Every binding had, at best, a Duplicate/Delete/Hide-Show trio (mostly on a
 * separate full-screen sorter overlay, not the always-visible rail); New
 * Slide, Layout and Add Section did not exist on any thumbnail context menu
 * anywhere. Nothing crashed when a binding omitted one: the gap was only ever
 * found by a user who right-clicked expecting PowerPoint's own menu.
 *
 * @module render/slide-pane-context-menu
 */

/** Every command the thumbnail context menu can offer. */
export type SlidePaneContextMenuCommandId =
	| 'new-slide'
	| 'duplicate'
	| 'delete'
	| 'layout'
	| 'hide'
	| 'add-section';

/** One rendered entry: a command, plus how it is presented. */
export interface SlidePaneContextMenuEntry {
	id: SlidePaneContextMenuCommandId;
	/** i18n key; the binding translates it with its own translator. */
	labelKey: string;
	/**
	 * `{{count}}` in the label when more than one slide is selected ("Delete 3
	 * Slides"); the binding interpolates it, this module only says whether to.
	 */
	countLabelKey?: string;
	separatorBefore?: boolean;
	disabled?: boolean;
}

/** What the thumbnail menu is being opened over. */
export interface SlidePaneContextMenuContext {
	/** How many slides are selected; the right-clicked one counts even alone. */
	selectedCount: number;
	/** At least one selected slide is currently hidden. */
	hasHiddenInSelection: boolean;
	/** At least one selected slide is currently visible. */
	hasVisibleInSelection: boolean;
	/** Deleting every slide is not allowed; disables Delete when it would. */
	wouldDeleteAllSlides: boolean;
}

const LABEL_KEYS: Record<SlidePaneContextMenuCommandId, string> = {
	'new-slide': 'pptx.slidesPane.contextMenu.newSlide',
	duplicate: 'pptx.slidesPane.contextMenu.duplicate',
	delete: 'pptx.slidesPane.contextMenu.delete',
	layout: 'pptx.slidesPane.contextMenu.layout',
	hide: 'pptx.slidesPane.contextMenu.hide',
	'add-section': 'pptx.slidesPane.contextMenu.addSection',
};

/** Multi-selection label keys ("Duplicate {{count}} Slides"), where PowerPoint pluralises. */
const COUNT_LABEL_KEYS: Partial<Record<SlidePaneContextMenuCommandId, string>> = {
	duplicate: 'pptx.slidesPane.contextMenu.duplicateCount',
	delete: 'pptx.slidesPane.contextMenu.deleteCount',
};

/** The i18n key for a command, so a binding never spells one out itself. */
export function slidePaneContextMenuLabelKey(id: SlidePaneContextMenuCommandId): string {
	return LABEL_KEYS[id];
}

function entry(
	id: SlidePaneContextMenuCommandId,
	context: SlidePaneContextMenuContext,
	extra: Partial<SlidePaneContextMenuEntry> = {},
): SlidePaneContextMenuEntry {
	const countKey = context.selectedCount > 1 ? COUNT_LABEL_KEYS[id] : undefined;
	return { id, labelKey: countKey ?? LABEL_KEYS[id], countLabelKey: countKey, ...extra };
}

/**
 * The thumbnail menu for `context`, in order, separators included: New Slide;
 * Duplicate, Delete; Layout; Hide/Show; Add Section.
 *
 * "Hide"/"Show" is a single toggle entry whose label depends on the
 * selection's current state (all hidden -> "Show"; anything else -> "Hide",
 * matching PowerPoint's own toggle when the selection is mixed).
 */
export function buildSlidePaneContextMenuEntries(
	context: SlidePaneContextMenuContext,
): SlidePaneContextMenuEntry[] {
	const showsHide = context.hasVisibleInSelection || !context.hasHiddenInSelection;
	return [
		entry('new-slide', context),
		entry('duplicate', context, { separatorBefore: true }),
		entry('delete', context, { disabled: context.wouldDeleteAllSlides }),
		entry('layout', context, { separatorBefore: true, disabled: context.selectedCount > 1 }),
		entry('hide', context, {
			separatorBefore: true,
			labelKey: showsHide ? 'pptx.slidesPane.contextMenu.hide' : 'pptx.slidesPane.contextMenu.show',
		}),
		entry('add-section', context, { separatorBefore: true, disabled: context.selectedCount > 1 }),
	];
}
