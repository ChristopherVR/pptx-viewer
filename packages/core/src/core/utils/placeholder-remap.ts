import type { PptxElement } from '../types';

/**
 * Scoring rules that decide which placeholder of a target layout a slide
 * element should move into when the user switches layouts.
 *
 * This is deliberately separate from {@link placeholderStyleFamily}. That
 * normaliser answers "which master text style does this placeholder inherit
 * from", which keeps `pic`, `chart` and `tbl` apart because they inherit
 * nothing from `p:bodyStyle`. Layout switching needs the looser question
 * PowerPoint asks: "can this content live here at all". A picture sitting in a
 * `pic` placeholder must be able to land in the destination's generic content
 * slot, because most layouts only offer `body`/`obj`.
 *
 * @module placeholder-remap
 */

/** Placeholder types that hold the slide's heading. */
const TITLE_ROLE: ReadonlySet<string> = new Set(['title', 'ctrtitle']);

/**
 * Placeholder types that hold slide content. PowerPoint's generic content
 * placeholder accepts any of these, and its layouts advertise the specific
 * kinds only when the layout is dedicated to them ("Title and Picture").
 */
const CONTENT_ROLE: ReadonlySet<string> = new Set([
	'body',
	'obj',
	'subtitle',
	'pic',
	'chart',
	'tbl',
	'media',
	'clipart',
	'dgm',
]);

/**
 * Resolve a placeholder type to the role it plays on the slide.
 *
 * @param type - `p:ph/@type`, in any casing, or `undefined` when omitted.
 * @returns `'title'`, `'content'`, or the normalised type for the remaining
 *   furniture placeholders (`dt`, `ftr`, `sldnum`, `hdr`), which only ever
 *   match their own kind.
 */
export function placeholderContentRole(type: string | undefined): string {
	const declared = (type ?? '').trim().toLowerCase() || 'body';
	if (TITLE_ROLE.has(declared)) {
		return 'title';
	}
	if (CONTENT_ROLE.has(declared)) {
		return 'content';
	}
	return declared;
}

/**
 * Placeholder types that suit an element's content, best first.
 *
 * A chart prefers a `chart` placeholder, then the generic `obj`/`body`. The
 * order matters when a layout offers several content slots: without it, a
 * picture can take the text slot and push the deck's body copy into the
 * picture frame.
 */
export function preferredPlaceholderTypes(element: PptxElement): readonly string[] {
	switch (element.type) {
		case 'image':
		case 'picture':
			return ['pic', 'obj', 'body'];
		case 'chart':
			return ['chart', 'obj', 'body'];
		case 'table':
			return ['tbl', 'obj', 'body'];
		case 'media':
		case 'model3d':
			return ['media', 'pic', 'obj', 'body'];
		case 'smartArt':
			return ['dgm', 'obj', 'body'];
		case 'text':
			return ['body', 'subtitle', 'obj'];
		default:
			return ['obj', 'body'];
	}
}

/** A placeholder identity as read from `p:ph`. */
export interface PlaceholderIdentity {
	type?: string;
	idx?: string;
}

/**
 * Score how well a target layout placeholder suits an element currently held
 * by `source`.
 *
 * @returns A score where higher is better, or a negative number when the
 *   target cannot accept this element at all. Callers pick the highest-scoring
 *   unclaimed target and must treat every negative result as "no match".
 */
export function scorePlaceholderMatch(
	element: PptxElement,
	source: PlaceholderIdentity,
	target: PlaceholderIdentity,
): number {
	if (placeholderContentRole(source.type) !== placeholderContentRole(target.type)) {
		return -1;
	}

	const sourceType = normalizeType(source.type);
	const targetType = normalizeType(target.type);
	let score = 0;

	// An idx match is the strongest signal available: it identifies the very
	// same slot when both decks descend from the same master family.
	if (source.idx !== undefined && source.idx === target.idx) {
		score += 100;
	}
	if (sourceType === targetType) {
		score += 50;
	}

	const preferred = preferredPlaceholderTypes(element).indexOf(targetType);
	if (preferred >= 0) {
		score += 30 - preferred * 5;
	}

	// The generic object placeholder accepts every kind of content, but it has
	// to rank below a dedicated picture/chart/table slot when the layout offers
	// both, otherwise "Title and Picture" drops its image into the text box.
	if (targetType === 'obj') {
		score += 10;
	}

	return score;
}

function normalizeType(type: string | undefined): string {
	return (type ?? '').trim().toLowerCase() || 'body';
}
