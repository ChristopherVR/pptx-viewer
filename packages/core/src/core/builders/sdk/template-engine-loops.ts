/**
 * Loop block expansion for the template engine.
 *
 * Handles `{{#each key}}...{{/each}}` blocks that duplicate slides
 * for each item in an array data source.
 *
 * @module sdk/template-engine-loops
 */

import type { PptxElement } from '../../types/elements';
import type { PptxSlide } from '../../types/presentation';
import { hasTextProperties } from '../../types/type-guards';
import { cloneSlide } from '../../utils/clone-utils';
import { resolvePath, replaceTokensInString } from './template-engine-helpers';
import { replaceTokensAcrossSegments, processElements } from './template-engine-segments';
import type { TemplateData } from './template-engine-types';

// ---------------------------------------------------------------------------
// Slide-level each-block detection
// ---------------------------------------------------------------------------

/**
 * Check whether a slide's text content contains an `{{#each <key>}}` block tag.
 *
 * @param slide - The slide to scan.
 * @returns The key if found, or null otherwise.
 */
export function findEachBlockOnSlide(slide: PptxSlide): string | null {
	for (const element of slide.elements) {
		const text = extractFullText(element);
		if (text) {
			const match = /\{\{\s*#each\s+([\w.]+)\s*\}\}/.exec(text);
			if (match) {
				return match[1];
			}
		}
	}
	return null;
}

/**
 * Check whether a slide's text contains `{{/each}}`.
 *
 * @param slide - The slide to scan.
 * @returns True if the closing each tag is found.
 */
export function hasEachClose(slide: PptxSlide): boolean {
	for (const element of slide.elements) {
		const text = extractFullText(element);
		if (text && /\{\{\s*\/each\s*\}\}/.test(text)) {
			return true;
		}
	}
	return false;
}

/**
 * Extract the full concatenated text from an element (segments or plain text).
 *
 * @param element - The element to extract text from.
 * @returns The extracted text, or null if no text is present.
 */
export function extractFullText(element: PptxElement): string | null {
	if (hasTextProperties(element)) {
		if (element.textSegments && element.textSegments.length > 0) {
			return element.textSegments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text ?? '')
				.join('');
		}
		return element.text ?? null;
	}
	if (element.type === 'group' && 'children' in element) {
		const children = (element as PptxElement & { children: PptxElement[] }).children;
		for (const child of children) {
			const text = extractFullText(child);
			if (text) {
				return text;
			}
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Each-tag stripping
// ---------------------------------------------------------------------------

/**
 * Remove `{{#each <key>}}` and `{{/each}}` tags from a slide's elements.
 *
 * @param slide - The slide to strip each-tags from.
 */
export function stripEachTags(slide: PptxSlide): void {
	for (const element of slide.elements) {
		stripEachTagsFromElement(element);
	}
}

/**
 * Remove `{{#each <key>}}` and `{{/each}}` tags from a single element,
 * recursing into group children.
 *
 * @param element - The element to strip tags from.
 */
function stripEachTagsFromElement(element: PptxElement): void {
	if (element.type === 'group' && 'children' in element) {
		const children = (element as PptxElement & { children: PptxElement[] }).children;
		for (const child of children) {
			stripEachTagsFromElement(child);
		}
	}

	if (!hasTextProperties(element)) {
		return;
	}

	const segments = element.textSegments;
	if (segments && segments.length > 0) {
		for (const seg of segments) {
			if (seg.isParagraphBreak) {
				continue;
			}
			seg.text = seg.text
				.replace(/\{\{\s*#each\s+[\w.]+\s*\}\}/g, '')
				.replace(/\{\{\s*\/each\s*\}\}/g, '');
		}
		(element as PptxElement & { text?: string }).text = segments
			.filter((s) => !s.isParagraphBreak)
			.map((s) => s.text)
			.join('');
	} else if (element.text) {
		(element as PptxElement & { text?: string }).text = element.text
			.replace(/\{\{\s*#each\s+[\w.]+\s*\}\}/g, '')
			.replace(/\{\{\s*\/each\s*\}\}/g, '');
	}
}

// ---------------------------------------------------------------------------
// Each-block expansion
// ---------------------------------------------------------------------------

/**
 * Expand `{{#each key}}` loop blocks. Slides between the opening
 * `{{#each key}}` and closing `{{/each}}` tags are duplicated for
 * each item in the array, with placeholders resolved against the
 * item data merged with the parent template data.
 *
 * @param slides - The slides to process.
 * @param data - The template data containing the arrays to iterate over.
 * @returns A new array of slides with loops expanded.
 */
export function expandEachBlocks(slides: PptxSlide[], data: TemplateData): PptxSlide[] {
	const result: PptxSlide[] = [];
	let i = 0;

	while (i < slides.length) {
		const eachKey = findEachBlockOnSlide(slides[i]);

		if (!eachKey) {
			result.push(slides[i]);
			i++;
			continue;
		}

		// Find the closing {{/each}} slide
		const loopBodySlides: PptxSlide[] = [];
		let closeIdx = -1;

		// The opening tag might be on the same slide as content
		// Collect slides until we find {{/each}}
		// Check if open and close are on the same slide
		if (hasEachClose(slides[i])) {
			// Same slide -- use it as the loop body
			loopBodySlides.push(slides[i]);
			closeIdx = i;
		} else {
			// Opening slide -- include it in the body
			loopBodySlides.push(slides[i]);
			for (let j = i + 1; j < slides.length; j++) {
				loopBodySlides.push(slides[j]);
				if (hasEachClose(slides[j])) {
					closeIdx = j;
					break;
				}
			}
		}

		if (closeIdx === -1) {
			// No closing tag found -- leave slide as-is
			result.push(slides[i]);
			i++;
			continue;
		}

		// Resolve the array data
		const arrayValue = resolvePath(data, eachKey);
		const items = Array.isArray(arrayValue) ? arrayValue : [];

		// For each item, clone the loop body slides, strip each tags, and apply
		for (const item of items) {
			const mergedData: TemplateData = { ...data, ...item };

			for (const bodySlide of loopBodySlides) {
				const cloned = cloneSlide(bodySlide);
				cloned.slideNumber = result.length + 1;
				cloned.id = `slide${cloned.slideNumber}`;
				cloned.rId = `rId${cloned.slideNumber + 1}`;
				stripEachTags(cloned);
				processElements(cloned.elements, mergedData);

				// Process notes
				if (cloned.notes) {
					cloned.notes = replaceTokensInString(cloned.notes, mergedData);
				}
				if (cloned.notesSegments && cloned.notesSegments.length > 0) {
					replaceTokensAcrossSegments(cloned.notesSegments, mergedData);
					cloned.notes = cloned.notesSegments
						.filter((s) => !s.isParagraphBreak)
						.map((s) => s.text)
						.join('');
				}

				result.push(cloned);
			}
		}

		i = closeIdx + 1;
	}

	return result;
}
