/**
 * `ribbon-slide-show-options` - the Slide Show tab's Options cluster as a pure
 * decision function over `PptxPresentationProperties`.
 *
 * WHY shared: all five bindings rendered these four checkboxes hard-coded
 * `checked` with no change handler, so "Use Timings" claimed to be on whether
 * or not the deck's `p:showPr/@useTimings` said so, and unticking it did
 * nothing. Two of them (`@useTimings`, `@showNarration`) are real, saved OOXML
 * attributes that the playback path already reads; deciding the mapping here
 * means the checkbox state and the show's behaviour cannot disagree.
 *
 * Two entries are declared UNSUPPORTED rather than quietly inert. "Keep Slides
 * Updated" is a co-authoring/Broadcast feature no binding implements, and
 * "Show Media Controls" is an application preference PowerPoint does not store
 * in the package at all and nothing in this viewer reads. A control that cannot
 * do anything renders disabled, because a checkbox that toggles and changes
 * nothing is worse than one that admits it is unavailable.
 *
 * @module render/ribbon-slide-show-options
 */
import type { PptxPresentationProperties } from 'pptx-viewer-core';

/** The four checkboxes in the Slide Show tab's Options group. */
export type SlideShowOptionId = 'keepUpdated' | 'useTimings' | 'playNarrations' | 'mediaControls';

/** How a binding should render one Options checkbox. */
export interface SlideShowOptionDescriptor {
	id: SlideShowOptionId;
	labelKey: string;
	/**
	 * No backing state exists, so the control renders disabled. See the module
	 * doc for why each one is here.
	 */
	unsupported: boolean;
}

/** The Options cluster, in PowerPoint's order. */
export const SLIDE_SHOW_OPTIONS: readonly SlideShowOptionDescriptor[] = [
	{ id: 'keepUpdated', labelKey: 'pptx.slideShow.keepUpdated', unsupported: true },
	{ id: 'useTimings', labelKey: 'pptx.slideShow.useTimings', unsupported: false },
	{ id: 'playNarrations', labelKey: 'pptx.slideShow.playNarrations', unsupported: false },
	{ id: 'mediaControls', labelKey: 'pptx.slideShow.mediaControls', unsupported: true },
];

/**
 * Whether a checkbox reads as ticked for the given deck.
 *
 * Both supported flags default to ON when the deck says nothing, matching
 * PowerPoint ("Using timings, if present" and narration are the defaults).
 * Unsupported entries always read as off.
 */
export function readSlideShowOption(
	properties: PptxPresentationProperties | undefined,
	id: SlideShowOptionId,
): boolean {
	switch (id) {
		case 'useTimings':
			return properties?.advanceMode !== 'manual';
		case 'playNarrations':
			return properties?.showWithNarration !== false;
		default:
			return false;
	}
}

/**
 * The presentation-property change a tick/untick commits, or null when the
 * option has no backing state (in which case the binding must render it
 * disabled and never call this).
 */
export function slideShowOptionChange(
	id: SlideShowOptionId,
	checked: boolean,
): Partial<PptxPresentationProperties> | null {
	switch (id) {
		case 'useTimings':
			return { advanceMode: checked ? 'useTimings' : 'manual' };
		case 'playNarrations':
			return { showWithNarration: checked };
		default:
			return null;
	}
}
