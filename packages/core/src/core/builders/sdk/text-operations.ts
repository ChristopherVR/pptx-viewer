/**
 * Batch text find and replace operations for the headless PPTX SDK.
 *
 * Provides framework-agnostic pure functions for searching and
 * replacing text across all slides in a presentation, including
 * text in group children (recursively).
 *
 * @module sdk/text-operations
 */

import type { PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import { hasTextProperties } from "../../types/type-guards";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single text match result returned by {@link findText}.
 */
export interface FindResult {
	/** 0-based slide index. */
	slideIndex: number;
	/** ID of the element containing the match. */
	elementId: string;
	/** Index of the text segment within the element. */
	segmentIndex: number;
	/** The matched text. */
	text: string;
	/** Character offset within the segment where the match starts. */
	matchIndex: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a string-or-RegExp search into a global RegExp so we can
 * iterate all matches.
 */
function toGlobalRegex(search: string | RegExp): RegExp {
	if (typeof search === "string") {
		// Escape special regex characters for literal string matching
		const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(escaped, "g");
	}
	// Ensure global flag is set so we can iterate all matches
	if (search.global) return search;
	return new RegExp(search.source, search.flags + "g");
}

/**
 * Collect all elements from a slide, flattening group children recursively.
 */
function collectElements(elements: PptxElement[]): PptxElement[] {
	const result: PptxElement[] = [];
	for (const el of elements) {
		result.push(el);
		if (el.type === "group" && "children" in el) {
			result.push(
				...collectElements(
					(el as PptxElement & { children: PptxElement[] }).children,
				),
			);
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for text across all slides in the presentation.
 *
 * Searches through all text segments in all elements (including
 * group children recursively). Supports both plain string and
 * RegExp patterns.
 *
 * @param slides - Array of slides to search.
 * @param search - Plain string or RegExp to search for.
 * @returns Array of match results with location information.
 *
 * @example
 * ```ts
 * const results = findText(data.slides, /Q[1-4] \d{4}/);
 * console.log(`Found ${results.length} date references`);
 * ```
 */
export function findText(
	slides: PptxSlide[],
	search: string | RegExp,
): FindResult[] {
	if (typeof search === "string" && search === "") return [];

	const regex = toGlobalRegex(search);
	const results: FindResult[] = [];

	slides.forEach((slide, slideIndex) => {
		const allElements = collectElements(slide.elements ?? []);

		for (const element of allElements) {
			if (!hasTextProperties(element)) continue;

			const segments = element.textSegments ?? [];
			segments.forEach((seg, segIndex) => {
				const text = seg.text ?? "";
				// Reset regex lastIndex for each segment
				regex.lastIndex = 0;
				let match: RegExpExecArray | null;
				while ((match = regex.exec(text)) !== null) {
					results.push({
						slideIndex,
						elementId: element.id,
						segmentIndex: segIndex,
						text: match[0],
						matchIndex: match.index,
					});
					// Prevent infinite loop on zero-length matches
					if (match[0].length === 0) {
						regex.lastIndex += 1;
					}
				}
			});
		}
	});

	return results;
}

/**
 * Replace all occurrences of a search pattern in a single slide's elements.
 *
 * Mutates the slide's elements in place. Searches through all
 * text segments including group children recursively.
 *
 * @param slide - The slide to perform replacements on.
 * @param search - Plain string or RegExp to search for.
 * @param replacement - The replacement string (supports `$1`, `$&` etc. for RegExp).
 * @returns The number of replacements made.
 *
 * @example
 * ```ts
 * const count = replaceTextInSlide(data.slides[0], "2025", "2026");
 * console.log(`Updated ${count} occurrences on slide 1`);
 * ```
 */
export function replaceTextInSlide(
	slide: PptxSlide,
	search: string | RegExp,
	replacement: string,
): number {
	if (typeof search === "string" && search === "") return 0;

	const regex = toGlobalRegex(search);
	let totalReplacements = 0;

	function processElements(elements: PptxElement[]): void {
		for (const element of elements) {
			if (element.type === "group" && "children" in element) {
				processElements(
					(element as PptxElement & { children: PptxElement[] }).children,
				);
			}

			if (!hasTextProperties(element)) continue;

			const segments = element.textSegments ?? [];
			let elementTextChanged = false;

			for (let segIdx = 0; segIdx < segments.length; segIdx++) {
				const seg = segments[segIdx];
				const originalText = seg.text ?? "";
				regex.lastIndex = 0;

				// Count matches first
				let matchCount = 0;
				let m: RegExpExecArray | null;
				const countRegex = toGlobalRegex(search);
				while ((m = countRegex.exec(originalText)) !== null) {
					matchCount++;
					if (m[0].length === 0) {
						countRegex.lastIndex += 1;
					}
				}

				if (matchCount > 0) {
					const newText = originalText.replace(
						toGlobalRegex(search),
						replacement,
					);
					seg.text = newText;
					totalReplacements += matchCount;
					elementTextChanged = true;
				}
			}

			// Update the top-level text property to stay in sync
			if (elementTextChanged && segments.length > 0) {
				(element as PptxElement & { text?: string }).text = segments
					.map((s) => s.text)
					.join("");
			}
		}
	}

	processElements(slide.elements ?? []);
	return totalReplacements;
}

/**
 * Replace all occurrences of a search pattern across all slides.
 *
 * Mutates slides' elements in place. Searches through all text
 * segments including group children recursively.
 *
 * @param slides - Array of slides to perform replacements on.
 * @param search - Plain string or RegExp to search for.
 * @param replacement - The replacement string.
 * @returns The total number of replacements made across all slides.
 *
 * @example
 * ```ts
 * const count = replaceText(data.slides, "Acme Corp", "NewCo Inc");
 * console.log(`Rebranded ${count} occurrences`);
 * ```
 */
export function replaceText(
	slides: PptxSlide[],
	search: string | RegExp,
	replacement: string,
): number {
	let total = 0;
	for (const slide of slides) {
		total += replaceTextInSlide(slide, search, replacement);
	}
	return total;
}
