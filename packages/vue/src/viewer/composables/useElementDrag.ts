import { createEditorId } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { applyDragDelta, isTemplateElementId } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { createGuide, moveGuide, removeGuide } from './guides';
import type { Guide } from './guides';
import { snapBox } from './snap';
import { computeSnapToShape } from './snap-shape';
import { setTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';

/** Geometry patch emitted by the selection overlay during a drag/resize/rotate. */
export interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

export interface UseElementDragInput {
	findActiveElement: (id: string) => PptxElement | undefined;
	pushHistory: () => void;
	effectiveZoom: ComputedRef<number>;
	activeTemplateElements: ComputedRef<PptxElement[]>;
	activeSlide: ComputedRef<PptxSlide | undefined>;
	activeSlideIndex: Ref<number>;
	slides: Ref<PptxSlide[]>;
	templateElementsBySlideId: Ref<TemplateElementMap>;
	canvasSize: Ref<{ width: number; height: number }>;
	enterInlineEdit: (id: string) => void;
}

/** Grid spacing in px (matches React's GRID_SIZE). */
const GRID_SIZE = 8;

/**
 * useElementDrag: canvas pointer-drag-to-move, resize/rotate transform, shape
 * adjustment, plus the View-tab snap + alignment-guide state that those gestures
 * consume. One history entry is snapshotted at gesture start; live patches during
 * the gesture bypass history. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useElementDrag(input: UseElementDragInput) {
	const {
		findActiveElement,
		pushHistory,
		effectiveZoom,
		activeTemplateElements,
		activeSlide,
		activeSlideIndex,
		slides,
		templateElementsBySlideId,
		canvasSize,
		enterInlineEdit,
	} = input;

	/** View ▸ Snap to Shape: snap dragged elements to other elements' edges/centres. */
	const snapToShape = ref(false);
	/** View ▸ Snap to Grid: round position + size to the grid during drag/resize. */
	const snapToGrid = ref(false);
	/** Transient red snap-alignment lines shown during a snap-to-shape drag. */
	const snapLines = ref<Array<{ axis: 'x' | 'y'; position: number }>>([]);
	/** View ▸ H/V Guides: draggable alignment guides (authored slide px). */
	const guides = ref<Guide[]>([]);

	/**
	 * Add a horizontal/vertical guide. Centred by default (View ▸ H/V Guide
	 * buttons); `position` is supplied when the guide was dragged off a ruler
	 * strip, where the drop point has already been resolved by the shared
	 * `rulerDragToGuidePosition`.
	 */
	function addGuide(axis: 'h' | 'v', position?: number): void {
		const guide = createGuide(createEditorId('guide'), axis, canvasSize.value);
		guides.value = [...guides.value, position === undefined ? guide : { ...guide, position }];
	}
	/** Drag a guide to a new (clamped) position. */
	function onMoveGuide(payload: { id: string; position: number }): void {
		guides.value = moveGuide(guides.value, payload.id, payload.position, canvasSize.value);
	}
	/** Double-click removes a guide. */
	function onRemoveGuide(id: string): void {
		guides.value = removeGuide(guides.value, id);
	}

	// ── Element drag-to-move + tap-to-edit (driven from the element) ──────
	interface ElementDragState {
		id: string;
		startClientX: number;
		startClientY: number;
		startBox: { x: number; y: number; width: number; height: number; rotation: number };
		moved: boolean;
		wasSelected: boolean;
	}
	let elementDrag: ElementDragState | null = null;
	function startElementDrag(id: string, event: PointerEvent, wasSelected: boolean): void {
		const el = findActiveElement(id);
		if (!el) {
			return;
		}
		elementDrag = {
			id,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startBox: {
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
				rotation: el.rotation ?? 0,
			},
			moved: false,
			wasSelected,
		};
		window.addEventListener('pointermove', onElementDragMove);
		window.addEventListener('pointerup', onElementDragUp);
		window.addEventListener('pointercancel', onElementDragUp);
	}
	function onElementDragMove(event: PointerEvent): void {
		const drag = elementDrag;
		if (!drag) {
			return;
		}
		const dx = event.clientX - drag.startClientX;
		const dy = event.clientY - drag.startClientY;
		if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
			drag.moved = true;
			pushHistory();
		}
		if (!drag.moved) {
			return;
		}
		const box = applyDragDelta(drag.startBox, dx, dy, effectiveZoom.value);
		let nextX = box.x;
		let nextY = box.y;
		// Snap to other shapes' edges/centres (+ user guides), with visual snap lines.
		if (snapToShape.value && !box.rotation) {
			// Snap against siblings in the same store as the dragged element (slide
			// content, or the template layer when dragging a template element).
			const dragSiblings = isTemplateElementId(drag.id)
				? activeTemplateElements.value
				: (activeSlide.value?.elements ?? []);
			const siblings = dragSiblings.map((el) => ({
				id: el.id,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
			}));
			const result = computeSnapToShape(
				box.x,
				box.y,
				box.width,
				box.height,
				siblings,
				new Set([drag.id]),
				guides.value,
			);
			nextX = result.x;
			nextY = result.y;
			snapLines.value = result.lines.map((line) => ({
				axis: line.axis === 'v' ? 'x' : 'y',
				position: line.position,
			}));
		} else if (snapLines.value.length > 0) {
			snapLines.value = [];
		}
		patchActiveElementGeometry({
			id: drag.id,
			x: nextX,
			y: nextY,
			width: box.width,
			height: box.height,
			rotation: box.rotation ?? 0,
		});
	}
	function onElementDragUp(): void {
		const drag = elementDrag;
		elementDrag = null;
		if (snapLines.value.length > 0) {
			snapLines.value = [];
		}
		window.removeEventListener('pointermove', onElementDragMove);
		window.removeEventListener('pointerup', onElementDragUp);
		window.removeEventListener('pointercancel', onElementDragUp);
		// A tap (no drag) on an already-selected element enters inline edit.
		if (drag && !drag.moved && drag.wasSelected) {
			enterInlineEdit(drag.id);
		}
	}

	/**
	 * Map one element in its current store (slide content, or the active slide's
	 * template layer for `master-` / `layout-` ids) WITHOUT a history entry. Used by
	 * the live drag/resize/adjust patches (history is snapshotted at gesture start).
	 */
	function patchElementInStore(id: string, mapElement: (el: PptxElement) => PptxElement): void {
		const index = activeSlideIndex.value;
		const slide = slides.value[index];
		if (!slide) {
			return;
		}
		if (isTemplateElementId(id)) {
			const current = templateElementsBySlideId.value[slide.id];
			if (!current) {
				return;
			}
			const next = current.map((el) => (el.id === id ? mapElement(el) : el));
			templateElementsBySlideId.value = setTemplateElements(
				templateElementsBySlideId.value,
				slide.id,
				next,
			);
			return;
		}
		const nextElements = slide.elements.map((el) => (el.id === id ? mapElement(el) : el));
		const nextSlides = slides.value.slice();
		nextSlides[index] = { ...slide, elements: nextElements };
		slides.value = nextSlides;
	}

	/** Patch one element's geometry in its store WITHOUT a history entry. */
	function patchActiveElementGeometry(payload: TransformPayload): void {
		// Snap-to-grid (View tab): round position + size to the grid. Skipped while
		// rotating (rounding a rotated box's x/y fights the rotation).
		const useSnap = snapToGrid.value && !payload.rotation;
		const { x, y, width, height } = useSnap
			? snapBox(payload, GRID_SIZE)
			: { x: payload.x, y: payload.y, width: payload.width, height: payload.height };
		patchElementInStore(payload.id, (el) => ({
			...el,
			x,
			y,
			width,
			height,
			rotation: payload.rotation,
		}));
	}

	// One history entry per gesture: snapshot on start, live-patch (no history)
	// during the drag and on commit.
	function onTransformStart(): void {
		pushHistory();
	}
	function onTransform(payload: TransformPayload): void {
		patchActiveElementGeometry(payload);
	}
	function onTransformEnd(payload: TransformPayload): void {
		patchActiveElementGeometry(payload);
	}

	/** Patch an element's round-rect corner-radius adjustment WITHOUT a history entry. */
	function patchActiveElementAdjustment(id: string, value: number): void {
		patchElementInStore(
			id,
			(el) =>
				({
					...el,
					shapeAdjustments: {
						...(el as { shapeAdjustments?: Record<string, number> }).shapeAdjustments,
						adj: value,
					},
				}) as PptxElement,
		);
	}
	function onAdjustStart(): void {
		pushHistory();
	}
	function onAdjust(payload: { id: string; value: number }): void {
		patchActiveElementAdjustment(payload.id, payload.value);
	}
	function onAdjustEnd(payload: { id: string; value: number }): void {
		patchActiveElementAdjustment(payload.id, payload.value);
	}

	return {
		snapToShape,
		snapToGrid,
		snapLines,
		guides,
		addGuide,
		onMoveGuide,
		onRemoveGuide,
		startElementDrag,
		onTransformStart,
		onTransform,
		onTransformEnd,
		onAdjustStart,
		onAdjust,
		onAdjustEnd,
	};
}
