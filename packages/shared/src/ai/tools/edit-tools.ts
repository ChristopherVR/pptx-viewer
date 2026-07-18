/**
 * Element-editing tool executors (geometry, style, structure). Every executor
 * builds a pure slides updater and hands it to {@link routeWrite}, so the write
 * policy decides whether it is staged for review or applied immediately, and an
 * applied change is a single undoable history entry.
 */

import type {
	GroupPptxElement,
	ImagePptxElement,
	PptxElement,
	ShapePptxElement,
	TextPptxElement,
} from 'pptx-viewer-core';

import { alignElements, reorderLayer } from './edit-arrange';
import type { AiToolContext, AiToolExecutor } from './executor-base';
import { newElementId, requireElement, requireSlide, routeWrite } from './executor-base';
import { applyElementUpdate } from './mutations';

interface AddElementInput {
	slideIndex: number;
	type: 'text' | 'shape' | 'image' | 'table' | 'connector';
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	text?: string;
	shapeType?: string;
	fillColor?: string;
	strokeColor?: string;
	imageData?: string;
	rows?: number;
	columns?: number;
}

const updateText: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementId: string; text: string };
	return routeWrite(ctx, `Edit text on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		applyElementUpdate(el, { text: p.text });
		return slides;
	});
};

const setTextStyle: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementId: string } & Record<string, unknown>;
	return routeWrite(ctx, `Style text on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		applyElementUpdate(el, {
			fontSize: p.fontSize as number | undefined,
			fontFamily: p.fontFamily as string | undefined,
			fontColor: p.fontColor as string | undefined,
			bold: p.bold as boolean | undefined,
			italic: p.italic as boolean | undefined,
			underline: p.underline as boolean | undefined,
			align: p.align as 'left' | 'center' | 'right' | 'justify' | undefined,
		});
		return slides;
	});
};

const setShapeStyle: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		elementId: string;
		fillColor?: string;
		strokeColor?: string;
		strokeWidth?: number;
		opacity?: number;
	};
	return routeWrite(ctx, `Style shape on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		applyElementUpdate(el, {
			fillColor: p.fillColor,
			strokeColor: p.strokeColor,
			strokeWidth: p.strokeWidth,
			opacity: p.opacity,
		});
		return slides;
	});
};

const moveResizeElement: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		elementId: string;
		x?: number;
		y?: number;
		width?: number;
		height?: number;
		rotation?: number;
	};
	return routeWrite(ctx, `Move/resize on slide ${p.slideIndex + 1}`, (slides) => {
		const el = requireElement(requireSlide(slides, p.slideIndex), p.elementId);
		applyElementUpdate(el, {
			x: p.x,
			y: p.y,
			width: p.width,
			height: p.height,
			rotation: p.rotation,
		});
		return slides;
	});
};

function buildElement(id: string, p: AddElementInput): PptxElement {
	const base = {
		id,
		x: p.x ?? 100,
		y: p.y ?? 100,
		width: p.width ?? 300,
		height: p.height ?? 80,
	};
	switch (p.type) {
		case 'text':
			return {
				...base,
				type: 'text',
				text: p.text ?? '',
				textSegments: [{ text: p.text ?? '', style: {} }],
			} as TextPptxElement;
		case 'shape':
			return {
				...base,
				type: 'shape',
				shapeType: p.shapeType ?? 'rect',
				text: p.text,
				shapeStyle: { fillColor: p.fillColor, strokeColor: p.strokeColor },
			} as ShapePptxElement;
		case 'image':
			return { ...base, type: 'image', imageData: p.imageData } as ImagePptxElement;
		case 'connector':
			return {
				...base,
				type: 'connector',
				shapeStyle: { strokeColor: p.strokeColor ?? '#000000', strokeWidth: 1 },
			} as PptxElement;
		case 'table': {
			const rows = Math.max(1, p.rows ?? 2);
			const cols = Math.max(1, p.columns ?? 2);
			return {
				...base,
				type: 'table',
				tableData: {
					rows: Array.from({ length: rows }, () => ({
						height: 40,
						cells: Array.from({ length: cols }, () => ({ text: '' })),
					})),
					columnWidths: Array.from({ length: cols }, () => 1 / cols),
					firstRowHeader: false,
				},
			} as PptxElement;
		}
		default:
			throw new Error(`Unknown element type: ${String(p.type)}`);
	}
}

const addElement: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as AddElementInput;
	const id = newElementId();
	const result = routeWrite(ctx, `Add ${p.type} to slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		slide.elements.push(buildElement(id, p));
		return slides;
	});
	return { ...result, elementId: id };
};

const deleteElements: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementIds: string[] };
	return routeWrite(ctx, `Delete elements on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		const ids = new Set(p.elementIds);
		const missing = p.elementIds.filter((id) => !slide.elements.some((e) => e.id === id));
		if (missing.length > 0) {
			throw new Error(`Elements not found: ${missing.join(', ')}`);
		}
		slide.elements = slide.elements.filter((e) => !ids.has(e.id));
		return slides;
	});
};

const arrangeElements: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as {
		slideIndex: number;
		action: 'align' | 'reorderLayer';
		elementIds?: string[];
		alignment?: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';
		elementId?: string;
		layerAction?: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward';
	};
	return routeWrite(ctx, `Arrange on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		if (p.action === 'align') {
			alignElements(slide.elements, new Set(p.elementIds ?? []), p.alignment);
		} else {
			reorderLayer(slide.elements, p.elementId, p.layerAction);
		}
		return slides;
	});
};

const groupElements: AiToolExecutor = (ctx: AiToolContext, input: unknown) => {
	const p = input as { slideIndex: number; elementIds: string[] };
	if (p.elementIds.length < 2) {
		throw new Error('At least 2 elements are required to form a group.');
	}
	const groupId = newElementId();
	const result = routeWrite(ctx, `Group elements on slide ${p.slideIndex + 1}`, (slides) => {
		const slide = requireSlide(slides, p.slideIndex);
		const ids = new Set(p.elementIds);
		const children = slide.elements.filter((e) => ids.has(e.id));
		if (children.length !== p.elementIds.length) {
			throw new Error('Some elements to group were not found.');
		}
		const minX = Math.min(...children.map((e) => e.x));
		const minY = Math.min(...children.map((e) => e.y));
		const maxX = Math.max(...children.map((e) => e.x + e.width));
		const maxY = Math.max(...children.map((e) => e.y + e.height));
		const local = children.map((e) => ({ ...structuredClone(e), x: e.x - minX, y: e.y - minY }));
		slide.elements = slide.elements.filter((e) => !ids.has(e.id));
		slide.elements.push({
			id: groupId,
			type: 'group',
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
			children: local,
		} as GroupPptxElement);
		return slides;
	});
	return { ...result, groupId };
};

/** Element-editing executors keyed by tool name. */
export const editExecutors = {
	update_text: updateText,
	set_text_style: setTextStyle,
	set_shape_style: setShapeStyle,
	move_resize_element: moveResizeElement,
	add_element: addElement,
	delete_elements: deleteElements,
	arrange_elements: arrangeElements,
	group_elements: groupElements,
} satisfies Record<string, AiToolExecutor>;
