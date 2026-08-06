import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as schemas from '../schemas/index.js';
import * as chartTools from '../tools/chart-tools.js';
import * as contentTools from '../tools/content-tools.js';
import * as conversionTools from '../tools/conversion-tools.js';
import * as elementTools from '../tools/element-tools.js';
import * as exportTools from '../tools/export-tools.js';
import * as geometryTools from '../tools/geometry-tools.js';
import * as hyperlinkTools from '../tools/hyperlink-tools.js';
import * as jsonTools from '../tools/json-tools.js';
import * as layoutTools from '../tools/layout-tools.js';
import * as lockTools from '../tools/lock-tools.js';
import * as metadataTools from '../tools/metadata-tools.js';
import * as presentationTools from '../tools/presentation-tools.js';
import * as sectionTools from '../tools/section-tools.js';
import * as slideTools from '../tools/slide-tools.js';
import * as smartartTools from '../tools/smartart-tools.js';
import * as styleTools from '../tools/style-tools.js';
import * as tableTools from '../tools/table-tools.js';
import * as templateTools from '../tools/template-tools.js';
import * as themeTools from '../tools/theme-tools.js';
import * as validationTools from '../tools/validation-tools.js';
import { runMcpTool, resolveScopedDir, resolveScopedFilePath } from './handlers.js';

export function createServer(): McpServer {
	const server = new McpServer({
		name: 'pptx-viewer-tools',
		version: '1.0.0',
	});

	// ── Slide tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'get_slide',
		{
			description: 'Inspect a single slide: returns layout, notes, elements',
			inputSchema: schemas.GetSlideSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.getSlide(ctx, { slideIndex: params.slideIndex }),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'add_slide',
		{
			description: 'Add a new blank slide to the presentation',
			inputSchema: schemas.AddSlideSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) => slideTools.addSlide(ctx, params));
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'delete_slides',
		{
			description: 'Delete one or more slides by index',
			inputSchema: schemas.DeleteSlidesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.deleteSlides(ctx, {
					slideIndexes: params.slideIndexes,
				}),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'reorder_slides',
		{
			description: 'Reorder slides by providing a new index array',
			inputSchema: schemas.ReorderSlidesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.reorderSlides(ctx, { newOrder: params.newOrder }),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'duplicate_slide',
		{
			description: 'Duplicate a slide with new element IDs',
			inputSchema: schemas.DuplicateSlideSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.duplicateSlide(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'update_slide_properties',
		{
			description: 'Update slide background, notes, or visibility',
			inputSchema: schemas.UpdateSlidePropertiesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.updateSlideProperties(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'set_slide_transition',
		{
			description: 'Set or remove a slide transition effect',
			inputSchema: schemas.SetSlideTransitionSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.setSlideTransition(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'set_canvas_size',
		{
			description: 'Change the presentation canvas dimensions',
			inputSchema: schemas.SetCanvasSizeSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				slideTools.setCanvasSize(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Element tools ───────────────────────────────────────────────────────

	server.registerTool(
		'add_element',
		{
			description: 'Add a text, shape, image, table, or connector element',
			inputSchema: schemas.AddElementSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.addElement(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'update_element',
		{
			description: 'Update element position, size, text, or style',
			inputSchema: schemas.UpdateElementSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.updateElement(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'rename_element',
		{
			description: "Rename an element (the selection pane's display name; cNvPr/@name)",
			inputSchema: schemas.RenameElementSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.renameElement(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'delete_elements',
		{
			description: 'Delete one or more elements by ID',
			inputSchema: schemas.DeleteElementsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.deleteElements(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'arrange_elements',
		{
			description: 'Align elements or change z-order (layer)',
			inputSchema: schemas.ArrangeElementsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.arrangeElements(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'clone_element',
		{
			description: 'Clone an element within or across slides',
			inputSchema: schemas.CloneElementSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.cloneElement(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'set_element_animation',
		{
			description: 'Set entrance/exit animation on an element',
			inputSchema: schemas.SetElementAnimationSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.setElementAnimation(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'group_elements',
		{
			description: 'Group multiple elements into a group',
			inputSchema: schemas.GroupElementsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.groupElements(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'ungroup_elements',
		{
			description: 'Ungroup a group element back to individual elements',
			inputSchema: schemas.UngroupElementsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.ungroupElements(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'batch_update_elements',
		{
			description: 'Apply the same properties to multiple elements',
			inputSchema: schemas.BatchUpdateElementsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				elementTools.batchUpdateElements(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Table tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'update_table_cells',
		{
			description: 'Update text content of table cells',
			inputSchema: schemas.UpdateTableCellsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				tableTools.updateTableCells(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'manage_table_structure',
		{
			description: 'Insert or delete table rows and columns',
			inputSchema: schemas.ManageTableStructureSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				tableTools.manageTableStructure(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Style tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'update_element_style',
		{
			description: 'Update fill, stroke, shadow, glow, or image effects',
			inputSchema: schemas.UpdateElementStyleSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				styleTools.updateElementStyle(ctx, params as styleTools.UpdateElementStyleParams),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'run_accessibility_check',
		{
			description: 'Audit the presentation for accessibility issues',
			inputSchema: schemas.AccessibilityCheckSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				styleTools.runAccessibilityCheck(ctx),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Content tools ───────────────────────────────────────────────────────

	server.registerTool(
		'find_text',
		{
			description: 'Search for text across all slides',
			inputSchema: schemas.FindTextSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) => contentTools.findText(ctx, params));
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'replace_text',
		{
			description: 'Find and replace text across slides',
			inputSchema: schemas.ReplaceTextSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				contentTools.replaceText(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		'manage_comments',
		{
			description: 'List, add, delete, or resolve slide comments',
			inputSchema: schemas.ManageCommentsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				contentTools.manageComments(ctx, params),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Conversion tools ────────────────────────────────────────────────────

	server.registerTool(
		'convert_to_markdown',
		{
			description: 'Convert the presentation to Markdown format',
			inputSchema: schemas.ConvertToMarkdownSchema.shape,
		},
		async (params) => {
			// `scopeOutputDir` is injected here rather than imported by the tool:
			// it needs `node:path`, and the tool modules also run in the browser.
			const result = await runMcpTool(params.filePath, (ctx) =>
				conversionTools.convertToMarkdown(ctx, { ...params, scopeOutputDir: resolveScopedDir }),
			);
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	// ── Theme tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'get_theme_info',
		{
			description: 'Get current theme information (colors, fonts, available presets)',
			inputSchema: schemas.GetThemeInfoSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) => themeTools.getThemeInfo(ctx));
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'apply_theme_preset',
		{
			description: 'Apply a built-in theme preset to the presentation',
			inputSchema: schemas.ApplyThemePresetSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				themeTools.applyThemePreset(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'update_theme_colors',
		{
			description: 'Update individual theme colors (accent1-6, dk1/2, lt1/2, hlink, folHlink)',
			inputSchema: schemas.UpdateThemeColorsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				themeTools.updateThemeColors(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'update_theme_fonts',
		{
			description: 'Update theme heading (major) and body (minor) fonts',
			inputSchema: schemas.UpdateThemeFontsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				themeTools.updateThemeFonts(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Chart tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'update_chart',
		{
			description: 'Update chart type, title, legend, data labels, axis, or categories',
			inputSchema: schemas.UpdateChartSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				chartTools.updateChart(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'add_chart_series',
		{
			description: 'Add a data series to an existing chart',
			inputSchema: schemas.AddChartSeriesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				chartTools.addChartSeriesT(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'remove_chart_series',
		{
			description: 'Remove a data series from a chart by index',
			inputSchema: schemas.RemoveChartSeriesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				chartTools.removeChartSeriesT(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'update_chart_series_data',
		{
			description: 'Update data values for a chart series',
			inputSchema: schemas.UpdateChartSeriesDataSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				chartTools.updateChartSeriesData(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'create_chart',
		{
			description: 'Create a new chart element on a slide',
			inputSchema: schemas.CreateChartSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				chartTools.createChart(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── SmartArt tools ──────────────────────────────────────────────────────

	server.registerTool(
		'manage_smart_art',
		{
			description:
				'Manage SmartArt: get nodes, add/remove/reorder/promote/demote nodes, or decompose to shapes',
			inputSchema: schemas.ManageSmartArtSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				smartartTools.manageSmartArt(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Template tools ──────────────────────────────────────────────────────

	server.registerTool(
		'find_placeholders',
		{
			description: 'Discover all {{placeholder}} tokens in the presentation',
			inputSchema: schemas.FindPlaceholdersSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				templateTools.findPlaceholdersT(ctx),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'apply_template',
		{
			description: 'Replace {{placeholder}} tokens with provided values (mail merge)',
			inputSchema: schemas.ApplyTemplateSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				templateTools.applyTemplateT(ctx, { data: params.data as Record<string, unknown> }),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Metadata tools ──────────────────────────────────────────────────────

	server.registerTool(
		'get_metadata',
		{
			description: 'Get presentation metadata (title, author, keywords, custom properties)',
			inputSchema: schemas.GetMetadataSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) => metadataTools.getMetadata(ctx));
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'update_metadata',
		{
			description: 'Update presentation metadata (title, author, company, custom properties)',
			inputSchema: schemas.UpdateMetadataSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				metadataTools.updateMetadata(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Section tools ───────────────────────────────────────────────────────

	server.registerTool(
		'manage_sections',
		{
			description: 'List, add, remove, reorder sections or move slides between sections',
			inputSchema: schemas.ManageSectionsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				sectionTools.manageSections(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Export tools ─────────────────────────────────────────────────────────

	server.registerTool(
		'export_to_svg',
		{
			description: 'Export all or specific slides to SVG strings',
			inputSchema: schemas.ExportToSvgSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				exportTools.exportToSvg(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'export_slide_svg',
		{
			description: 'Export a single slide to SVG',
			inputSchema: schemas.ExportSlideSvgSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				exportTools.exportSlideSvg(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'export_to_json',
		{
			description:
				'Export the presentation to the portable pptx-viewer-json document format ' +
				'(self-contained, binary assets embedded as base64)',
			inputSchema: schemas.ExportToJsonSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				jsonTools.exportToJson(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'import_from_json',
		{
			description:
				'Replace the presentation content with a deck imported from a pptx-viewer-json document',
			inputSchema: schemas.ImportFromJsonSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				jsonTools.importFromJson(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Hyperlink tools ─────────────────────────────────────────────────────

	server.registerTool(
		'manage_hyperlinks',
		{
			description: 'List, set, or remove hyperlinks/actions on elements',
			inputSchema: schemas.ManageHyperlinksSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				hyperlinkTools.manageHyperlinks(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Geometry tools ──────────────────────────────────────────────────────

	server.registerTool(
		'replace_geometry',
		{
			description: 'Replace a shape element geometry with a preset or custom SVG path',
			inputSchema: schemas.ReplaceGeometrySchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				geometryTools.replaceGeometry(ctx, {
					...params,
					adjustments: params.adjustments as Record<string, number> | undefined,
				}),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Lock tools ──────────────────────────────────────────────────────────

	server.registerTool(
		'set_element_lock',
		{
			description:
				'Lock or unlock an element (prevent move, resize, rotation, selection, text edit)',
			inputSchema: schemas.SetElementLockSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				lockTools.setElementLockT(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Validation tools ────────────────────────────────────────────────────

	server.registerTool(
		'validate_presentation',
		{
			description: 'Validate PPTX structural integrity (content types, relationships, XML)',
			inputSchema: schemas.ValidatePresentationSchema.shape,
		},
		async (params) => {
			const { readFile } = await import('node:fs/promises');
			const safePath = resolveScopedFilePath(params.filePath);
			const bytes = await readFile(safePath);
			const result = await validationTools.validatePresentation(bytes.buffer as ArrayBuffer);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'repair_presentation',
		{
			description: 'Auto-repair common PPTX structural issues',
			inputSchema: schemas.RepairPresentationSchema.shape,
		},
		async (params) => {
			const { readFile, writeFile } = await import('node:fs/promises');
			const safePath = resolveScopedFilePath(params.filePath);
			const bytes = await readFile(safePath);
			const { result, repairedBytes } = await validationTools.repairPresentation(
				bytes.buffer as ArrayBuffer,
			);
			if (result.repairCount > 0) {
				await writeFile(safePath, new Uint8Array(repairedBytes));
			}
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Presentation properties tools ───────────────────────────────────────

	server.registerTool(
		'get_presentation_properties',
		{
			description: 'Get slideshow properties (show type, loop, advance mode, slide range)',
			inputSchema: schemas.GetPresentationPropertiesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				presentationTools.getPresentationProperties(ctx),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'update_presentation_properties',
		{
			description: 'Update slideshow properties (show type, loop, advance mode, pen color)',
			inputSchema: schemas.UpdatePresentationPropertiesSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				presentationTools.updatePresentationProperties(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Layout tools ────────────────────────────────────────────────────────

	server.registerTool(
		'get_layouts',
		{
			description: 'List available slide layouts from the presentation masters',
			inputSchema: schemas.GetLayoutsSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) => layoutTools.getLayouts(ctx));
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.registerTool(
		'apply_layout',
		{
			description: 'Apply a slide layout to a specific slide',
			inputSchema: schemas.ApplyLayoutSchema.shape,
		},
		async (params) => {
			const result = await runMcpTool(params.filePath, (ctx) =>
				layoutTools.applyLayout(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	return server;
}
