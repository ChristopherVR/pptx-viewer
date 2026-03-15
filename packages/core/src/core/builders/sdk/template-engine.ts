/**
 * Template engine (mail merge) for the headless PPTX SDK.
 *
 * Supports placeholder substitution with `{{key}}` syntax, dot-notation
 * for nested data, conditional blocks (`{{#if}}...{{/if}}`), and loop
 * blocks (`{{#each}}...{{/each}}`) that duplicate slides.
 *
 * @module sdk/template-engine
 */

import type { PptxData, PptxSlide } from "../../types/presentation";
import type { PptxElement } from "../../types/elements";
import type { TextSegment } from "../../types/text";
import type { PptxHandler } from "../../PptxHandler";
import { hasTextProperties } from "../../types/type-guards";
import { cloneSlide } from "../../utils/clone-utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Data record for template substitution.
 *
 * Values can be primitives, nested objects, or arrays (for loop blocks).
 */
export interface TemplateData {
	[key: string]: string | number | boolean | TemplateData | TemplateData[];
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Matches `{{...}}` tokens, including block tags. */
const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/** Matches an `{{#each <key>}}` opening tag. */
const EACH_OPEN_RE = /^\s*#each\s+([\w.]+)\s*$/;

/** Matches `{{/each}}`. */
const EACH_CLOSE_RE = /^\s*\/each\s*$/;

/** Matches an `{{#if <key>}}` opening tag. */
const IF_OPEN_RE = /^\s*#if\s+(!?[\w.]+)\s*$/;

/** Matches `{{/if}}`. */
const IF_CLOSE_RE = /^\s*\/if\s*$/;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-notation path against a data object.
 *
 * @example
 * ```ts
 * resolvePath({ company: { name: "Acme" } }, "company.name");
 * // => "Acme"
 * ```
 */
function resolvePath(
	data: TemplateData,
	path: string,
): string | number | boolean | TemplateData | TemplateData[] | undefined {
	const parts = path.trim().split(".");
	let current: unknown = data;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current as
		| string
		| number
		| boolean
		| TemplateData
		| TemplateData[]
		| undefined;
}

/**
 * Evaluate a condition key as a truthy/falsy value.
 *
 * Supports negation with a leading `!` (e.g. `{{#if !showChart}}`).
 */
function evaluateCondition(data: TemplateData, key: string): boolean {
	const negate = key.startsWith("!");
	const actualKey = negate ? key.slice(1).trim() : key.trim();
	const value = resolvePath(data, actualKey);
	const truthy = isTruthy(value);
	return negate ? !truthy : truthy;
}

/**
 * Determine if a resolved value is "truthy" for conditional purposes.
 */
function isTruthy(
	value:
		| string
		| number
		| boolean
		| TemplateData
		| TemplateData[]
		| undefined,
): boolean {
	if (value === undefined || value === null) return false;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "string") return value.length > 0;
	if (Array.isArray(value)) return value.length > 0;
	// Non-null object is truthy
	return true;
}

/**
 * Replace `{{placeholder}}` tokens in a single string, including
 * conditional `{{#if}}...{{/if}}` blocks (inline only — not cross-segment).
 */
function replaceTokensInString(text: string, data: TemplateData): string {
	// First, process inline conditional blocks: {{#if key}}content{{/if}}
	let result = processInlineConditionals(text, data);

	// Then, replace simple/nested placeholders
	result = result.replace(PLACEHOLDER_RE, (_match, key: string) => {
		const trimmed = key.trim();
		// Skip block tags that weren't consumed by conditional processing
		if (
			EACH_OPEN_RE.test(trimmed) ||
			EACH_CLOSE_RE.test(trimmed) ||
			IF_OPEN_RE.test(trimmed) ||
			IF_CLOSE_RE.test(trimmed)
		) {
			return _match;
		}
		const value = resolvePath(data, trimmed);
		if (value === undefined) return _match; // leave unresolved placeholders
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return String(value);
		}
		// Objects/arrays can't be directly substituted into text
		return _match;
	});

	return result;
}

/**
 * Process inline `{{#if key}}...{{/if}}` blocks within a single string.
 * Supports nesting.
 */
function processInlineConditionals(
	text: string,
	data: TemplateData,
): string {
	// Iteratively resolve innermost {{#if}}...{{/if}} blocks
	let result = text;
	let safety = 0;
	const MAX_ITERATIONS = 100;

	while (safety++ < MAX_ITERATIONS) {
		// Find the innermost {{#if ...}}...{{/if}} block (no nested #if inside)
		const ifOpenPattern =
			/\{\{\s*#if\s+([^}]+)\s*\}\}((?:(?!\{\{\s*#if\s)(?!\{\{\s*\/if\s*\}\}).)*?)\{\{\s*\/if\s*\}\}/s;
		const match = ifOpenPattern.exec(result);
		if (!match) break;

		const conditionKey = match[1].trim();
		const blockContent = match[2];
		const show = evaluateCondition(data, conditionKey);

		result =
			result.slice(0, match.index) +
			(show ? blockContent : "") +
			result.slice(match.index + match[0].length);
	}

	return result;
}

/**
 * Concatenate all text across segments to reconstruct the full text,
 * find tokens that may span multiple runs, and return the resolved
 * full text with token positions mapped back.
 *
 * This handles the common OOXML scenario where a `{{name}}` token is
 * split across multiple `<a:r>` runs (e.g., `{{`, `name`, `}}`).
 */
function replaceTokensAcrossSegments(
	segments: TextSegment[],
	data: TemplateData,
): void {
	if (segments.length === 0) return;

	// Build concatenated text and a map of character offsets to segments
	const textParts: string[] = [];
	const segmentMap: Array<{ segmentIndex: number; localOffset: number }> = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (seg.isParagraphBreak) {
			// Paragraph breaks don't contribute text but we need to track them
			continue;
		}
		const text = seg.text ?? "";
		for (let c = 0; c < text.length; c++) {
			segmentMap.push({ segmentIndex: i, localOffset: c });
			textParts.push(text[c]);
		}
	}

	const fullText = textParts.join("");

	// First, process inline conditionals on the full text
	const afterConditionals = processInlineConditionals(fullText, data);

	// If conditionals changed the text, we need to redistribute
	if (afterConditionals !== fullText) {
		redistributeText(segments, segmentMap, fullText, afterConditionals, data);
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

	if (tokens.length === 0) return;

	// Process tokens in reverse order so earlier offsets remain valid
	for (let t = tokens.length - 1; t >= 0; t--) {
		const token = tokens[t];
		const value = resolvePath(data, token.key);
		if (value === undefined) continue;
		if (
			typeof value !== "string" &&
			typeof value !== "number" &&
			typeof value !== "boolean"
		) {
			continue;
		}

		const replacement = String(value);

		// Find which segments this token spans
		const startInfo = segmentMap[token.start];
		const endInfo = segmentMap[token.end - 1];

		if (!startInfo || !endInfo) continue;

		if (startInfo.segmentIndex === endInfo.segmentIndex) {
			// Token is entirely within one segment — simple case
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
			for (
				let s = startInfo.segmentIndex + 1;
				s < endInfo.segmentIndex;
				s++
			) {
				if (!segments[s].isParagraphBreak) {
					segments[s].text = "";
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
function redistributeText(
	segments: TextSegment[],
	_segmentMap: Array<{ segmentIndex: number; localOffset: number }>,
	_originalFull: string,
	newFull: string,
	_data: TemplateData,
): void {
	// Simple strategy: put all text in the first non-break segment,
	// clear the rest. This preserves the first segment's style.
	let placed = false;
	for (const seg of segments) {
		if (seg.isParagraphBreak) continue;
		if (!placed) {
			seg.text = newFull;
			placed = true;
		} else {
			seg.text = "";
		}
	}
}

/**
 * Process all elements in an array, including recursing into group children.
 */
function processElements(
	elements: PptxElement[],
	data: TemplateData,
): void {
	for (const element of elements) {
		if (element.type === "group" && "children" in element) {
			processElements(
				(element as PptxElement & { children: PptxElement[] }).children,
				data,
			);
		}

		if (element.type === "table" && "tableData" in element) {
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

		if (!hasTextProperties(element)) continue;

		const segments = element.textSegments;
		if (segments && segments.length > 0) {
			replaceTokensAcrossSegments(segments, data);
			// Sync the top-level text property
			(element as PptxElement & { text?: string }).text = segments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text)
				.join("");
		} else if (element.text) {
			// No segments — just replace in the plain text
			(element as PptxElement & { text?: string }).text =
				replaceTokensInString(element.text, data);
		}
	}
}

/**
 * Check whether a slide's text content contains an `{{#each <key>}}` block tag.
 * Returns the key if found, or null otherwise.
 */
function findEachBlockOnSlide(slide: PptxSlide): string | null {
	for (const element of slide.elements) {
		const text = extractFullText(element);
		if (text) {
			const match = /\{\{\s*#each\s+([\w.]+)\s*\}\}/.exec(text);
			if (match) return match[1];
		}
	}
	return null;
}

/**
 * Check whether a slide's text contains `{{/each}}`.
 */
function hasEachClose(slide: PptxSlide): boolean {
	for (const element of slide.elements) {
		const text = extractFullText(element);
		if (text && /\{\{\s*\/each\s*\}\}/.test(text)) return true;
	}
	return false;
}

/**
 * Extract the full concatenated text from an element (segments or plain text).
 */
function extractFullText(element: PptxElement): string | null {
	if (hasTextProperties(element)) {
		if (element.textSegments && element.textSegments.length > 0) {
			return element.textSegments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text ?? "")
				.join("");
		}
		return element.text ?? null;
	}
	if (element.type === "group" && "children" in element) {
		const children = (
			element as PptxElement & { children: PptxElement[] }
		).children;
		for (const child of children) {
			const text = extractFullText(child);
			if (text) return text;
		}
	}
	return null;
}

/**
 * Remove `{{#each <key>}}` and `{{/each}}` tags from a slide's elements.
 */
function stripEachTags(slide: PptxSlide): void {
	for (const element of slide.elements) {
		stripEachTagsFromElement(element);
	}
}

function stripEachTagsFromElement(element: PptxElement): void {
	if (element.type === "group" && "children" in element) {
		const children = (
			element as PptxElement & { children: PptxElement[] }
		).children;
		for (const child of children) {
			stripEachTagsFromElement(child);
		}
	}

	if (!hasTextProperties(element)) return;

	const segments = element.textSegments;
	if (segments && segments.length > 0) {
		for (const seg of segments) {
			if (seg.isParagraphBreak) continue;
			seg.text = seg.text
				.replace(/\{\{\s*#each\s+[\w.]+\s*\}\}/g, "")
				.replace(/\{\{\s*\/each\s*\}\}/g, "");
		}
		(element as PptxElement & { text?: string }).text = segments
			.filter((s) => !s.isParagraphBreak)
			.map((s) => s.text)
			.join("");
	} else if (element.text) {
		(element as PptxElement & { text?: string }).text = element.text
			.replace(/\{\{\s*#each\s+[\w.]+\s*\}\}/g, "")
			.replace(/\{\{\s*\/each\s*\}\}/g, "");
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find all `{{placeholder}}` tokens in the presentation.
 *
 * Scans all text segments in all elements across all slides, including
 * group children (recursively) and table cells. Handles tokens that may
 * be split across multiple text runs by reconstructing the full text.
 *
 * @param data - The parsed presentation data.
 * @returns An array of unique placeholder keys (without the `{{ }}` delimiters).
 *
 * @example
 * ```ts
 * const keys = findPlaceholders(data);
 * // => ["name", "company.name", "#if showChart", "/if", "#each items", "/each"]
 * ```
 */
export function findPlaceholders(data: PptxData): string[] {
	const found = new Set<string>();

	function scanElement(element: PptxElement): void {
		if (element.type === "group" && "children" in element) {
			const children = (
				element as PptxElement & { children: PptxElement[] }
			).children;
			for (const child of children) {
				scanElement(child);
			}
		}

		if (element.type === "table" && "tableData" in element) {
			const tableEl = element as PptxElement & {
				tableData?: { rows: Array<{ cells: Array<{ text: string }> }> };
			};
			if (tableEl.tableData?.rows) {
				for (const row of tableEl.tableData.rows) {
					for (const cell of row.cells) {
						extractPlaceholdersFromText(cell.text, found);
					}
				}
			}
			return;
		}

		if (!hasTextProperties(element)) return;

		// Reconstruct full text across segments for cross-run tokens
		const segments = element.textSegments;
		if (segments && segments.length > 0) {
			const fullText = segments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text ?? "")
				.join("");
			extractPlaceholdersFromText(fullText, found);
		} else if (element.text) {
			extractPlaceholdersFromText(element.text, found);
		}
	}

	for (const slide of data.slides) {
		for (const element of slide.elements) {
			scanElement(element);
		}
	}

	return Array.from(found);
}

/**
 * Extract placeholder keys from a text string.
 */
function extractPlaceholdersFromText(
	text: string,
	found: Set<string>,
): void {
	PLACEHOLDER_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
		found.add(match[1].trim());
	}
}

/**
 * Replace `{{placeholder}}` tokens in all text across the presentation.
 *
 * Supports:
 * - **Simple substitution**: `{{name}}` replaced with the value of `data.name`
 * - **Dot notation**: `{{company.name}}` resolves nested objects
 * - **Conditionals**: `{{#if showChart}}...{{/if}}` — content is kept or removed
 *   based on the truthiness of the key. Negation is supported via `{{#if !key}}`.
 * - **Loops**: `{{#each items}}...{{/each}}` — duplicates slides for each item
 *   in the array. The loop body slides have their placeholders resolved against
 *   each array item merged with the parent data.
 *
 * Mutates `data.slides` in place.
 *
 * @param data - The parsed presentation data.
 * @param templateData - The data record to substitute.
 *
 * @example
 * ```ts
 * applyTemplate(data, {
 *   name: "Alice",
 *   company: { name: "Acme Corp" },
 *   showChart: true,
 *   items: [
 *     { title: "Slide A" },
 *     { title: "Slide B" },
 *   ],
 * });
 * ```
 */
export function applyTemplate(
	data: PptxData,
	templateData: TemplateData,
): void {
	// Phase 1: expand {{#each}} loop blocks (duplicates slides)
	data.slides = expandEachBlocks(data.slides, templateData);

	// Phase 2: apply simple/conditional/nested substitutions per slide
	for (const slide of data.slides) {
		processElements(slide.elements, templateData);

		// Also process notes
		if (slide.notes) {
			slide.notes = replaceTokensInString(slide.notes, templateData);
		}
		if (slide.notesSegments && slide.notesSegments.length > 0) {
			replaceTokensAcrossSegments(slide.notesSegments, templateData);
			slide.notes = slide.notesSegments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text)
				.join("");
		}
	}
}

/**
 * Expand `{{#each key}}` loop blocks. Slides between the opening
 * `{{#each key}}` and closing `{{/each}}` tags are duplicated for
 * each item in the array, with placeholders resolved against the
 * item data merged with the parent template data.
 */
function expandEachBlocks(
	slides: PptxSlide[],
	data: TemplateData,
): PptxSlide[] {
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
			// Same slide — use it as the loop body
			loopBodySlides.push(slides[i]);
			closeIdx = i;
		} else {
			// Opening slide — include it in the body
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
			// No closing tag found — leave slide as-is
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
					cloned.notes = replaceTokensInString(
						cloned.notes,
						mergedData,
					);
				}
				if (cloned.notesSegments && cloned.notesSegments.length > 0) {
					replaceTokensAcrossSegments(
						cloned.notesSegments,
						mergedData,
					);
					cloned.notes = cloned.notesSegments
						.filter((s) => !s.isParagraphBreak)
						.map((s) => s.text)
						.join("");
				}

				result.push(cloned);
			}
		}

		i = closeIdx + 1;
	}

	return result;
}

/**
 * Generate multiple presentations from a template and an array of data records.
 *
 * Each record produces an independent presentation. The original template
 * data is not modified.
 *
 * @param handler - A loaded PptxHandler (with the template already loaded).
 * @param data - The parsed presentation data (template).
 * @param records - Array of data records — one presentation per record.
 * @returns An array of serialized PPTX files as `Uint8Array`.
 *
 * @example
 * ```ts
 * const handler = new PptxHandler();
 * const data = await handler.load(templateBytes);
 *
 * const outputs = await mailMerge(handler, data, [
 *   { name: "Alice", company: "Acme" },
 *   { name: "Bob",   company: "Globex" },
 * ]);
 * // => outputs[0] has Alice's deck, outputs[1] has Bob's deck
 * ```
 */
export async function mailMerge(
	handler: PptxHandler,
	data: PptxData,
	records: TemplateData[],
): Promise<Uint8Array[]> {
	const results: Uint8Array[] = [];

	for (const record of records) {
		// Deep-clone the entire presentation data for this record
		const clonedSlides = data.slides.map((slide) => cloneSlide(slide));
		const clonedData: PptxData = {
			...data,
			slides: clonedSlides,
		};

		// Apply template to the cloned data
		applyTemplate(clonedData, record);

		// Save to bytes
		const bytes = await handler.save(clonedData.slides);
		results.push(bytes);
	}

	return results;
}
