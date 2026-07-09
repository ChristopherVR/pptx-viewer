/**
 * Template engine (mail merge) for the headless PPTX SDK.
 *
 * Supports placeholder substitution with `{{key}}` syntax, dot-notation
 * for nested data, conditional blocks (`{{#if}}...{{/if}}`), and loop
 * blocks (`{{#each}}...{{/each}}`) that duplicate slides.
 *
 * This file is the public API facade. Implementation is split across:
 * - `template-engine-types.ts` -- shared types
 * - `template-engine-helpers.ts` -- token replacement, conditionals
 * - `template-engine-segments.ts` -- cross-segment replacement, element processing
 * - `template-engine-loops.ts` -- `{{#each}}` loop expansion
 *
 * @module sdk/template-engine
 */

import type { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types/elements';
import type { PptxData } from '../../types/presentation';
import { hasTextProperties } from '../../types/type-guards';
import { cloneSlide } from '../../utils/clone-utils';
import { replaceTokensInString } from './template-engine-helpers';
import { expandEachBlocks } from './template-engine-loops';
import {
	replaceTokensAcrossSegments,
	processElements,
	extractPlaceholdersFromText,
} from './template-engine-segments';
// Internal imports used by this module's public functions
import type { TemplateData } from './template-engine-types';

// Re-export the public type
export type { TemplateData } from './template-engine-types';

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
		if (element.type === 'group' && 'children' in element) {
			const children = (element as PptxElement & { children: PptxElement[] }).children;
			for (const child of children) {
				scanElement(child);
			}
		}

		if (element.type === 'table' && 'tableData' in element) {
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

		if (!hasTextProperties(element)) {
			return;
		}

		// Reconstruct full text across segments for cross-run tokens
		const segments = element.textSegments;
		if (segments && segments.length > 0) {
			const fullText = segments
				.filter((s) => !s.isParagraphBreak)
				.map((s) => s.text ?? '')
				.join('');
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
 * Replace `{{placeholder}}` tokens in all text across the presentation.
 *
 * Supports:
 * - **Simple substitution**: `{{name}}` replaced with the value of `data.name`
 * - **Dot notation**: `{{company.name}}` resolves nested objects
 * - **Conditionals**: `{{#if showChart}}...{{/if}}` -- content is kept or removed
 *   based on the truthiness of the key. Negation is supported via `{{#if !key}}`.
 * - **Loops**: `{{#each items}}...{{/each}}` -- duplicates slides for each item
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
export function applyTemplate(data: PptxData, templateData: TemplateData): void {
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
				.join('');
		}
	}
}

/**
 * Generate multiple presentations from a template and an array of data records.
 *
 * Each record produces an independent presentation. The original template
 * data is not modified.
 *
 * @param handler - A loaded PptxHandler (with the template already loaded).
 * @param data - The parsed presentation data (template).
 * @param records - Array of data records -- one presentation per record.
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
