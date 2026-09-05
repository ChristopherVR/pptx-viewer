import {
	cloneElement as cloneElementDeep,
	groupElements as groupElementArray,
	hasTextProperties,
	isTemplateElementId,
	makeStoreAwareId,
	reassignDescendantIds,
	resolveThemeColorRef,
	ungroupElements as ungroupElementInArray,
} from 'pptx-viewer-core';
import type {
	TextPptxElement,
	ShapePptxElement,
	ConnectorPptxElement,
	ImagePptxElement,
	PptxElementWithText,
	PptxElementAnimation,
	PptxThemeColorRef,
} from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';
import { validateSlideIndex, generateElementId } from './helpers.js';
import { applyElementAltText, applyElementTitle } from './style-tools.js';

// ── addElement ──────────────────────────────────────────────────────────────

export interface AddElementParams {
	slideIndex: number;
	type: 'text' | 'shape' | 'image' | 'table' | 'connector';
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	// text / shape / connector
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	fontColor?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	alignment?: 'left' | 'center' | 'right' | 'justify';
	// shape / connector
	shapeType?: string;
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	// image
	imageData?: string;
	altText?: string;
	// table
	rows?: number;
	columns?: number;
	cellData?: string[][];
	headerRow?: boolean;
	// connector
	startArrow?: string;
	endArrow?: string;
	startShapeId?: string;
	endShapeId?: string;
}

export interface AddElementResult {
	elementId: string;
	slideIndex: number;
}

export function addElement(
	ctx: ToolContext,
	params: AddElementParams,
): ToolResult<AddElementResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const id = generateElementId();
	const x = params.x ?? 100;
	const y = params.y ?? 100;
	const width = params.width ?? 300;
	const height = params.height ?? 60;

	switch (params.type) {
		case 'text': {
			const el: TextPptxElement = {
				id,
				type: 'text',
				x,
				y,
				width,
				height,
				text: params.text ?? '',
				textStyle: {
					fontSize: params.fontSize,
					fontFamily: params.fontFamily,
					color: params.fontColor,
					bold: params.bold,
					italic: params.italic,
					underline: params.underline,
					align: params.alignment,
				},
				textSegments: [
					{
						text: params.text ?? '',
						style: {
							fontSize: params.fontSize,
							fontFamily: params.fontFamily,
							color: params.fontColor,
							bold: params.bold,
							italic: params.italic,
							underline: params.underline,
						},
					},
				],
			};
			slide.elements.push(el);
			break;
		}

		case 'shape': {
			const el: ShapePptxElement = {
				id,
				type: 'shape',
				x,
				y,
				width,
				height,
				shapeType: params.shapeType ?? 'rect',
				text: params.text,
				textStyle: params.text
					? {
							fontSize: params.fontSize,
							fontFamily: params.fontFamily,
							color: params.fontColor,
							bold: params.bold,
							italic: params.italic,
							align: params.alignment,
						}
					: undefined,
				shapeStyle: {
					fillColor: params.fillColor,
					strokeColor: params.strokeColor,
					strokeWidth: params.strokeWidth,
				},
			};
			slide.elements.push(el);
			break;
		}

		case 'image': {
			const el: ImagePptxElement = {
				id,
				type: 'image',
				x,
				y,
				width,
				height,
				imageData: params.imageData,
				altText: params.altText,
			};
			slide.elements.push(el);
			break;
		}

		case 'table': {
			const rowCount = params.rows ?? 2;
			const colCount = params.columns ?? 2;
			const colWidth = 1 / colCount;
			const tableRows = Array.from({ length: rowCount }, (_, r) => ({
				height: 40,
				cells: Array.from({ length: colCount }, (__, c) => ({
					text: params.cellData?.[r]?.[c] ?? '',
				})),
			}));
			const tableEl = {
				id,
				type: 'table' as const,
				x,
				y,
				width,
				height: params.height ?? rowCount * 40,
				tableData: {
					rows: tableRows,
					columnWidths: Array.from({ length: colCount }, () => colWidth),
					firstRowHeader: params.headerRow ?? false,
				},
			};
			slide.elements.push(tableEl);
			break;
		}

		case 'connector': {
			const el: ConnectorPptxElement = {
				id,
				type: 'connector',
				x,
				y,
				width,
				height,
				shapeStyle: {
					strokeColor: params.strokeColor ?? '#000000',
					strokeWidth: params.strokeWidth ?? 1,
					connectorStartArrow: params.startArrow as ConnectorPptxElement['shapeStyle'] extends
						| undefined
						| { connectorStartArrow?: infer A }
						? A
						: never,
					connectorEndArrow: params.endArrow as ConnectorPptxElement['shapeStyle'] extends
						| undefined
						| { connectorEndArrow?: infer A }
						? A
						: never,
				},
			};
			slide.elements.push(el);
			break;
		}

		default: {
			throw new Error(`Unknown element type: ${String(params.type)}`);
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: id, slideIndex: params.slideIndex },
	};
}

// ── updateElement ────────────────────────────────────────────────────────────

export interface UpdateElementParams {
	slideIndex: number;
	elementId: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	fontColor?: string;
	/**
	 * A theme colour for the run text (`{ scheme: 'accent1', lumMod: 0.8 }`).
	 * Wins on save (`<a:schemeClr>` instead of a canonical `<a:srgbClr>`), and
	 * resolves `fontColor` immediately when `fontColor` was not also given.
	 * Passing `fontColor` alone clears a previously-set text theme colour.
	 */
	fontThemeColor?: PptxThemeColorRef;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	alignment?: 'left' | 'center' | 'right' | 'justify';
	fillColor?: string;
	strokeColor?: string;
	strokeWidth?: number;
	opacity?: number;
	hidden?: boolean;
	flipH?: boolean;
	flipV?: boolean;
	/** Accessibility description; see {@link applyElementAltText} for the accepted kinds. */
	altText?: string;
	/** Accessibility title; see {@link applyElementTitle} for the accepted kinds. */
	title?: string;
}

export function updateElement(
	ctx: ToolContext,
	params: UpdateElementParams,
): ToolResult<{ elementId: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	if (params.x !== undefined) {
		el.x = params.x;
	}
	if (params.y !== undefined) {
		el.y = params.y;
	}
	if (params.width !== undefined) {
		el.width = params.width;
	}
	if (params.height !== undefined) {
		el.height = params.height;
	}
	if (params.rotation !== undefined) {
		el.rotation = params.rotation;
	}
	if (params.opacity !== undefined) {
		el.opacity = params.opacity;
	}
	if (params.hidden !== undefined) {
		el.hidden = params.hidden;
	}
	if (params.flipH !== undefined) {
		el.flipHorizontal = params.flipH;
	}
	if (params.flipV !== undefined) {
		el.flipVertical = params.flipV;
	}
	if (params.altText !== undefined) {
		applyElementAltText(el, params.altText);
	}
	if (params.title !== undefined) {
		applyElementTitle(el, params.title);
	}

	if (hasTextProperties(el)) {
		const textEl = el as PptxElementWithText;
		if (params.text !== undefined) {
			textEl.text = params.text;
			if (textEl.textSegments && textEl.textSegments.length > 0) {
				textEl.textSegments[0].text = params.text;
			} else {
				textEl.textSegments = [{ text: params.text, style: {} }];
			}
		}
		if (!textEl.textStyle) {
			textEl.textStyle = {};
		}
		if (params.fontSize !== undefined) {
			textEl.textStyle.fontSize = params.fontSize;
		}
		if (params.fontFamily !== undefined) {
			textEl.textStyle.fontFamily = params.fontFamily;
		}
		if (params.fontThemeColor !== undefined) {
			textEl.textStyle.colorRef = params.fontThemeColor;
			const resolved = resolveThemeColorRef(params.fontThemeColor, ctx.pptxData.themeColorMap);
			if (params.fontColor !== undefined) {
				textEl.textStyle.color = params.fontColor;
			} else if (resolved) {
				textEl.textStyle.color = resolved;
			}
		} else if (params.fontColor !== undefined) {
			textEl.textStyle.color = params.fontColor;
			textEl.textStyle.colorRef = undefined;
		}
		if (params.bold !== undefined) {
			textEl.textStyle.bold = params.bold;
		}
		if (params.italic !== undefined) {
			textEl.textStyle.italic = params.italic;
		}
		if (params.underline !== undefined) {
			textEl.textStyle.underline = params.underline;
		}
		if (params.alignment !== undefined) {
			textEl.textStyle.align = params.alignment;
		}
	}

	if ('shapeStyle' in el && el.shapeStyle) {
		const ss = el.shapeStyle;
		if (params.fillColor !== undefined) {
			ss.fillColor = params.fillColor;
		}
		if (params.strokeColor !== undefined) {
			ss.strokeColor = params.strokeColor;
		}
		if (params.strokeWidth !== undefined) {
			ss.strokeWidth = params.strokeWidth;
		}
	} else if (
		params.fillColor !== undefined ||
		params.strokeColor !== undefined ||
		params.strokeWidth !== undefined
	) {
		if ('shapeStyle' in el) {
			(el as unknown as { shapeStyle: Record<string, unknown> }).shapeStyle = {
				fillColor: params.fillColor,
				strokeColor: params.strokeColor,
				strokeWidth: params.strokeWidth,
			};
		}
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId },
	};
}

// ── renameElement ───────────────────────────────────────────────────────────

export interface RenameElementParams {
	slideIndex: number;
	elementId: string;
	/** New element name (`cNvPr/@name`); an empty string clears the name. */
	name: string;
}

export function renameElement(
	ctx: ToolContext,
	params: RenameElementParams,
): ToolResult<{ elementId: string; name: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const el = slide.elements.find((e) => e.id === params.elementId);
	if (!el) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	const name = params.name.trim();
	if (name.length === 0) {
		delete el.name;
	} else {
		el.name = name;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId, name },
	};
}

// ── deleteElements ──────────────────────────────────────────────────────────

export interface DeleteElementsParams {
	slideIndex: number;
	elementIds: string[];
}

export function deleteElements(
	ctx: ToolContext,
	params: DeleteElementsParams,
): ToolResult<{ deletedCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const idSet = new Set(params.elementIds);
	const existingIds = new Set(slide.elements.map((element) => element.id));
	const notFound = params.elementIds.filter((id) => !existingIds.has(id));
	if (notFound.length > 0) {
		throw new Error(`Elements not found: ${notFound.join(', ')}`);
	}

	const before = slide.elements.length;
	slide.elements = slide.elements.filter((e) => !idSet.has(e.id));

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { deletedCount: before - slide.elements.length },
	};
}

// ── arrangeElements ──────────────────────────────────────────────────────────

export interface ArrangeElementsParams {
	slideIndex: number;
	action: 'align' | 'reorderLayer';
	// align
	elementIds?: string[];
	alignment?: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';
	// reorderLayer
	elementId?: string;
	layerAction?: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward';
}

export function arrangeElements(
	ctx: ToolContext,
	params: ArrangeElementsParams,
): ToolResult<{ slideIndex: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];

	if (params.action === 'align') {
		if (!params.elementIds || params.elementIds.length === 0) {
			throw new Error('elementIds is required for align action.');
		}
		const targetIds = new Set(params.elementIds);
		const targets = slide.elements.filter((element) => targetIds.has(element.id));
		if (targets.length === 0) {
			throw new Error('No matching elements found for align.');
		}

		switch (params.alignment) {
			case 'left': {
				const minX = Math.min(...targets.map((e) => e.x));
				for (const t of targets) {
					t.x = minX;
				}
				break;
			}
			case 'right': {
				const maxRight = Math.max(...targets.map((e) => e.x + e.width));
				for (const t of targets) {
					t.x = maxRight - t.width;
				}
				break;
			}
			case 'top': {
				const minY = Math.min(...targets.map((e) => e.y));
				for (const t of targets) {
					t.y = minY;
				}
				break;
			}
			case 'bottom': {
				const maxBottom = Math.max(...targets.map((e) => e.y + e.height));
				for (const t of targets) {
					t.y = maxBottom - t.height;
				}
				break;
			}
			case 'centerH': {
				const avgCX = targets.reduce((s, e) => s + e.x + e.width / 2, 0) / targets.length;
				for (const t of targets) {
					t.x = avgCX - t.width / 2;
				}
				break;
			}
			case 'centerV': {
				const avgCY = targets.reduce((s, e) => s + e.y + e.height / 2, 0) / targets.length;
				for (const t of targets) {
					t.y = avgCY - t.height / 2;
				}
				break;
			}
			default: {
				throw new Error(`Unknown alignment: ${String(params.alignment)}`);
			}
		}
	} else if (params.action === 'reorderLayer') {
		if (!params.elementId) {
			throw new Error('elementId is required for reorderLayer action.');
		}
		const idx = slide.elements.findIndex((e) => e.id === params.elementId);
		if (idx < 0) {
			throw new Error(`Element '${params.elementId}' not found.`);
		}
		const [el] = slide.elements.splice(idx, 1);
		switch (params.layerAction) {
			case 'bringToFront':
				slide.elements.push(el);
				break;
			case 'sendToBack':
				slide.elements.unshift(el);
				break;
			case 'bringForward': {
				const newIdx = Math.min(idx + 1, slide.elements.length);
				slide.elements.splice(newIdx, 0, el);
				break;
			}
			case 'sendBackward': {
				const newIdx = Math.max(idx - 1, 0);
				slide.elements.splice(newIdx, 0, el);
				break;
			}
			default: {
				slide.elements.splice(idx, 0, el);
				throw new Error(`Unknown layerAction: ${String(params.layerAction)}`);
			}
		}
	} else {
		throw new Error(`Unknown action: ${String(params.action)}`);
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { slideIndex: params.slideIndex },
	};
}

// ── cloneElement ─────────────────────────────────────────────────────────────

export interface CloneElementParams {
	slideIndex: number;
	elementId: string;
	targetSlideIndexes?: number[];
	offsetX?: number;
	offsetY?: number;
}

export interface CloneElementResult {
	clonedIds: string[];
}

export function cloneElement(
	ctx: ToolContext,
	params: CloneElementParams,
): ToolResult<CloneElementResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const srcSlide = ctx.pptxData.slides[params.slideIndex];
	const original = srcSlide.elements.find((e) => e.id === params.elementId);
	if (!original) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	const targets = params.targetSlideIndexes ?? [params.slideIndex];
	const clonedIds: string[] = [];
	const offsetX = params.offsetX ?? 20;
	const offsetY = params.offsetY ?? 20;

	for (const targetIdx of targets) {
		const terr = validateSlideIndex(targetIdx, ctx.pptxData.slides.length);
		if (terr) {
			throw new Error(terr);
		}
		const clone = cloneElementDeep(original);
		const intoTemplate = isTemplateElementId(original.id);
		clone.id = makeStoreAwareId(intoTemplate, original.id);
		// Only the ROOT used to be re-ided. Element ids are written back out as
		// `p:cNvPr/@id`, so duplicating a group left two shapes answering to the
		// same id: an animation's `p:spTgt/@spid` then names both, and selection,
		// hit testing and collaboration reconcile are keyed by id as well.
		reassignDescendantIds(clone, () => makeStoreAwareId(intoTemplate, original.id));
		clone.x += offsetX;
		clone.y += offsetY;
		ctx.pptxData.slides[targetIdx].elements.push(clone);
		clonedIds.push(clone.id);
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { clonedIds },
	};
}

// ── setElementAnimation ──────────────────────────────────────────────────────

export interface SetElementAnimationParams {
	slideIndex: number;
	elementId: string;
	entrance?: string;
	exit?: string;
	durationMs?: number;
	delayMs?: number;
	order?: number;
}

export function setElementAnimation(
	ctx: ToolContext,
	params: SetElementAnimationParams,
): ToolResult<{ elementId: string }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const elExists = slide.elements.some((e) => e.id === params.elementId);
	if (!elExists) {
		throw new Error(`Element '${params.elementId}' not found on slide ${params.slideIndex}.`);
	}

	if (!slide.animations) {
		slide.animations = [];
	}

	const existing = slide.animations.find((a) => a.elementId === params.elementId);
	if (existing) {
		if (params.entrance !== undefined) {
			existing.entrance = params.entrance as PptxElementAnimation['entrance'];
		}
		if (params.exit !== undefined) {
			existing.exit = params.exit as PptxElementAnimation['exit'];
		}
		if (params.durationMs !== undefined) {
			existing.durationMs = params.durationMs;
		}
		if (params.delayMs !== undefined) {
			existing.delayMs = params.delayMs;
		}
		if (params.order !== undefined) {
			existing.order = params.order;
		}
	} else {
		const anim: PptxElementAnimation = {
			elementId: params.elementId,
			entrance: params.entrance as PptxElementAnimation['entrance'],
			exit: params.exit as PptxElementAnimation['exit'],
			durationMs: params.durationMs,
			delayMs: params.delayMs,
			order: params.order,
		};
		slide.animations.push(anim);
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { elementId: params.elementId },
	};
}

// ── groupElements ────────────────────────────────────────────────────────────

export interface GroupElementsParams {
	slideIndex: number;
	elementIds: string[];
}

export interface GroupElementsResult {
	groupId: string;
}

export function groupElements(
	ctx: ToolContext,
	params: GroupElementsParams,
): ToolResult<GroupElementsResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}
	if (params.elementIds.length < 2) {
		throw new Error('At least 2 elements are required to form a group.');
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const idSet = new Set(params.elementIds);
	const found = new Set(slide.elements.filter((e) => idSet.has(e.id)).map((e) => e.id));
	if (found.size !== idSet.size) {
		const missing = params.elementIds.filter((id) => !found.has(id));
		throw new Error(`Elements not found: ${missing.join(', ')}`);
	}

	// The bounding box, the group-relative child coordinates and (critically)
	// the slot the group takes in the element array all come from core, which
	// every viewer binding uses too. This tool used to compute them itself and
	// then `push` the group, which moved the whole selection to the FRONT of the
	// paint order: an AI-panel "group these" silently restacked the slide.
	const groupId = generateElementId();
	const grouped = groupElementArray(slide.elements, params.elementIds, groupId);
	slide.elements = grouped.elements;

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { groupId: grouped.groupId ?? groupId },
	};
}

// ── ungroupElements ──────────────────────────────────────────────────────────

export interface UngroupElementsParams {
	slideIndex: number;
	groupElementId: string;
}

export interface UngroupElementsResult {
	restoredIds: string[];
}

export function ungroupElements(
	ctx: ToolContext,
	params: UngroupElementsParams,
): ToolResult<UngroupElementsResult> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const group = slide.elements.find((e) => e.id === params.groupElementId);
	if (!group) {
		throw new Error(`Group element '${params.groupElementId}' not found.`);
	}
	if (group.type !== 'group') {
		throw new Error(`Element '${params.groupElementId}' is not a group.`);
	}

	// Promote through core rather than by hand: it deep-clones each promoted
	// child (so an undo snapshot still holding the group is not aliased) and
	// re-ids a promoted NESTED group's descendants when their ids route to the
	// wrong store. The hand-rolled version kept every id as it was, which put a
	// template subtree's ids on the slide store (and vice versa), where later
	// edits are dropped on save. Ids that already route correctly are left
	// alone, so animations and collaborators keep their targets.
	// A promoted child keeps its own id when that id already routes to the store
	// it lands in, so a tool call does not churn ids the caller (or an animation)
	// still refers to; only a mis-routed one is re-minted.
	const intoTemplate = isTemplateElementId(group.id);
	const childIds = group.children.map((child) =>
		isTemplateElementId(child.id) === intoTemplate
			? child.id
			: makeStoreAwareId(intoTemplate, group.id),
	);
	const promoted = ungroupElementInArray(slide.elements, params.groupElementId, childIds, {
		intoTemplate,
	});
	slide.elements = promoted.elements;

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { restoredIds: promoted.childIds },
	};
}

// ── batchUpdateElements ──────────────────────────────────────────────────────

export interface BatchUpdateElementsParams {
	slideIndex: number;
	elementIds: string[];
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	rotation?: number;
	opacity?: number;
	hidden?: boolean;
}

export function batchUpdateElements(
	ctx: ToolContext,
	params: BatchUpdateElementsParams,
): ToolResult<{ updatedCount: number }> {
	const err = validateSlideIndex(params.slideIndex, ctx.pptxData.slides.length);
	if (err) {
		throw new Error(err);
	}

	const slide = ctx.pptxData.slides[params.slideIndex];
	const idSet = new Set(params.elementIds);
	let count = 0;

	for (const el of slide.elements) {
		if (!idSet.has(el.id)) {
			continue;
		}
		if (params.x !== undefined) {
			el.x = params.x;
		}
		if (params.y !== undefined) {
			el.y = params.y;
		}
		if (params.width !== undefined) {
			el.width = params.width;
		}
		if (params.height !== undefined) {
			el.height = params.height;
		}
		if (params.rotation !== undefined) {
			el.rotation = params.rotation;
		}
		if (params.opacity !== undefined) {
			el.opacity = params.opacity;
		}
		if (params.hidden !== undefined) {
			el.hidden = params.hidden;
		}
		count++;
	}

	return {
		pptxData: ctx.pptxData,
		dirty: true,
		result: { updatedCount: count },
	};
}
