/**
 * custom-shows-deck.ts: translating custom shows between the DECK's key space
 * and the dialog's.
 *
 * `p:custShow/p:sldLst/p:sld/@r:id` names a slide by its RELATIONSHIP id, which
 * is what core parses into {@link PptxCustomShow.slideRIds} and what the save
 * writer writes straight back out. The custom-shows dialog, on the other hand,
 * checkboxes slides by `PptxSlide.id` (the archive path), because that is the
 * key the slide list is tracked by everywhere else in the viewer.
 *
 * Angular used to map one straight onto the other: the dialog's ids went into
 * `slideRIds` unchanged, which produces `<p:sld r:id="ppt/slides/slide2.xml"/>`.
 * PowerPoint rejects that package outright, so the translation is not cosmetic.
 *
 * Kept as pure functions (no Angular imports) so the round-trip can be tested
 * without an injection context.
 */
import type { PptxCustomShow } from 'pptx-viewer-core';

import type { CustomShow, ShowOrderCustomShow } from '../internal/shared';

/** The two slide keys a custom show can be expressed in. */
export interface CustomShowSlideKeys {
	/** Archive path (`PptxSlide.id`), the dialog's key. */
	readonly id?: string;
	/** Relationship id (`PptxSlide.rId`), the package's key. */
	readonly rId?: string;
}

/** rId -> slide id, for reading a parsed `p:custShow` into the dialog's terms. */
function rIdToSlideId(slides: readonly CustomShowSlideKeys[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const slide of slides) {
		if (slide.rId !== undefined && slide.id !== undefined) {
			map.set(slide.rId, slide.id);
		}
	}
	return map;
}

/** slide id -> rId, for writing the dialog's list back into the package. */
function slideIdToRId(slides: readonly CustomShowSlideKeys[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const slide of slides) {
		if (slide.id !== undefined && slide.rId !== undefined) {
			map.set(slide.id, slide.rId);
		}
	}
	return map;
}

/**
 * Parsed shows, in the dialog's key space.
 *
 * A membership entry naming a slide that is not in the deck is dropped rather
 * than carried as an unresolvable key: the dialog renders checkboxes off the
 * live slide list, so an entry it cannot draw would silently vanish on the next
 * edit anyway.
 */
export function customShowsFromDeck(
	parsed: readonly PptxCustomShow[] | undefined,
	slides: readonly CustomShowSlideKeys[],
): CustomShow[] {
	if (!parsed || parsed.length === 0) {
		return [];
	}
	const toSlideId = rIdToSlideId(slides);
	return parsed.map((show) => ({
		id: show.id,
		name: show.name,
		slideIds: (show.slideRIds ?? [])
			.map((rId) => toSlideId.get(rId))
			.filter((id): id is string => id !== undefined),
	}));
}

/**
 * The dialog's shows, in the package's key space, ready for the `customShows`
 * save option.
 */
export function customShowsToDeck(
	shows: readonly CustomShow[],
	slides: readonly CustomShowSlideKeys[],
): PptxCustomShow[] {
	const toRId = slideIdToRId(slides);
	return shows.map((show) => ({
		id: show.id,
		name: show.name,
		slideRIds: show.slideIds
			.map((slideId) => toRId.get(slideId))
			.filter((rId): rId is string => rId !== undefined),
	}));
}

/**
 * The active show as the shared show-order rule wants it, or `null` when the
 * whole deck is playing.
 *
 * Returning `null` for an empty membership is what makes "active show with no
 * resolvable slides" fall back to the full deck instead of to a black screen.
 */
export function activeCustomShowMembership(
	shows: readonly PptxCustomShow[],
	activeId: string | null,
): ShowOrderCustomShow | null {
	if (!activeId) {
		return null;
	}
	const show = shows.find((candidate) => candidate.id === activeId);
	if (!show || (show.slideRIds ?? []).length === 0) {
		return null;
	}
	return { slideRIds: show.slideRIds };
}
