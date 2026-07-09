/**
 * Cross-segment token replacement and element traversal for the template engine.
 *
 * Handles the OOXML-specific problem of `{{key}}` tokens split across
 * multiple text runs, plus recursive element/table processing and
 * placeholder key extraction.
 *
 * Split out of `template-engine-helpers.ts` to keep each file focused and
 * under the repo's ~300 LOC guideline.
 *
 * @module sdk/template-engine-segments
 */

import type { PptxElement } from '../../types/elements';
import type { TextSegment } from '../../types/text';
import { hasTextProperties } from '../../types/type-guards';
import {
	PLACEHOLDER_RE,
	EACH_OPEN_RE,
	EACH_CLOSE_RE,
	IF_OPEN_RE,
	IF_CLOSE_RE,
	resolvePath,
	replaceTokensInString,
	processInlineConditionals,
} from './template-engine-helpers';
import type { TemplateData } from './template-engine-types';

// ---------------------------------------------------------------------------
// Cross-segment token replacement
// ---------------------------------------------------------------------------

/**
 * Concatenate all text across segments to reconstruct the full text,
 * find tokens that may span multiple runs, and return the resolved
 * full text with token positions mapped back.
 *
 * This handles the common OOXML scenario where a `{{name}}` token is
 * split across multiple `<a:r>` runs (e.g., `{{`, `name`, `}}`).
 */
export function replaceTokensAcrossSegments(segments: TextSegment[], data: TemplateData): void {
	if (segments.length === 0) {
		return;
	}

	// Build concatenated text and a map of character offsets to segments
	const textParts: string[] = [];
	const segmentMap: Array<{ segmentIndex: number; localOffset: number }> = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (seg.isParagraphBreak) {
			// Paragraph breaks don't contribute text but we need to track them
			continue;
		}
		const text = seg.text ?? '';
		for (let c = 0; c < text.length; c++) {
			segmentMap.push({ segmentIndex: i, localOffset: c });
			textParts.push(text[c]);
		}
	}

	const fullText = textParts.join('');

	// First, process inline conditionals on the full text
	const afterConditionals = processInlineConditionals(fullText, data);

	// If conditionals changed the text, we need to redistribute
	if (afterConditionals !== fullText) {
		redistributeText(segments, fullText, afterConditionals);
		// After redistribution, do a second pass for simple placeholders
		replaceTokensAcrossSegments(segments, data);
		return;
	}

	// Find all {{...}} tokens in the full text
	PLACEHOLDER_RE.lastIndex = 0;
	const tokens: Array<{
		start: number;
		end: number;
		key: string;
		fullMatch: string;
	}> = [];
	let match: RegExpExecArray | null;
	while ((match = PLACEHOLDER_RE.exec(fullText)) !== null) {
		const key = match[1].trim();
		// Skip block tags
		if (
			EACH_OPEN_RE.test(key) ||
			EACH_CLOSE_RE.test(key) ||
			IF_OPEN_RE.test(key) ||
			IF_CLOSE_RE.test(key)
		) {
			continue;
		}
		tokens.push({
			start: match.index,
			end: match.index + match[0].length,
			key,
			fullMatch: match[0],
		});
	}

	if (tokens.length === 0) {
		return;
	}

	// Process tokens in reverse order so earlier offsets remain valid
	for (let t = tokens.length - 1; t >= 0; t--) {
		const token = tokens[t];
		const value = resolvePath(data, token.key);
		if (value === undefined) {
			continue;
		}
		if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
			continue;
		}

		const replacement = String(value);

		// Find which segments this token spans
		const startInfo = segmentMap[token.start];
		const endInfo = segmentMap[token.end - 1];

		if (!startInfo || !endInfo) {
			continue;
		}

		if (startInfo.segmentIndex === endInfo.segmentIndex) {
			// Token is entirely within one segment -- simple case
			const seg = segments[startInfo.segmentIndex];
			const before = seg.text.slice(0, startInfo.localOffset);
			const after = seg.text.slice(endInfo.localOffset + 1);
			seg.text = before + replacement + after;
		} else {
			// Token spans multiple segments
			// Put replacement in the first segment, clear the spanned parts from others
			const firstSeg = segments[startInfo.segmentIndex];
			const before = firstSeg.text.slice(0, startInfo.localOffset);
			firstSeg.text = before + replacement;

			// Clear fully-spanned middle segments
			for (let s = startInfo.segmentIndex + 1; s < endInfo.segmentIndex; s++) {
				if (!segments[s].isParagraphBreak) {
					segments[s].text = '';
				}
			}

			// Trim the end segment
			const lastSeg = segments[endInfo.segmentIndex];
			if (!lastSeg.isParagraphBreak) {
				lastSeg.text = lastSeg.text.slice(endInfo.localOffset + 1);
			}
		}

		// Rebuild segmentMap for subsequent (earlier) tokens
		// Since we process in reverse, we just need to recompute
		// Actually, since we process in reverse order, the offsets for
		// earlier tokens are not affected. But if the replacement changed
		// lengths, the segmentMap is stale for later characters. Since we
		// only use segmentMap for tokens at offsets < token.start, and we
		// haven't touched those segments, the map is still valid.
	}
}

/**
 * Redistribute text from a transformed full string back into segments,
 * preserving the style of the first character's segment for replaced regions.
 */
function redistributeText(segments: TextSegment[], _originalFull: string, newFull: string): void {
	// Simple strategy: put all text in the first non-break segment,
	// clear the rest. This preserves the first segment's style.
	let placed = false;
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			continue;
		}
		if (!placed) {
			seg.text = newFull;
			placed = true;
		} else {
			seg.text = '';
		}
	}
}

// ---------------------------------------------------------------------------
// Element processing
// ---------------------------------------------------------------------------

/**
 * Process all elements in an array, including recursing into group children.
 * Replaces placeholder tokens in text content.
 */
export function processElements(elements: PptxElement[], data: TemplateData): void {
	for (const element of elements) {
		if (element.type === 'group' && 'children' in element) {
			processElements((element as PptxElement & { children: PptxElement[] }).children, data);
		}

		if (element.type === 'table' && 'tableData' in element) {
			const tableEl = element as PptxElement & {
				tableData?: { rows: Array<{ cells: Array<{ text: string }> }> };
			};
			if (tableEl.tableData?.rows) {
				for (const row of tableEl.tableData.rows) {
					for (const cell of row.cells) {
						cell.text = replaceTokensInString(cell.text, data);
					}
				}
			}
			continue;
		}

		if (!hasTextProperties(element)) {
			continue;
		}

		const segments = element.textSegments;
		if (segments && segments.length > 0) {
			replaceTokensAcrossSegments(segments, data);
			// Sync the top-level text property
			(element as PptxElement & { text?: string }).text = segments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text)
				.join('');
		} else if (element.text) {
			// No segments -- just replace in the plain text
			(element as PptxElement & { text?: string }).text = replaceTokensInString(element.text, data);
		}
	}
}

// ---------------------------------------------------------------------------
// Placeholder extraction
// ---------------------------------------------------------------------------

/**
 * Extract placeholder keys from a text string into a set.
 *
 * @param text - The text to scan for `{{key}}` tokens.
 * @param found - Set to add discovered keys to.
 */
export function extractPlaceholdersFromText(text: string, found: Set<string>): void {
	PLACEHOLDER_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
		found.add(match[1].trim());
	}
}
