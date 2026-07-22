/**
 * The single source of truth for the assistant's document tools: the exact
 * `pptx-viewer-mcp` tool functions and zod schemas, run against the LIVE deck
 * via {@link runSharedTool}. This is what "the AI uses the MCP under the hood"
 * means in a browser: one tool implementation, two front-ends (the stdio MCP
 * server and this in-viewer panel).
 *
 * Each entry pairs the MCP zod schema (with the server-only `filePath` field
 * omitted, since the AI operates on the open deck, not a path) with the MCP
 * function and a commit strategy ({@link SharedToolSpec.commit}). Read tools
 * return data; slide tools stage reviewable proposals; theme/deck tools apply
 * through the binding's dedicated choke points.
 *
 * Viewer-only concepts with no MCP equivalent (navigation, whole-deck outline,
 * table merge) live in the bespoke executors and are merged in by the registry.
 */

import * as mcp from 'pptx-viewer-mcp';
import * as mcpSchemas from 'pptx-viewer-mcp/schemas';
import type { z } from 'zod';

import type { SharedToolCommit, SharedToolFn, SharedToolSpec } from './shared-tool-runner';

/** A document tool sourced from `pptx-viewer-mcp`. */
export interface McpToolEntry {
	/** Model-facing description. */
	description: string;
	/** Input schema with the server-only `filePath` field removed. */
	schema: z.ZodTypeAny;
	/** How to run and commit it against the live deck. */
	spec: SharedToolSpec;
}

/** Drop the file-based server's `filePath` field: the AI edits the open deck. */
function noFile(schema: z.ZodObject<z.ZodRawShape>): z.ZodTypeAny {
	return 'filePath' in schema.shape ? schema.omit({ filePath: true }) : schema;
}

/** Compact entry builder. */
function entry(
	description: string,
	schema: z.ZodObject<z.ZodRawShape>,
	fn: unknown,
	commit: SharedToolCommit,
	label: string,
	forceApproval = false,
): McpToolEntry {
	const spec: SharedToolSpec = { fn: fn as SharedToolFn, commit, label, forceApproval };
	return { description, schema: noFile(schema), spec };
}

/**
 * Every MCP-backed tool the assistant can call on the live deck, keyed by the
 * MCP tool name. Presentation-level (`deck`) tools require the binding to
 * implement {@link PptxAiBridge.applyDeckData}; otherwise they report they are
 * unavailable in this viewer.
 */
export const MCP_TOOL_ENTRIES: Record<string, McpToolEntry> = {
	// ── reads ────────────────────────────────────────────────────────────────
	// (get_slide / find_text / get_theme are served by the viewer-optimised
	// bespoke readers, which read live edited state and return model-friendly
	// markdown / outlines; the MCP-only reads below have no bespoke equivalent.)
	get_metadata: entry(
		'Get presentation metadata (title, author, keywords, custom properties).',
		mcpSchemas.GetMetadataSchema,
		mcp.getMetadata,
		'read',
		'Get metadata',
	),
	get_layouts: entry(
		'List available slide layouts from the presentation masters.',
		mcpSchemas.GetLayoutsSchema,
		mcp.getLayouts,
		'read',
		'Get layouts',
	),
	find_placeholders: entry(
		'Discover all {{placeholder}} tokens in the presentation.',
		mcpSchemas.FindPlaceholdersSchema,
		mcp.findPlaceholdersT,
		'read',
		'Find placeholders',
	),
	get_presentation_properties: entry(
		'Get slideshow properties (show type, loop, advance mode, slide range).',
		mcpSchemas.GetPresentationPropertiesSchema,
		mcp.getPresentationProperties,
		'read',
		'Get presentation properties',
	),
	run_accessibility_check: entry(
		'Audit the presentation for accessibility issues (alt text, contrast, reading order).',
		mcpSchemas.AccessibilityCheckSchema,
		mcp.runAccessibilityCheck,
		'read',
		'Accessibility check',
	),
	convert_to_markdown: entry(
		'Convert the presentation to Markdown.',
		mcpSchemas.ConvertToMarkdownSchema,
		mcp.convertToMarkdown,
		'read',
		'Convert to markdown',
	),

	// ── slide structure ────────────────────────────────────────────────────────
	add_slide: entry(
		'Add a new blank slide.',
		mcpSchemas.AddSlideSchema,
		mcp.addSlide,
		'slides',
		'Add slide',
	),
	delete_slides: entry(
		'Delete one or more slides by index.',
		mcpSchemas.DeleteSlidesSchema,
		mcp.deleteSlides,
		'slides',
		'Delete slides',
		true,
	),
	reorder_slides: entry(
		'Reorder slides by providing a new index order.',
		mcpSchemas.ReorderSlidesSchema,
		mcp.reorderSlides,
		'slides',
		'Reorder slides',
	),
	duplicate_slide: entry(
		'Duplicate a slide with fresh element ids.',
		mcpSchemas.DuplicateSlideSchema,
		mcp.duplicateSlide,
		'slides',
		'Duplicate slide',
	),
	update_slide_properties: entry(
		'Update a slide background, speaker notes, or visibility.',
		mcpSchemas.UpdateSlidePropertiesSchema,
		mcp.updateSlideProperties,
		'slides',
		'Update slide',
	),
	set_slide_transition: entry(
		'Set or remove a slide transition effect.',
		mcpSchemas.SetSlideTransitionSchema,
		mcp.setSlideTransition,
		'slides',
		'Set transition',
	),

	// ── elements ────────────────────────────────────────────────────────────────
	add_element: entry(
		'Add a text, shape, image, table, or connector element.',
		mcpSchemas.AddElementSchema,
		mcp.addElement,
		'slides',
		'Add element',
	),
	update_element: entry(
		'Update an element position, size, rotation, text, or basic style.',
		mcpSchemas.UpdateElementSchema,
		mcp.updateElement,
		'slides',
		'Update element',
	),
	delete_elements: entry(
		'Delete one or more elements by id.',
		mcpSchemas.DeleteElementsSchema,
		mcp.deleteElements,
		'slides',
		'Delete elements',
	),
	arrange_elements: entry(
		'Align elements or change their z-order (layer).',
		mcpSchemas.ArrangeElementsSchema,
		mcp.arrangeElements,
		'slides',
		'Arrange elements',
	),
	clone_element: entry(
		'Clone an element within or across slides.',
		mcpSchemas.CloneElementSchema,
		mcp.cloneElement,
		'slides',
		'Clone element',
	),
	set_element_animation: entry(
		'Set an entrance/exit/emphasis animation on an element.',
		mcpSchemas.SetElementAnimationSchema,
		mcp.setElementAnimation,
		'slides',
		'Set animation',
	),
	group_elements: entry(
		'Group multiple elements into a group.',
		mcpSchemas.GroupElementsSchema,
		mcp.groupElements,
		'slides',
		'Group elements',
	),
	ungroup_elements: entry(
		'Ungroup a group back into individual elements.',
		mcpSchemas.UngroupElementsSchema,
		mcp.ungroupElements,
		'slides',
		'Ungroup elements',
	),
	batch_update_elements: entry(
		'Apply the same property changes to multiple elements at once.',
		mcpSchemas.BatchUpdateElementsSchema,
		mcp.batchUpdateElements,
		'slides',
		'Update elements',
	),
	update_element_style: entry(
		'Update fill, stroke, shadow, glow, reflection, or image effects on an element.',
		mcpSchemas.UpdateElementStyleSchema,
		mcp.updateElementStyle,
		'slides',
		'Update style',
	),
	replace_geometry: entry(
		'Replace a shape geometry with a preset or custom path.',
		mcpSchemas.ReplaceGeometrySchema,
		mcp.replaceGeometry,
		'slides',
		'Replace geometry',
	),
	set_element_lock: entry(
		'Lock or unlock an element (move, resize, rotate, select, or text edit).',
		mcpSchemas.SetElementLockSchema,
		mcp.setElementLockT,
		'slides',
		'Set element lock',
	),
	manage_hyperlinks: entry(
		'List, set, or remove hyperlinks/actions on elements.',
		mcpSchemas.ManageHyperlinksSchema,
		mcp.manageHyperlinks,
		'slides',
		'Manage hyperlinks',
	),

	// ── text / tables / charts / smartart ───────────────────────────────────────
	replace_text: entry(
		'Find and replace text across slides.',
		mcpSchemas.ReplaceTextSchema,
		mcp.replaceText,
		'slides',
		'Replace text',
	),
	manage_comments: entry(
		'List, add, delete, or resolve slide comments.',
		mcpSchemas.ManageCommentsSchema,
		mcp.manageComments,
		'slides',
		'Manage comments',
	),
	update_table_cells: entry(
		'Update the text of specific table cells.',
		mcpSchemas.UpdateTableCellsSchema,
		mcp.updateTableCells,
		'slides',
		'Update table cells',
	),
	manage_table_structure: entry(
		'Insert or delete table rows and columns.',
		mcpSchemas.ManageTableStructureSchema,
		mcp.manageTableStructure,
		'slides',
		'Change table structure',
	),
	create_chart: entry(
		'Create a new chart element on a slide.',
		mcpSchemas.CreateChartSchema,
		mcp.createChart,
		'slides',
		'Create chart',
	),
	update_chart: entry(
		'Update chart type, title, legend, data labels, axis, or categories.',
		mcpSchemas.UpdateChartSchema,
		mcp.updateChart,
		'slides',
		'Update chart',
	),
	add_chart_series: entry(
		'Add a data series to an existing chart.',
		mcpSchemas.AddChartSeriesSchema,
		mcp.addChartSeriesT,
		'slides',
		'Add chart series',
	),
	remove_chart_series: entry(
		'Remove a data series from a chart by index.',
		mcpSchemas.RemoveChartSeriesSchema,
		mcp.removeChartSeriesT,
		'slides',
		'Remove chart series',
	),
	update_chart_series_data: entry(
		'Update the data values of a chart series.',
		mcpSchemas.UpdateChartSeriesDataSchema,
		mcp.updateChartSeriesData,
		'slides',
		'Update chart data',
	),
	manage_smart_art: entry(
		'Manage SmartArt: get, add, remove, reorder, promote/demote nodes, or decompose to shapes.',
		mcpSchemas.ManageSmartArtSchema,
		mcp.manageSmartArt,
		'slides',
		'Edit SmartArt',
	),
	apply_template: entry(
		'Replace {{placeholder}} tokens with provided values (mail merge).',
		mcpSchemas.ApplyTemplateSchema,
		mcp.applyTemplateT,
		'slides',
		'Apply template',
	),
	apply_layout: entry(
		'Apply a slide layout to a specific slide.',
		mcpSchemas.ApplyLayoutSchema,
		mcp.applyLayout,
		'slides',
		'Apply layout',
	),

	// ── theme (applied immediately, undoable) ────────────────────────────────────
	apply_theme_preset: entry(
		'Apply a built-in theme preset.',
		mcpSchemas.ApplyThemePresetSchema,
		mcp.applyThemePreset,
		'theme',
		'Apply theme preset',
	),
	update_theme_colors: entry(
		'Update individual theme colours (accent1-6, dk1/2, lt1/2, hlink, folHlink).',
		mcpSchemas.UpdateThemeColorsSchema,
		mcp.updateThemeColors,
		'theme',
		'Update theme colours',
	),
	update_theme_fonts: entry(
		'Update the theme heading (major) and body (minor) fonts.',
		mcpSchemas.UpdateThemeFontsSchema,
		mcp.updateThemeFonts,
		'theme',
		'Update theme fonts',
	),

	// ── presentation-level (needs applyDeckData) ─────────────────────────────────
	set_canvas_size: entry(
		'Change the presentation canvas dimensions.',
		mcpSchemas.SetCanvasSizeSchema,
		mcp.setCanvasSize,
		'deck',
		'Set canvas size',
	),
	update_metadata: entry(
		'Update presentation metadata (title, author, company, custom properties).',
		mcpSchemas.UpdateMetadataSchema,
		mcp.updateMetadata,
		'deck',
		'Update metadata',
	),
	manage_sections: entry(
		'List, add, remove, reorder sections, or move slides between sections.',
		mcpSchemas.ManageSectionsSchema,
		mcp.manageSections,
		'deck',
		'Manage sections',
	),
	update_presentation_properties: entry(
		'Update slideshow properties (show type, loop, advance mode, pen colour).',
		mcpSchemas.UpdatePresentationPropertiesSchema,
		mcp.updatePresentationProperties,
		'deck',
		'Update presentation properties',
	),
};

/** All MCP-backed tool names. */
export type McpToolName = keyof typeof MCP_TOOL_ENTRIES;
