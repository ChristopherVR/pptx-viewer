/**
 * The "On bookmark" trigger's bookmark picker for the vanilla animation panel:
 * every (media element, bookmark) pair on the slide, from shared's
 * `listMediaBookmarkOptions`. Shown only while the trigger is
 * `onMediaBookmark`.
 */
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { listMediaBookmarkOptions, selectedBookmarkOptionValue } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { animSelect } from './animation-panel-fields';

export interface BookmarkField {
	/** The select itself (for disabling alongside the panel's other controls). */
	select: HTMLSelectElement;
	/** Rebuild the options and selection for the current slide and animation. */
	update(elements: readonly PptxElement[], animation: PptxElementAnimation | undefined): void;
}

/** Build the picker; `onChange` receives the option value for `setTriggerBookmark`. */
export function createBookmarkField(
	doc: Document,
	t: Translator,
	parent: HTMLElement,
	onChange: (optionValue: string) => void,
): BookmarkField {
	const select = animSelect(doc, t('pptx.animation.trigger.bookmarkLabel'), [], onChange, parent);
	select.setAttribute('data-pptx-animation-bookmark-picker', '');
	const wrap = select.parentElement as HTMLElement;
	return {
		select,
		update(elements, animation) {
			wrap.hidden = animation?.trigger !== 'onMediaBookmark';
			const options = listMediaBookmarkOptions(elements);
			const placeholder = doc.createElement('option');
			placeholder.value = '';
			placeholder.textContent = t(
				options.length === 0
					? 'pptx.animation.trigger.noBookmarks'
					: 'pptx.animation.trigger.selectBookmark',
			);
			select.replaceChildren(
				placeholder,
				...options.map((entry) => {
					const option = doc.createElement('option');
					option.value = entry.value;
					option.textContent = entry.label;
					return option;
				}),
			);
			select.value = selectedBookmarkOptionValue(animation);
			select.disabled ||= options.length === 0;
		},
	};
}
