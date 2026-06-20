/**
 * Pure find & replace helpers for PPTX slides, shared by every binding.
 *
 * All functions are immutable; they never mutate their input arrays. No
 * framework imports, so this is safe to use in web workers or server-side code.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Identifies a single match of the find query at segment-level precision. */
export interface FindResult {
	/** Zero-based index of the slide in the slides array. */
	slideIndex: number;
	/** Id of the element that contains the match. */
	elementId: string;
	/** Zero-based index of the text segment within the element's `textSegments`. */
	segmentIndex: number;
	/** Character offset of the match start within the segment text. */
	startOffset: number;
	/** Number of characters matched (equals `query.length`). */
	length: number;
}

/** Options passed to search and replace helpers. */
export interface FindOptions {
	/** When `true`, the search is case-sensitive. Defaults to `false`. */
	matchCase?: boolean;
}

/** Result returned by {@link replaceInSlides} and {@link replaceMatch}. */
export interface ReplaceResult {
	/** Updated slides (immutable copy; unchanged slides share the original reference). */
	slides: readonly PptxSlide[];
	/** Number of text replacements actually applied. */
	replacements: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search all slides for occurrences of `query` at segment-level precision.
 *
 * - Only elements that pass `hasTextProperties` (text / shape / connector) are
 *   searched; tables, smartArt, and groups are skipped (they have no
 *   `textSegments`).
 * - Overlapping matches are counted (search advances by 1 character after each
 *   hit, not by `query.length`).
 * - Returns an empty array when `query` is empty.
 */
export function findInSlides(
	slides: readonly PptxSlide[],
	query: string,
	opts: FindOptions = {},
): FindResult[] {
	if (!query) {
		return [];
	}

	const matchCase = opts.matchCase ?? false;
	const normalised = matchCase ? query : query.toLowerCase();
	const results: FindResult[] = [];

	for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
		const slide = slides[slideIndex];
		for (const element of slide.elements) {
			if (!hasTextProperties(element)) {
				continue;
			}
			const segments = element.textSegments ?? [];
			for (let segIndex = 0; segIndex < segments.length; segIndex++) {
				const raw = segments[segIndex].text ?? '';
				const haystack = matchCase ? raw : raw.toLowerCase();
				let offset = 0;
				while (offset < haystack.length) {
					const pos = haystack.indexOf(normalised, offset);
					if (pos === -1) {
						break;
					}
					results.push({
						slideIndex,
						elementId: element.id,
						segmentIndex: segIndex,
						startOffset: pos,
						length: query.length,
					});
					// Advance by 1 to allow overlapping matches.
					offset = pos + 1;
				}
			}
		}
	}

	return results;
}

/**
 * Apply a set of find-replace substitutions to slides immutably.
 *
 * Replacements inside the same segment are applied in **descending offset**
 * order so that earlier matches are not shifted by later substitutions.
 *
 * Returns the original `slides` reference (no allocation) when `toReplace` is
 * empty.
 */
export function applyFindReplacements(
	slides: readonly PptxSlide[],
	toReplace: readonly FindResult[],
	replacement: string,
): ReplaceResult {
	if (toReplace.length === 0) {
		return { slides, replacements: 0 };
	}

	// Group matches by slide + element + segment so we can sort-and-apply per group.
	const grouped = new Map<string, FindResult[]>();
	for (const match of toReplace) {
		const key = `${match.slideIndex}::${match.elementId}::${match.segmentIndex}`;
		let bucket = grouped.get(key);
		if (!bucket) {
			bucket = [];
			grouped.set(key, bucket);
		}
		bucket.push(match);
	}

	// Work on a shallow-copied array; only affected slides are replaced.
	const nextSlides: PptxSlide[] = slides.slice();
	let totalReplacements = 0;

	for (const [, matches] of grouped) {
		// Sort descending by startOffset so slice indices stay valid.
		const sorted = matches.slice().sort((a, b) => b.startOffset - a.startOffset);

		for (const match of sorted) {
			const slide = nextSlides[match.slideIndex];
			if (!slide) {
				continue;
			}

			const elIdx = slide.elements.findIndex((e) => e.id === match.elementId);
			if (elIdx === -1) {
				continue;
			}

			const element = slide.elements[elIdx];
			if (!hasTextProperties(element)) {
				continue;
			}

			const segments = element.textSegments ?? [];
			const seg = segments[match.segmentIndex];
			if (!seg) {
				continue;
			}

			// Splice the replacement into the segment text.
			const before = seg.text.slice(0, match.startOffset);
			const after = seg.text.slice(match.startOffset + match.length);
			const newSegText = before + replacement + after;

			const nextSegments = segments.slice();
			nextSegments[match.segmentIndex] = { ...seg, text: newSegText };

			// Rebuild the concatenated top-level `text` field.
			const nextText = nextSegments.map((s) => s.text).join('');

			const nextElements = slide.elements.slice();
			nextElements[elIdx] = {
				...element,
				text: nextText,
				textSegments: nextSegments,
			} as PptxElement;

			nextSlides[match.slideIndex] = { ...slide, elements: nextElements };
			totalReplacements++;
		}
	}

	return { slides: nextSlides, replacements: totalReplacements };
}

/**
 * Replace a single match (identified by its position in `allResults`) and
 * return the updated slides together with the count of replacements applied
 * (always 0 or 1).
 *
 * This is a convenience wrapper around {@link applyFindReplacements} for the
 * "Replace current" action.
 */
export function replaceMatch(
	slides: readonly PptxSlide[],
	allResults: readonly FindResult[],
	matchIndex: number,
	replacement: string,
): ReplaceResult {
	const match = allResults[matchIndex];
	if (!match) {
		return { slides, replacements: 0 };
	}
	return applyFindReplacements(slides, [match], replacement);
}

/**
 * Replace **all** current matches and return the updated slides.
 *
 * This is a convenience wrapper around {@link applyFindReplacements} for the
 * "Replace All" action.
 */
export function replaceInSlides(
	slides: readonly PptxSlide[],
	query: string,
	replacement: string,
	opts: FindOptions = {},
): ReplaceResult {
	const results = findInSlides(slides, query, opts);
	return applyFindReplacements(slides, results, replacement);
}
