/**
 * `animation-bookmark-trigger`: the "On bookmark" trigger picker every
 * binding's animation panel shows.
 *
 * An effect with `trigger: 'onMediaBookmark'` waits for a media element on the
 * slide to reach one of its bookmarks (`MediaPptxElement.bookmarks`). The
 * picker is a single `<select>` whose options are every (media element,
 * bookmark) pair on the slide; each option's value packs both halves so a
 * binding only ever maps {@link listMediaBookmarkOptions} onto `<option>`s and
 * hands the chosen value back to {@link setTriggerBookmark}.
 *
 * @module render/animation-bookmark-trigger
 */
import type { MediaPptxElement, PptxElement, PptxElementAnimation } from 'pptx-viewer-core';

import { upsert } from './animation-authoring';
import { flattenSlideElements } from './presentation-action';

/** Separator between the media element id and the bookmark name. */
const SEPARATOR = '\u001f';

/** One entry of the bookmark `<select>`. */
export interface MediaBookmarkOption {
	/** Opaque `<option value>`: pass it back to {@link setTriggerBookmark}. */
	value: string;
	/** The media element the bookmark belongs to. */
	mediaId: string;
	/** The bookmark's name. */
	bookmarkName: string;
	/**
	 * Display text: the bookmark name, prefixed with the media element's name
	 * when the slide has more than one media element with bookmarks.
	 */
	label: string;
}

/** Pack a media element id and bookmark name into an option value. */
export function bookmarkOptionValue(mediaId: string, bookmarkName: string): string {
	return `${mediaId}${SEPARATOR}${bookmarkName}`;
}

/** Unpack an option value, or `undefined` for an empty / malformed one. */
export function parseBookmarkOptionValue(
	value: string,
): { mediaId: string; bookmarkName: string } | undefined {
	const index = value.indexOf(SEPARATOR);
	if (index <= 0) {
		return undefined;
	}
	return { mediaId: value.slice(0, index), bookmarkName: value.slice(index + 1) };
}

/** Every (media element, bookmark) pair on a slide, in slide order. */
export function listMediaBookmarkOptions(
	elements: readonly PptxElement[] | undefined,
): MediaBookmarkOption[] {
	const media = flattenSlideElements(elements).filter(
		(element): element is MediaPptxElement =>
			element.type === 'media' && ((element as MediaPptxElement).bookmarks?.length ?? 0) > 0,
	);
	const prefix = media.length > 1;
	return media.flatMap((element, index) =>
		(element.bookmarks ?? []).map((bookmark) => ({
			value: bookmarkOptionValue(element.id, bookmark.label),
			mediaId: element.id,
			bookmarkName: bookmark.label,
			label: prefix
				? `${element.name?.trim() || `Media ${index + 1}`} - ${bookmark.label}`
				: bookmark.label,
		})),
	);
}

/** The option value an animation's current bookmark trigger selects ('' for none). */
export function selectedBookmarkOptionValue(anim: PptxElementAnimation | undefined): string {
	if (anim?.trigger !== 'onMediaBookmark' || !anim.triggerShapeId || !anim.triggerBookmark) {
		return '';
	}
	return bookmarkOptionValue(anim.triggerShapeId, anim.triggerBookmark);
}

/**
 * The fields a bookmark picker choice sets: trigger `onMediaBookmark` plus the
 * media element and bookmark. An empty value clears the bookmark but keeps the
 * trigger, so the picker can show "Select a bookmark" again. For bindings that
 * patch one animation entry instead of the whole list.
 */
export function bookmarkTriggerPatch(
	optionValue: string,
): Pick<PptxElementAnimation, 'trigger' | 'triggerShapeId' | 'triggerBookmark'> {
	const parsed = parseBookmarkOptionValue(optionValue);
	return {
		trigger: 'onMediaBookmark',
		triggerShapeId: parsed?.mediaId,
		triggerBookmark: parsed?.bookmarkName,
	};
}

/** {@link bookmarkTriggerPatch} applied to an element's entry in the list. */
export function setTriggerBookmark(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	optionValue: string,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, ...bookmarkTriggerPatch(optionValue) }));
}
