/**
 * Ctrl/Shift multi-select for the slides pane's thumbnail rail.
 *
 * Only React's full-screen slide-sorter OVERLAY had multi-select; React's own
 * primary rail (the always-visible left panel) and all four other bindings'
 * rails and sorters were single-select only, so a user could never bulk
 * delete/duplicate/hide slides without opening the sorter first. This module
 * is the one click-resolution rule behind all five: Ctrl/Cmd toggles one id
 * in or out, Shift replaces the selection with the contiguous range from the
 * last plain or Ctrl click to the one just made, and a plain click resets to
 * a singleton.
 *
 * Selection is stored as slide IDS, not indices: an index shifts under
 * insert/delete/move, so an index-keyed selection silently points at the
 * wrong slide the moment the deck changes shape.
 *
 * @module render/slide-pane-selection
 */

/** One click on a slide thumbnail, as much as the resolver needs to see. */
export interface SlidePaneClickInput {
	/** The id of the slide that was clicked. */
	clickedId: string;
	/** Every slide id, in deck order (needed to resolve a Shift range). */
	orderedIds: readonly string[];
	/** The selection before this click. */
	selectedIds: readonly string[];
	/** The id a Shift range extends from, or null when there is no anchor yet. */
	anchorId: string | null;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

/** The selection after the click, and the new Shift anchor. */
export interface SlidePaneClickResult {
	selectedIds: string[];
	anchorId: string;
}

/**
 * Resolve one click on a slide thumbnail into the next selection.
 *
 * Mirrors React's slide-sorter overlay (`useSlideSorterState#handleSlideClick`),
 * generalised to ids: Ctrl/Cmd toggles, Shift replaces the whole selection
 * with the contiguous range between the anchor and the clicked slide (it does
 * not union with whatever was already selected, matching PowerPoint), and a
 * plain click collapses to just the one slide and re-anchors there.
 */
export function resolveSlidePaneClick(input: SlidePaneClickInput): SlidePaneClickResult {
	const { clickedId, orderedIds, selectedIds, anchorId, ctrlKey, metaKey, shiftKey } = input;

	if (ctrlKey || metaKey) {
		const next = selectedIds.includes(clickedId)
			? selectedIds.filter((id) => id !== clickedId)
			: [...selectedIds, clickedId];
		return { selectedIds: next, anchorId: clickedId };
	}

	if (shiftKey && anchorId) {
		const anchorIndex = orderedIds.indexOf(anchorId);
		const clickedIndex = orderedIds.indexOf(clickedId);
		if (anchorIndex !== -1 && clickedIndex !== -1) {
			const [start, end] =
				anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
			return { selectedIds: orderedIds.slice(start, end + 1), anchorId };
		}
	}

	return { selectedIds: [clickedId], anchorId: clickedId };
}
