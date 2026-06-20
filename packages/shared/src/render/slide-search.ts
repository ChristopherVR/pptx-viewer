/**
 * slide-search.ts: Pure text-search helpers for PPTX slides.
 *
 * No framework imports; safe to use in web workers or server-side code. Shared
 * across the React, Vue, and Angular bindings.
 */

import type { PptxElement, PptxSlide, PptxSmartArtNode } from 'pptx-viewer-core';

/**
 * A single slide that matched a text search query.
 */
export interface SlideSearchMatch {
	/** Zero-based index of the matching slide in the slides array. */
	slideIndex: number;
	/** Number of (overlapping) occurrences of the query on this slide. */
	matchCount: number;
	/**
	 * A short snippet of text surrounding the first match.
	 * Includes a few characters of context on each side.
	 */
	snippet: string;
}

/** Half-width of the context window around the first match (characters). */
const SNIPPET_CONTEXT = 40;

/**
 * Collect all visible text from a single SmartArt node and its children.
 */
function collectSmartArtNodeText(node: PptxSmartArtNode): string {
	const parts: string[] = [node.text];
	if (node.children) {
		for (const child of node.children) {
			parts.push(collectSmartArtNodeText(child));
		}
	}
	return parts.join(' ');
}

/**
 * Collect all visible text from a single {@link PptxElement}.
 *
 * - `text` / `shape` / `connector`: flat `text` field + `textSegments[].text`.
 * - `table`: iterates `tableData.rows[].cells[].text`.
 * - `smartArt`: recursively collects `smartArtData.nodes[].text`.
 * - `group`: recurses into `children`.
 * - All other element types produce an empty string.
 */
export function collectElementText(element: PptxElement): string {
	const parts: string[] = [];

	if (element.type === 'text' || element.type === 'shape' || element.type === 'connector') {
		if (element.text) {
			parts.push(element.text);
		}
		if (element.textSegments) {
			for (const seg of element.textSegments) {
				if (seg.text) {
					parts.push(seg.text);
				}
			}
		}
	} else if (element.type === 'table') {
		const tableData = element.tableData;
		if (tableData) {
			for (const row of tableData.rows) {
				for (const cell of row.cells) {
					if (cell.text) {
						parts.push(cell.text);
					}
				}
			}
		}
	} else if (element.type === 'smartArt') {
		const smartArtData = element.smartArtData;
		if (smartArtData) {
			for (const node of smartArtData.nodes) {
				parts.push(collectSmartArtNodeText(node));
			}
		}
	} else if (element.type === 'group') {
		for (const child of element.children) {
			parts.push(collectElementText(child));
		}
	}

	return parts.join(' ');
}

/**
 * Collect all visible text from a {@link PptxSlide}, including speaker notes.
 */
export function collectSlideText(slide: PptxSlide): string {
	const parts: string[] = [];

	for (const element of slide.elements) {
		const text = collectElementText(element);
		if (text) {
			parts.push(text);
		}
	}

	if (slide.notes) {
		parts.push(slide.notes);
	}

	return parts.join(' ');
}

/**
 * Build a snippet string: up to {@link SNIPPET_CONTEXT} characters before and
 * after the first match position.
 */
function buildSnippet(haystack: string, lowerHaystack: string, lowerQuery: string): string {
	const idx = lowerHaystack.indexOf(lowerQuery);
	if (idx === -1) {
		return '';
	}
	const start = Math.max(0, idx - SNIPPET_CONTEXT);
	const end = Math.min(haystack.length, idx + lowerQuery.length + SNIPPET_CONTEXT);
	const raw = haystack.slice(start, end);
	const prefix = start > 0 ? '…' : '';
	const suffix = end < haystack.length ? '…' : '';
	return prefix + raw + suffix;
}

/**
 * Count all (possibly overlapping) occurrences of `lowerQuery` in `lowerText`.
 */
function countOccurrences(lowerText: string, lowerQuery: string): number {
	let count = 0;
	let pos = 0;
	while (true) {
		const found = lowerText.indexOf(lowerQuery, pos);
		if (found === -1) {
			break;
		}
		count++;
		pos = found + 1;
	}
	return count;
}

/**
 * Search all slides for `query` (case-insensitive substring match).
 *
 * Returns an empty array when `query` is empty or whitespace-only.
 */
export function searchSlides(slides: readonly PptxSlide[], query: string): SlideSearchMatch[] {
	const trimmed = query.trim();
	if (!trimmed) {
		return [];
	}

	const lowerQuery = trimmed.toLowerCase();
	const results: SlideSearchMatch[] = [];

	for (let i = 0; i < slides.length; i++) {
		const slide = slides[i];
		const text = collectSlideText(slide);
		const lowerText = text.toLowerCase();

		const matchCount = countOccurrences(lowerText, lowerQuery);
		if (matchCount > 0) {
			results.push({
				slideIndex: i,
				matchCount,
				snippet: buildSnippet(text, lowerText, lowerQuery),
			});
		}
	}

	return results;
}
