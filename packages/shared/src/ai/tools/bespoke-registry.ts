/**
 * Viewer-only tools that have no `pptx-viewer-mcp` equivalent, so they stay
 * bespoke: navigation (view-state, not document edits), the whole-deck outline
 * and single-element/notes readers (tuned to return model-friendly markdown and
 * inventories from the LIVE edited deck), and the deterministic table merge used
 * by the "merge the selected tables" chat directive. Everything that edits the
 * document, or has a richer MCP counterpart, goes through {@link MCP_TOOL_ENTRIES}.
 */

import { z } from 'zod';

import type { AiToolExecutor } from './executor-base';
import { mergeExecutors } from './merge-tools';
import { navExecutors } from './nav-tools';
import { readExecutors } from './read-tools';

/** A viewer-only tool: local schema + a bridge-bound executor. */
export interface BespokeToolEntry {
	description: string;
	schema: z.ZodTypeAny;
	executor: AiToolExecutor;
}

const slideIndex = z.number().int().min(0).describe('Zero-based slide index.');
const elementId = z.string().describe('Target element id.');

/** Viewer-only tools keyed by name. */
export const BESPOKE_TOOL_ENTRIES: Record<string, BespokeToolEntry> = {
	get_deck_overview: {
		description: 'Summarise the deck: slide count, dimensions, and a per-slide outline.',
		schema: z.object({
			maxSlides: z.number().int().min(1).optional().describe('Cap the number of slides listed.'),
		}),
		executor: readExecutors.get_deck_overview,
	},
	get_slide: {
		description:
			'Return one slide as markdown plus an inventory of its elements (ids, types, bounds, z-order).',
		schema: z.object({ slideIndex }),
		executor: readExecutors.get_slide,
	},
	get_element: {
		description: 'Return the full properties of a single element.',
		schema: z.object({ slideIndex, elementId }),
		executor: readExecutors.get_element,
	},
	get_speaker_notes: {
		description: 'Return the speaker notes for a slide.',
		schema: z.object({ slideIndex }),
		executor: readExecutors.get_speaker_notes,
	},
	find_text: {
		description: 'Find text across all slides and speaker notes.',
		schema: z.object({
			query: z.string().describe('Text or regular expression to search for.'),
			useRegex: z.boolean().optional().describe('Treat the query as a regular expression.'),
			caseSensitive: z.boolean().optional().describe('Match case exactly.'),
		}),
		executor: readExecutors.find_text,
	},
	get_theme: {
		description:
			'Return the current theme name, colour scheme, font scheme, and available presets.',
		schema: z.object({}),
		executor: readExecutors.get_theme,
	},
	go_to_slide: {
		description: 'Navigate the viewer to a slide by zero-based index.',
		schema: z.object({ slideIndex }),
		executor: navExecutors.go_to_slide,
	},
	select_elements: {
		description:
			'Select and highlight elements on a slide for the user (an empty list clears selection).',
		schema: z.object({
			slideIndex,
			elementIds: z.array(z.string()).describe('Element ids to select.'),
		}),
		executor: navExecutors.select_elements,
	},
	merge_tables: {
		description: 'Merge two table elements on a slide into one, removing the originals.',
		schema: z.object({
			slideIndex,
			elementIdA: z.string().describe('First table element id.'),
			elementIdB: z.string().describe('Second table element id.'),
			direction: z
				.enum(['vertical', 'horizontal'])
				.optional()
				.describe('Stack rows (vertical, default) or columns (horizontal).'),
		}),
		executor: mergeExecutors.merge_tables,
	},
};

/** All viewer-only tool names. */
export type BespokeToolName = keyof typeof BESPOKE_TOOL_ENTRIES;
