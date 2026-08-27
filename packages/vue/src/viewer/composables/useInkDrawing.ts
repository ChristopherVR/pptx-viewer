import type { PptxSlide } from 'pptx-viewer-core';
import type { InkPoint } from 'pptx-viewer-shared';
import { strokeToInkElement } from 'pptx-viewer-shared';
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
		points: InkPoint[];
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

	/**
	 * Turn a captured stroke into an `ink` element (no select, keep drawing),
	 * via the shared `strokeToInkElement` decision function: it computes the
	 * bounding box/path and, when the captured points carry genuine pointer
	 * pressure variation, authors the `inkPointPressures` channel that drives
	 * variable-width rendering identically to React's Draw tool.
	 */
	function addInkStroke(payload: {
		points: InkPoint[];
		color: string;
		width: number;
		tool: string;
	}): void {
		const isHl = payload.tool === 'highlighter';
		const strokeW = isHl ? payload.width * 3 : payload.width;
		const ink = strokeToInkElement({
			points: payload.points,
			color: payload.color,
			width: strokeW,
			tool: isHl ? 'highlighter' : 'pen',
		});
		if (!ink) {
			return;
		}
		ops.addElement(ink);
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
