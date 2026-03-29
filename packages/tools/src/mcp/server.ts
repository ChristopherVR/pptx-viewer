import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import * as schemas from '../schemas/index.js';
import * as contentTools from '../tools/content-tools.js';
import * as conversionTools from '../tools/conversion-tools.js';
import * as elementTools from '../tools/element-tools.js';
import * as slideTools from '../tools/slide-tools.js';
import * as styleTools from '../tools/style-tools.js';
import * as tableTools from '../tools/table-tools.js';
import { runMutatingTool } from './handlers.js';

export function createServer(): McpServer {
	const server = new McpServer({
		name: 'pptx-viewer-tools',
		version: '1.0.0',
	});

	// ── Slide tools ─────────────────────────────────────────────────────────

	server.tool('get_slide', schemas.GetSlideSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.getSlide(ctx, { slideIndex: params.slideIndex }),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('add_slide', schemas.AddSlideSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.addSlide(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('delete_slides', schemas.DeleteSlidesSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.deleteSlides(ctx, { slideIndexes: params.slideIndexes }),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('reorder_slides', schemas.ReorderSlidesSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.reorderSlides(ctx, { newOrder: params.newOrder }),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('duplicate_slide', schemas.DuplicateSlideSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.duplicateSlide(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool(
		'update_slide_properties',
		schemas.UpdateSlidePropertiesSchema.shape,
		async (params) => {
			const result = await runMutatingTool(params.filePath, (ctx) =>
				slideTools.updateSlideProperties(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	server.tool('set_slide_transition', schemas.SetSlideTransitionSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.setSlideTransition(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('set_canvas_size', schemas.SetCanvasSizeSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			slideTools.setCanvasSize(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	// ── Element tools ───────────────────────────────────────────────────────

	server.tool('add_element', schemas.AddElementSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.addElement(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('update_element', schemas.UpdateElementSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.updateElement(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('delete_elements', schemas.DeleteElementsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.deleteElements(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('arrange_elements', schemas.ArrangeElementsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.arrangeElements(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('clone_element', schemas.CloneElementSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.cloneElement(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('set_element_animation', schemas.SetElementAnimationSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.setElementAnimation(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('group_elements', schemas.GroupElementsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.groupElements(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('ungroup_elements', schemas.UngroupElementsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.ungroupElements(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('batch_update_elements', schemas.BatchUpdateElementsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			elementTools.batchUpdateElements(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	// ── Table tools ─────────────────────────────────────────────────────────

	server.tool('update_table_cells', schemas.UpdateTableCellsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			tableTools.updateTableCells(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool(
		'manage_table_structure',
		schemas.ManageTableStructureSchema.shape,
		async (params) => {
			const result = await runMutatingTool(params.filePath, (ctx) =>
				tableTools.manageTableStructure(ctx, params),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
		},
	);

	// ── Style tools ─────────────────────────────────────────────────────────

	server.tool('update_element_style', schemas.UpdateElementStyleSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			styleTools.updateElementStyle(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('run_accessibility_check', schemas.AccessibilityCheckSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			styleTools.runAccessibilityCheck(ctx),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	// ── Content tools ───────────────────────────────────────────────────────

	server.tool('find_text', schemas.FindTextSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			contentTools.findText(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('replace_text', schemas.ReplaceTextSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			contentTools.replaceText(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	server.tool('manage_comments', schemas.ManageCommentsSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			contentTools.manageComments(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	// ── Conversion tools ────────────────────────────────────────────────────

	server.tool('convert_to_markdown', schemas.ConvertToMarkdownSchema.shape, async (params) => {
		const result = await runMutatingTool(params.filePath, (ctx) =>
			conversionTools.convertToMarkdown(ctx, params),
		);
		return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
	});

	return server;
}
