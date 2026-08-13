import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	applyDragDelta,
	canInteractWithElement,
	isTemplateElementId,
	resolveElementInteractivity,
} from 'pptx-viewer-shared';
import type { ElementInteractivity } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';

import { useConnectorReroute } from './connector-reroute-store';
import { applyGeometryLocks, geometryOf } from './element-lock-guards';
import type { GeometryBox } from './element-lock-guards';
import { useElementStorePatch } from './element-store-patch';
import { snapBox } from './snap';
import { computeSnapToShape } from './snap-shape';
import type { TemplateElementMap } from './template-editing';
import { useSnapGuides } from './useSnapGuides';

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
/** The drag/transform/adjust surface, inferred so it cannot drift from the impl. */
export type UseElementDragResult = ReturnType<typeof useElementDrag>;

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

	const snap = useSnapGuides(canvasSize);
	const { snapToShape, snapToGrid, snapLines, guides } = snap;

	const stores = { slides, activeSlideIndex, templateElementsBySlideId };
	/** Live element write, routed to the slide or the template store by id. */
	const patchElementInStore = useElementStorePatch(stores);
	/** Recompute the connectors glued to shapes that just finished moving. */
	const rerouteConnectorsFor = useConnectorReroute(stores);

	// ── Element drag-to-move + tap-to-edit (driven from the element) ──────
	interface ElementDragState {
		id: string;
		startClientX: number;
		startClientY: number;
		startBox: GeometryBox;
		moved: boolean;
		wasSelected: boolean;
		/** False when `a:spLocks/@noMove` (or `@noSelect`) pins the element. */
		movable: boolean;
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
			startBox: geometryOf(el),
			moved: false,
			wasSelected,
			// A pinned shape still ARMS the gesture, because releasing without a
			// drag is what opens the inline editor; it just never travels.
			movable: canInteractWithElement(el, 'move'),
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
			// No geometry will change for a pinned shape, so taking a history
			// snapshot would leave an undo step that undoes nothing.
			if (drag.movable) {
				pushHistory();
			}
		}
		if (!drag.moved || !drag.movable) {
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
		// The shape has landed: every connector glued to it has to catch up. Vue
		// never called the shared reroute, so a connector stayed put while the box
		// it points at walked off.
		if (drag?.moved && drag.movable) {
			rerouteConnectorsFor(new Set([drag.id]));
		}
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

	// Locks + start geometry resolved once at gesture start, so a locked axis can
	// be folded back to where it began on every frame. Comparing against the LIVE
	// element instead would only ever block the first frame, since the live
	// element is patched on every pointermove.
	let transformLocks: ElementInteractivity | null = null;
	let transformStartBox: GeometryBox | null = null;

	/** The payload with any axis the element's `a:spLocks` forbid folded back. */
	function guardTransform(payload: TransformPayload): TransformPayload {
		return transformLocks && transformStartBox
			? applyGeometryLocks(transformLocks, transformStartBox, payload)
			: payload;
	}

	// One history entry per gesture: snapshot on start, live-patch (no history)
	// during the drag and on commit.
	function onTransformStart(payload?: { id: string }): void {
		const el = payload ? findActiveElement(payload.id) : undefined;
		transformLocks = el ? resolveElementInteractivity(el) : null;
		transformStartBox = el ? geometryOf(el) : null;
		pushHistory();
	}
	function onTransform(payload: TransformPayload): void {
		patchActiveElementGeometry(guardTransform(payload));
	}
	function onTransformEnd(payload: TransformPayload): void {
		patchActiveElementGeometry(guardTransform(payload));
		// Resizing or rotating a shape moves its connection sites just as a drag
		// does, so the connectors glued to it are rerouted from here too.
		rerouteConnectorsFor(new Set([payload.id]));
	}

	/** Patch an element's `a:avLst` adjustments WITHOUT a history entry. */
	function patchActiveElementAdjustment(id: string, adjustments: Record<string, number>): void {
		patchElementInStore(
			id,
			(el) =>
				({
					...el,
					shapeAdjustments: {
						...(el as { shapeAdjustments?: Record<string, number> }).shapeAdjustments,
						...adjustments,
					},
				}) as PptxElement,
		);
	}
	function onAdjustStart(): void {
		pushHistory();
	}

	/**
	 * Commit a connector endpoint that was dragged onto a connection site (or
	 * off one). Shared decided the geometry AND the `a:stCxn`/`a:endCxn`
	 * bindings; this only writes the element and takes the history entry.
	 */
	function onConnectorEndpoint(payload: { id: string; element: PptxElement }): void {
		pushHistory();
		patchElementInStore(payload.id, () => payload.element);
	}
	function onAdjust(payload: { id: string; adjustments: Record<string, number> }): void {
		patchActiveElementAdjustment(payload.id, payload.adjustments);
	}
	function onAdjustEnd(payload: { id: string; adjustments: Record<string, number> }): void {
		patchActiveElementAdjustment(payload.id, payload.adjustments);
	}

	return {
		...snap,
		startElementDrag,
		onTransformStart,
		onTransform,
		onTransformEnd,
		onAdjustStart,
		onAdjust,
		onAdjustEnd,
		onConnectorEndpoint,
	};
}
