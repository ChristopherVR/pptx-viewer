/**
 * JSON Schema definitions for every AI tool, mirroring the input vocabulary of
 * the `pptx-viewer-mcp` server. Schemas are plain objects (not `jsonSchema()`
 * instances) so this module never imports the optional `ai` peer at runtime;
 * the registry wraps each with `sdk.jsonSchema(...)` from the dynamically-loaded
 * SDK at assembly time, keeping the tool layer tree-shakeable and peer-optional.
 */

import type { PptxAiToolName } from '../config';

/** Minimal structural JSON Schema type (draft-07 subset) used by the tools. */
export interface JsonSchema {
	type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
	description?: string;
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	required?: string[];
	enum?: readonly (string | number | boolean)[];
	default?: unknown;
	minimum?: number;
	maximum?: number;
	additionalProperties?: boolean;
}

const str = (description?: string): JsonSchema => ({ type: 'string', description });
const int = (description?: string): JsonSchema => ({ type: 'integer', description });
const num = (description?: string): JsonSchema => ({ type: 'number', description });
const bool = (description?: string): JsonSchema => ({ type: 'boolean', description });
const enm = (values: readonly string[], description?: string): JsonSchema => ({
	type: 'string',
	enum: values,
	description,
});
const arr = (items: JsonSchema, description?: string): JsonSchema => ({
	type: 'array',
	items,
	description,
});
const obj = (properties: Record<string, JsonSchema>, required?: string[]): JsonSchema => ({
	type: 'object',
	properties,
	required,
	additionalProperties: false,
});

const slideIndex = int('Zero-based slide index.');
const elementId = str('Target element id.');
const align = enm(['left', 'center', 'right', 'justify'], 'Horizontal text alignment.');

/** A tool's model-facing description plus its input schema. */
export interface ToolDefinition {
	description: string;
	inputSchema: JsonSchema;
}

/** Canonical description + input schema for every AI tool. */
export const TOOL_DEFINITIONS: Record<PptxAiToolName, ToolDefinition> = {
	// ── read ───────────────────────────────────────────────────────────────
	get_deck_overview: {
		description: 'Summarise the deck: slide count, dimensions, and a per-slide outline.',
		inputSchema: obj({ maxSlides: int('Cap the number of slides listed.') }),
	},
	get_slide: {
		description: 'Return one slide as markdown plus an inventory of its elements.',
		inputSchema: obj({ slideIndex }, ['slideIndex']),
	},
	get_element: {
		description: 'Return the full properties of a single element.',
		inputSchema: obj({ slideIndex, elementId }, ['slideIndex', 'elementId']),
	},
	get_speaker_notes: {
		description: 'Return the speaker notes for a slide.',
		inputSchema: obj({ slideIndex }, ['slideIndex']),
	},
	find_text: {
		description: 'Search element text and notes across the deck.',
		inputSchema: obj(
			{
				query: str('Text or regex to search for.'),
				useRegex: bool('Treat query as a regular expression.'),
				caseSensitive: bool('Case-sensitive search.'),
			},
			['query'],
		),
	},
	get_theme: {
		description: 'Return the deck theme colours, fonts, and available presets.',
		inputSchema: obj({}),
	},

	// ── navigation ──────────────────────────────────────────────────────────
	go_to_slide: {
		description: 'Navigate the viewer to a slide.',
		inputSchema: obj({ slideIndex }, ['slideIndex']),
	},
	select_elements: {
		description: 'Select elements on a slide (empty list clears the selection).',
		inputSchema: obj({ slideIndex, elementIds: arr(str(), 'Element ids to select.') }, [
			'slideIndex',
			'elementIds',
		]),
	},

	// ── element editing ──────────────────────────────────────────────────────
	update_text: {
		description: 'Replace the text of a text/shape element.',
		inputSchema: obj({ slideIndex, elementId, text: str('New text.') }, [
			'slideIndex',
			'elementId',
			'text',
		]),
	},
	set_text_style: {
		description: 'Update font styling of a text/shape element.',
		inputSchema: obj(
			{
				slideIndex,
				elementId,
				fontSize: num(),
				fontFamily: str(),
				fontColor: str('Hex colour, e.g. #1a1a1a.'),
				bold: bool(),
				italic: bool(),
				underline: bool(),
				align,
			},
			['slideIndex', 'elementId'],
		),
	},
	set_shape_style: {
		description: 'Update fill and stroke of a shape/connector element.',
		inputSchema: obj(
			{
				slideIndex,
				elementId,
				fillColor: str('Hex fill colour.'),
				strokeColor: str('Hex stroke colour.'),
				strokeWidth: num(),
				opacity: num('0..1 opacity.'),
			},
			['slideIndex', 'elementId'],
		),
	},
	move_resize_element: {
		description: 'Move, resize, or rotate an element (pixels / degrees).',
		inputSchema: obj(
			{ slideIndex, elementId, x: num(), y: num(), width: num(), height: num(), rotation: num() },
			['slideIndex', 'elementId'],
		),
	},
	add_element: {
		description: 'Add a new text, shape, image, table, or connector element.',
		inputSchema: obj(
			{
				slideIndex,
				type: enm(['text', 'shape', 'image', 'table', 'connector']),
				x: num(),
				y: num(),
				width: num(),
				height: num(),
				text: str(),
				shapeType: str('DrawingML preset, e.g. rect, ellipse.'),
				fillColor: str(),
				strokeColor: str(),
				imageData: str('Data URL for an image element.'),
				rows: int(),
				columns: int(),
			},
			['slideIndex', 'type'],
		),
	},
	delete_elements: {
		description: 'Delete one or more elements from a slide.',
		inputSchema: obj({ slideIndex, elementIds: arr(str()) }, ['slideIndex', 'elementIds']),
	},
	arrange_elements: {
		description: 'Align elements or reorder one element in the z-stack.',
		inputSchema: obj(
			{
				slideIndex,
				action: enm(['align', 'reorderLayer']),
				elementIds: arr(str()),
				alignment: enm(['left', 'right', 'top', 'bottom', 'centerH', 'centerV']),
				elementId: str(),
				layerAction: enm(['bringToFront', 'sendToBack', 'bringForward', 'sendBackward']),
			},
			['slideIndex', 'action'],
		),
	},
	group_elements: {
		description: 'Group two or more elements into a single group element.',
		inputSchema: obj({ slideIndex, elementIds: arr(str()) }, ['slideIndex', 'elementIds']),
	},
	update_table_cell: {
		description: 'Set the text of a single table cell.',
		inputSchema: obj({ slideIndex, elementId, row: int(), column: int(), text: str() }, [
			'slideIndex',
			'elementId',
			'row',
			'column',
			'text',
		]),
	},
	update_chart_data: {
		description: 'Replace a chart series category labels and/or values.',
		inputSchema: obj(
			{
				slideIndex,
				elementId,
				seriesIndex: int('Zero-based series index.'),
				values: arr(num(), 'New numeric values for the series.'),
				categories: arr(str(), 'New category labels.'),
			},
			['slideIndex', 'elementId', 'seriesIndex'],
		),
	},
	replace_all: {
		description: 'Find-and-replace text across the whole deck.',
		inputSchema: obj(
			{
				query: str(),
				replacement: str(),
				useRegex: bool(),
				caseSensitive: bool(),
			},
			['query', 'replacement'],
		),
	},

	// ── slide editing ─────────────────────────────────────────────────────────
	add_slide: {
		description: 'Insert a new blank slide.',
		inputSchema: obj({
			insertAfterIndex: int('Insert after this index (default: end).'),
			backgroundColor: str(),
		}),
	},
	duplicate_slide: {
		description: 'Duplicate an existing slide.',
		inputSchema: obj({ slideIndex, targetIndex: int() }, ['slideIndex']),
	},
	delete_slides: {
		description: 'Delete one or more slides (always requires user approval).',
		inputSchema: obj({ slideIndexes: arr(int()) }, ['slideIndexes']),
	},
	reorder_slides: {
		description: 'Reorder slides. newOrder is a permutation of all slide indexes.',
		inputSchema: obj({ newOrder: arr(int()) }, ['newOrder']),
	},
	set_speaker_notes: {
		description: 'Set the speaker notes text of a slide.',
		inputSchema: obj({ slideIndex, notes: str() }, ['slideIndex', 'notes']),
	},
	update_slide_properties: {
		description: 'Update slide background, visibility, or notes.',
		inputSchema: obj({ slideIndex, backgroundColor: str(), hidden: bool(), notes: str() }, [
			'slideIndex',
		]),
	},
	set_slide_transition: {
		description: 'Set (or clear, with type "none") a slide transition.',
		inputSchema: obj(
			{ slideIndex, type: str('Transition type, or "none" to clear.'), durationMs: int() },
			['slideIndex', 'type'],
		),
	},
	set_element_animation: {
		description: 'Set entrance/exit animation for an element.',
		inputSchema: obj(
			{ slideIndex, elementId, entrance: str(), exit: str(), durationMs: int(), delayMs: int() },
			['slideIndex', 'elementId'],
		),
	},

	// ── theme editing ───────────────────────────────────────────────────────
	apply_theme_preset: {
		description: 'Apply a named theme preset to the deck.',
		inputSchema: obj({ presetName: str() }, ['presetName']),
	},
	update_theme_colors: {
		description: 'Update individual theme scheme colours (hex).',
		inputSchema: obj({
			dk1: str(),
			lt1: str(),
			dk2: str(),
			lt2: str(),
			accent1: str(),
			accent2: str(),
			accent3: str(),
			accent4: str(),
			accent5: str(),
			accent6: str(),
			hlink: str(),
			folHlink: str(),
		}),
	},
	update_theme_fonts: {
		description: 'Update the deck major (heading) and minor (body) fonts.',
		inputSchema: obj({ majorFont: str(), minorFont: str() }),
	},
};
