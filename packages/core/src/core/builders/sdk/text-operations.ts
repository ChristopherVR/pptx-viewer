/**
 * Batch text find and replace operations for the headless PPTX SDK.
 *
 * Provides framework-agnostic pure functions for searching and
 * replacing text across all slides in a presentation, including
 * text in group children (recursively).
 *
 * @module sdk/text-operations
 */

import type { PptxElement } from '../../types/elements';
import type { PptxSlide } from '../../types/presentation';
import { hasTextProperties } from '../../types/type-guards';

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
 * Build the RegExp used to search for `search`. String patterns are escaped
 * so they only ever match literally. RegExp patterns are used exactly as
 * given, never rebuilt from another RegExp's `.source` (rebuilding a pattern
 * from `.source` is flagged as regex injection by static analysis, since
 * escaping can't be verified over an opaque, already-compiled pattern) - see
 * {@link execAll} for how a non-global RegExp is still iterated over all
 * matches without reconstruction.
 */
function toSearchRegex(search: string | RegExp): RegExp {
	if (typeof search === 'string') {
		const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(escaped, 'g');
	}
	return search;
}

/**
 * Find every match of `regex` in `text` without mutating or reconstructing
 * `regex`.
 *
 * When `regex` already has the `g` or `y` flag, matches are collected via
 * the standard `lastIndex`-driven exec loop. Otherwise, a non-global,
 * non-sticky RegExp always matches from the start of whatever string it is
 * given, so matches are collected by re-running `exec` against the
 * remaining unmatched tail of the string; this reproduces global-search
 * semantics without ever constructing a new RegExp.
 */
function execAll(regex: RegExp, text: string): RegExpExecArray[] {
	const results: RegExpExecArray[] = [];

	if (regex.global || regex.sticky) {
		regex.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(text)) !== null) {
			results.push(match);
			// Prevent infinite loop on zero-length matches
			if (match[0].length === 0) {
				regex.lastIndex += 1;
			}
		}
		return results;
	}

	let offset = 0;
	let remaining = text;
	while (remaining.length > 0) {
		const match = regex.exec(remaining);
		if (!match) {
			break;
		}
		const adjusted = [...match] as unknown as RegExpExecArray;
		adjusted.index = offset + match.index;
		adjusted.input = text;
		adjusted.groups = match.groups;
		results.push(adjusted);

		// Prevent infinite loop on zero-length matches
		const advance = match.index + (match[0].length || 1);
		offset += advance;
		remaining = remaining.slice(advance);
	}
	return results;
}

/**
 * Expand `$$`, `$&`, `` $` ``, `$'`, `$1`-`$99` and `$<name>` references in
 * `replacement`, mirroring the semantics `String.prototype.replace` applies
 * to its replacement-string argument when given a RegExp.
 *
 * Implemented as a single left-to-right scan rather than a regex: a regex
 * alternative like `<([^>]+)>` retried at every `$<` in the string is
 * quadratic when there's no closing `>` (each attempt backtracks to the end
 * of the string), which static analysis flags as a polynomial-ReDoS sink
 * since `replacement` is caller-controlled. The `$<name>` branch below uses
 * a two-pointer scan over a precomputed list of `>` positions so the total
 * work across the whole string stays linear.
 */
function expandReplacement(replacement: string, match: RegExpExecArray, fullText: string): string {
	const closeAngleIndices: number[] = [];
	for (let k = 0; k < replacement.length; k += 1) {
		if (replacement[k] === '>') {
			closeAngleIndices.push(k);
		}
	}

	let result = '';
	let i = 0;
	let gtPtr = 0;
	while (i < replacement.length) {
		if (replacement[i] !== '$' || i + 1 >= replacement.length) {
			result += replacement[i];
			i += 1;
			continue;
		}

		const next = replacement[i + 1];
		if (next === '$') {
			result += '$';
			i += 2;
		} else if (next === '&') {
			result += match[0];
			i += 2;
		} else if (next === '`') {
			result += fullText.slice(0, match.index);
			i += 2;
		} else if (next === "'") {
			result += fullText.slice(match.index + match[0].length);
			i += 2;
		} else if (next === '<') {
			while (gtPtr < closeAngleIndices.length && closeAngleIndices[gtPtr] < i + 2) {
				gtPtr += 1;
			}
			const closeIdx = gtPtr < closeAngleIndices.length ? closeAngleIndices[gtPtr] : -1;
			if (closeIdx === -1) {
				result += '$';
				i += 1;
			} else {
				const groupName = replacement.slice(i + 2, closeIdx);
				result += match.groups?.[groupName] ?? '';
				i = closeIdx + 1;
			}
		} else if (next >= '0' && next <= '9') {
			let digits = next;
			let digitsEnd = i + 2;
			if (
				digitsEnd < replacement.length &&
				replacement[digitsEnd] >= '0' &&
				replacement[digitsEnd] <= '9'
			) {
				digits += replacement[digitsEnd];
				digitsEnd += 1;
			}
			let groupIndex = Number(digits);
			if (digits.length === 2 && !(groupIndex >= 1 && groupIndex < match.length)) {
				digits = digits.slice(0, 1);
				groupIndex = Number(digits);
				digitsEnd = i + 2;
			}
			if (groupIndex >= 1 && groupIndex < match.length) {
				result += match[groupIndex] ?? '';
				i = digitsEnd;
			} else {
				result += '$';
				i += 1;
			}
		} else {
			result += '$';
			i += 1;
		}
	}
	return result;
}

/**
 * Apply `replacement` at every position in `matches`, expanding `$`
 * references against each match, and return the resulting string.
 */
function applyReplacements(text: string, matches: RegExpExecArray[], replacement: string): string {
	if (matches.length === 0) {
		return text;
	}
	let result = '';
	let cursor = 0;
	for (const match of matches) {
		result += text.slice(cursor, match.index);
		result += expandReplacement(replacement, match, text);
		cursor = match.index + match[0].length;
	}
	result += text.slice(cursor);
	return result;
}

/**
 * Collect all elements from a slide, flattening group children recursively.
 */
function collectElements(elements: PptxElement[]): PptxElement[] {
	const result: PptxElement[] = [];
	for (const el of elements) {
		result.push(el);
		if (el.type === 'group' && 'children' in el) {
			result.push(...collectElements((el as PptxElement & { children: PptxElement[] }).children));
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
export function findText(slides: PptxSlide[], search: string | RegExp): FindResult[] {
	if (typeof search === 'string' && search === '') {
		return [];
	}

	const regex = toSearchRegex(search);
	const results: FindResult[] = [];

	slides.forEach((slide, slideIndex) => {
		const allElements = collectElements(slide.elements ?? []);

		for (const element of allElements) {
			if (!hasTextProperties(element)) {
				continue;
			}

			const segments = element.textSegments ?? [];
			segments.forEach((seg, segIndex) => {
				const text = seg.text ?? '';
				for (const match of execAll(regex, text)) {
					results.push({
						slideIndex,
						elementId: element.id,
						segmentIndex: segIndex,
						text: match[0],
						matchIndex: match.index,
					});
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
	if (typeof search === 'string' && search === '') {
		return 0;
	}

	const regex = toSearchRegex(search);
	let totalReplacements = 0;

	function processElements(elements: PptxElement[]): void {
		for (const element of elements) {
			if (element.type === 'group' && 'children' in element) {
				processElements((element as PptxElement & { children: PptxElement[] }).children);
			}

			if (!hasTextProperties(element)) {
				continue;
			}

			const segments = element.textSegments ?? [];
			let elementTextChanged = false;

			for (const seg of segments) {
				const originalText = seg.text ?? '';
				const matches = execAll(regex, originalText);

				if (matches.length > 0) {
					seg.text = applyReplacements(originalText, matches, replacement);
					totalReplacements += matches.length;
					elementTextChanged = true;
				}
			}

			// Update the top-level text property to stay in sync
			if (elementTextChanged && segments.length > 0) {
				(element as PptxElement & { text?: string }).text = segments.map((s) => s.text).join('');
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
