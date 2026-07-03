import { createEditorId } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { DrawingTool } from '../components/ribbon/ribbon-types';
import type { EditorOperations } from './useEditorOperations';

export interface UseInkDrawingInput {
	canEdit: () => boolean;
	presenting: Ref<boolean>;
	activeTool: Ref<DrawingTool>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	selectedElementIds: Ref<string[]>;
	ops: EditorOperations;
}

export interface UseInkDrawingResult {
	drawingActive: ComputedRef<boolean>;
	addInkStroke: (payload: {
		points: Array<{ x: number; y: number }>;
		color: string;
		width: number;
		tool: string;
	}) => void;
	eraseInkAt: (point: { x: number; y: number }) => void;
}

/**
 * useInkDrawing: Draw-tab ink capture. Owns the "is a pen/highlighter/eraser
 * tool armed" derivation and turns a captured stroke into an `ink` element (or,
 * for the eraser, removes the top-most ink element under the point). Extracted
 * verbatim from `PowerPointViewer.vue`.
 */
export function useInkDrawing(input: UseInkDrawingInput): UseInkDrawingResult {
	const { canEdit, presenting, activeTool, activeSlide, selectedElementIds, ops } = input;

	/** A pen/highlighter/eraser tool is armed (Draw tab) → ink capture is active. */
	const drawingActive = computed(
		() => canEdit() && !presenting.value && activeTool.value !== 'select',
	);

	/** Turn a captured stroke into an `ink` element (no select, keep drawing). */
	function addInkStroke(payload: {
		points: Array<{ x: number; y: number }>;
		color: string;
		width: number;
		tool: string;
	}): void {
		const pts = payload.points;
		if (pts.length < 2) {
			return;
		}
		const isHl = payload.tool === 'highlighter';
		const strokeW = isHl ? payload.width * 3 : payload.width;
		const pad = Math.max(2, strokeW);
		const xs = pts.map((p) => p.x);
		const ys = pts.map((p) => p.y);
		const minX = Math.min(...xs) - pad;
		const minY = Math.min(...ys) - pad;
		const maxX = Math.max(...xs) + pad;
		const maxY = Math.max(...ys) + pad;
		const d = `M ${pts.map((p) => `${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`).join(' L ')}`;
		const el = {
			id: createEditorId('ink'),
			type: 'ink',
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
			inkPaths: [d],
			inkColors: [payload.color],
			inkWidths: [strokeW],
			inkOpacities: [isHl ? 0.4 : 1],
			inkTool: payload.tool,
		} as unknown as PptxElement;
		ops.addElement(el);
		selectedElementIds.value = [];
	}
	/** Eraser: remove the top-most ink element whose box contains the point. */
	function eraseInkAt(point: { x: number; y: number }): void {
		const slide = activeSlide.value;
		if (!slide) {
			return;
		}
		for (let i = slide.elements.length - 1; i >= 0; i--) {
			const el = slide.elements[i];
			if (
				el.type === 'ink' &&
				point.x >= el.x &&
				point.x <= el.x + el.width &&
				point.y >= el.y &&
				point.y <= el.y + el.height
			) {
				ops.removeElement(el.id);
				return;
			}
		}
	}

	return { drawingActive, addInkStroke, eraseInkAt };
}
