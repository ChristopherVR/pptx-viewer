import type { SmartArtPptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import {
	addSmartArtNode,
	removeSmartArtNode,
	updateSmartArtNodeText,
	reorderSmartArtNode,
	promoteSmartArtNode,
	demoteSmartArtNode,
	decomposeSmartArt,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex } from './helpers.js';

// ── manageSmartArt ───────────────────────────────────────────────────────────

export interface ManageSmartArtParams {
	slideIndex: number;
	elementId: string;
	action:
		| 'addNode'
		| 'removeNode'
		| 'updateNodeText'
		| 'reorderNode'
		| 'promoteNode'
		| 'demoteNode'
		| 'decompose'
		| 'getNodes';
	nodeId?: string;
	text?: string;
	afterNodeId?: string;
	direction?: number;
}

export interface SmartArtNodeInfo {
	id: string;
	text: string;
	children?: SmartArtNodeInfo[];
}

export interface ManageSmartArtResult {
	action: string;
	elementId: string;
	nodes?: SmartArtNodeInfo[];
	decomposedCount?: number;
}

function extractNodes(data: PptxSmartArtData): SmartArtNodeInfo[] {
	if (!data.nodes) {
		return [];
	}
	return data.nodes.map((n) => ({
		id: n.id,
		text: n.text ?? '',
		children: n.children?.map((c) => ({ id: c.id, text: c.text ?? '' })),
	}));
}

export function manageSmartArt(
	ctx: ToolContext,
	params: ManageSmartArtParams,
): ToolResult<ManageSmartArtResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}
	if (el.type !== 'smartArt') {
		throw new Error(`Element '${params.elementId}' is not a SmartArt.`);
	}

	const smartArt = el as SmartArtPptxElement;
	if (!smartArt.smartArtData) {
		throw new Error(`SmartArt '${params.elementId}' has no data.`);
	}

	switch (params.action) {
		case 'getNodes': {
			return {
				pptxData: ctx.pptxData,
				dirty: false,
				result: {
					action: 'getNodes',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'addNode': {
			smartArt.smartArtData = addSmartArtNode(
				smartArt.smartArtData,
				params.text ?? '',
				params.afterNodeId,
			);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'addNode',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'removeNode': {
			if (!params.nodeId) {
				throw new Error('nodeId is required for removeNode.');
			}
			smartArt.smartArtData = removeSmartArtNode(smartArt.smartArtData, params.nodeId);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'removeNode',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'updateNodeText': {
			if (!params.nodeId) {
				throw new Error('nodeId is required for updateNodeText.');
			}
			smartArt.smartArtData = updateSmartArtNodeText(
				smartArt.smartArtData,
				params.nodeId,
				params.text ?? '',
			);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: { action: 'updateNodeText', elementId: params.elementId },
			};
		}

		case 'reorderNode': {
			if (!params.nodeId) {
				throw new Error('nodeId is required for reorderNode.');
			}
			const dir = (params.direction ?? 1) as 1 | -1;
			smartArt.smartArtData = reorderSmartArtNode(smartArt.smartArtData, params.nodeId, dir);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'reorderNode',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'promoteNode': {
			if (!params.nodeId) {
				throw new Error('nodeId is required for promoteNode.');
			}
			smartArt.smartArtData = promoteSmartArtNode(smartArt.smartArtData, params.nodeId);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'promoteNode',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'demoteNode': {
			if (!params.nodeId) {
				throw new Error('nodeId is required for demoteNode.');
			}
			smartArt.smartArtData = demoteSmartArtNode(smartArt.smartArtData, params.nodeId);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'demoteNode',
					elementId: params.elementId,
					nodes: extractNodes(smartArt.smartArtData),
				},
			};
		}

		case 'decompose': {
			const bounds = {
				x: smartArt.x,
				y: smartArt.y,
				width: smartArt.width,
				height: smartArt.height,
			};
			const decomposed = decomposeSmartArt(smartArt.smartArtData, bounds);
			if (!decomposed || decomposed.length === 0) {
				throw new Error('Failed to decompose SmartArt into shapes.');
			}
			// Replace the SmartArt element with individual shapes
			const idx = slide.elements.indexOf(el);
			slide.elements.splice(idx, 1, ...decomposed);
			return {
				pptxData: ctx.pptxData,
				dirty: true,
				result: {
					action: 'decompose',
					elementId: params.elementId,
					decomposedCount: decomposed.length,
				},
			};
		}

		default:
			throw new Error(`Unknown SmartArt action: ${String(params.action)}`);
	}
}
