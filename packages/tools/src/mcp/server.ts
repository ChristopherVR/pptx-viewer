import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as schemas from '../schemas/index.js';
import * as contentTools from '../tools/content-tools.js';
import * as conversionTools from '../tools/conversion-tools.js';
import * as elementTools from '../tools/element-tools.js';
import * as slideTools from '../tools/slide-tools.js';
import * as styleTools from '../tools/style-tools.js';
import * as tableTools from '../tools/table-tools.js';
import { runMcpTool as runMutatingTool } from './handlers.js';

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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
				slideTools.addSlide(ctx, params),
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
		'delete_slides',
		{
			description: 'Delete one or more slides by index',
			inputSchema: schemas.DeleteSlidesSchema.shape,
		},
		async (params) => {
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
		'delete_elements',
		{
			description: 'Delete one or more elements by ID',
			inputSchema: schemas.DeleteElementsSchema.shape,
		},
		async (params) => {
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
				contentTools.findText(ctx, params),
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
		'replace_text',
		{
			description: 'Find and replace text across slides',
			inputSchema: schemas.ReplaceTextSchema.shape,
		},
		async (params) => {
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
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
			const result = await runMutatingTool(params.filePath, (ctx) =>
				conversionTools.convertToMarkdown(ctx, params),
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

	return server;
}
