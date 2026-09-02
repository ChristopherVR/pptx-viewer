/**
 * selection-gesture.ts: the pointer wiring behind `SelectionOverlay.vue`.
 *
 * Move, resize and rotate are driven by the shared `createGestureController`
 * (`pptx-viewer-shared`'s `editor-gestures` module): it owns the dead zone,
 * the `window` pointer listener lifecycle, and the drag/resize/rotate maths
 * (via `element-interaction` and `editor-geometry`, including the
 * shift-to-lock-aspect ratio on a corner resize). This module owns only the
 * DOM event consumption (`preventDefault`/`stopPropagation`/pointer capture,
 * which the shared controller deliberately leaves to the caller) and the
 * Vue-side mapping from a gesture end back onto "commit" vs. "tap the
 * already-selected element to enter inline edit".
 *
 * Shape adjustment (`a:avLst` amber diamonds) is NOT part of the shared
 * gesture controller (its drag state is a solver run, not a geometry
 * transform), so it keeps its own small pointer state machine here, mirroring
 * the one `createGestureController` runs internally.
 *
 * Extracted from the SFC, which had grown past the repo's 300-LOC budget with
 * the state machine and the placement maths inline.
 *
 * @module viewer/composables/selection-gesture
 */
import type { PptxElement } from 'pptx-viewer-core';
import type {
	GestureController,
	GestureKind,
	InteractionBox,
	ResizeHandleId,
} from 'pptx-viewer-shared';
import { createGestureController } from 'pptx-viewer-shared';
import type { Ref } from 'vue';

import type {
	AdjustPayload,
	SelectedBox,
	TransformPayload,
} from '../components/selection-overlay-geometry';
import { payloadFromBox, startBoxOf } from '../components/selection-overlay-geometry';
import { beginShapeAdjustment, getDraggedShapeAdjustments } from './shape-adjustment';
import type { ShapeAdjustmentDragState, ShapeAdjustmentHandleDescriptor } from './shape-adjustment';

/** Movement (in screen px) below which a press is still a tap, not a drag. */
const DEAD_ZONE_PX = 2;

/** The `a:avLst` adjustment gesture's own (non-shared) pointer state. */
interface AdjustGesture {
	id: string;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	moved: boolean;
	state: ShapeAdjustmentDragState;
	lastValues: Record<string, number>;
}

/** What the overlay must supply for the gesture to run. */
export interface SelectionGestureContext {
	/** Current stage zoom; raw pointer deltas are screen px and divide by it. */
	zoom: () => number;
	/** The live box for an id, or undefined once it stops being selected. */
	boxForId: (id: string) => SelectedBox | undefined;
	/** The element behind an id, for the adjustment gesture's drag state. */
	elementForId: (id: string) => PptxElement | undefined;
	/** The overlay root, for mapping client coords into element space. */
	rootEl: Ref<HTMLElement | null>;
	onTransformStart: (payload: { id: string }) => void;
	onTransform: (payload: TransformPayload) => void;
	onTransformEnd: (payload: TransformPayload) => void;
	onAdjustStart: (payload: { id: string }) => void;
	onAdjust: (payload: AdjustPayload) => void;
	onAdjustEnd: (payload: AdjustPayload) => void;
	/** A tap (no drag) on an already-selected element: enter inline edit. */
	onRequestEdit: (payload: { id: string }) => void;
}

/** The handlers `SelectionOverlay.vue` binds to its handles. */
export interface SelectionGesture {
	beginGesture: (
		kind: GestureKind,
		id: string,
		event: PointerEvent,
		handle?: ResizeHandleId,
	) => void;
	beginAdjust: (
		id: string,
		descriptor: ShapeAdjustmentHandleDescriptor,
		event: PointerEvent,
	) => void;
}

export function useSelectionGesture(context: SelectionGestureContext): SelectionGesture {
	// Captured at `beginGesture` time because `onEnd` below is not told which
	// kind just finished, and because the start box must be a frozen snapshot
	// (the live box moves as `onTransform` patches land during the gesture).
	let activeKind: GestureKind | null = null;
	let activeStartBox: InteractionBox | null = null;

	// The move/resize/rotate gesture never snaps to a sibling shape or the grid
	// here: grid snap is applied downstream (see `useElementDrag.patchActiveElementGeometry`)
	// and snap-to-shape has never applied to an overlay-driven gesture (its
	// move body has `pointer-events: none`; only the handles are reachable).
	const controller: GestureController = createGestureController({
		getScale: () => context.zoom() || 1,
		getElementBox: (id) => {
			const box = context.boxForId(id);
			return box ? startBoxOf(box) : undefined;
		},
		getSiblings: () => [],
		getSnapToShape: () => false,
		getSnapToGrid: () => false,
		getStageOrigin: () => {
			const rect = context.rootEl.value?.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		onStart: (id) => {
			context.onTransformStart({ id });
		},
		onPreview: (transform) => {
			context.onTransform(transform);
		},
		onEnd: (transform, moved, id) => {
			if (!moved) {
				// A tap on the already-selected element (no drag) via the move body:
				// enter inline edit, mirroring React's "click a selected element again
				// to edit". A tap on a resize/rotate handle instead commits a harmless
				// no-op transform at the start box, exactly as it did before this
				// gesture ran through the shared controller.
				if (activeKind === 'move') {
					context.onRequestEdit({ id });
				} else if (activeStartBox) {
					context.onTransformEnd(payloadFromBox(id, activeStartBox));
				}
			} else if (transform) {
				context.onTransformEnd(transform);
			}
			activeKind = null;
			activeStartBox = null;
		},
	});

	function beginGesture(
		kind: GestureKind,
		id: string,
		event: PointerEvent,
		handle?: ResizeHandleId,
	): void {
		const box = context.boxForId(id);
		if (!box) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		activeKind = kind;
		activeStartBox = startBoxOf(box);
		(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
		controller.begin(kind, id, event, handle);
	}

	let adjustGesture: AdjustGesture | null = null;

	/**
	 * Begin an `a:avLst` adjustment gesture on ONE amber diamond.
	 *
	 * The descriptor is passed in rather than looked up, because a preset has
	 * several handles and the gesture must act on the one the user grabbed.
	 */
	function beginAdjust(
		id: string,
		descriptor: ShapeAdjustmentHandleDescriptor,
		event: PointerEvent,
	): void {
		const box = context.boxForId(id);
		const element = context.elementForId(id);
		if (!box || !element) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);

		adjustGesture = {
			id,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			moved: false,
			state: beginShapeAdjustment(element, descriptor, event.clientX, event.clientY),
			lastValues: { [descriptor.key]: descriptor.value },
		};
		window.addEventListener('pointermove', onAdjustPointerMove);
		window.addEventListener('pointerup', onAdjustPointerUp);
		window.addEventListener('pointercancel', onAdjustPointerUp);
		context.onAdjustStart({ id });
	}

	function onAdjustPointerMove(event: PointerEvent): void {
		const g = adjustGesture;
		if (!g || event.pointerId !== g.pointerId) {
			return;
		}
		const dxScreen = event.clientX - g.startClientX;
		const dyScreen = event.clientY - g.startClientY;
		if (!g.moved && (Math.abs(dxScreen) > DEAD_ZONE_PX || Math.abs(dyScreen) > DEAD_ZONE_PX)) {
			g.moved = true;
		}
		if (!g.moved) {
			return;
		}
		const scale = context.zoom() || 1;
		// BOTH axes, in element px. The old branch fabricated a drag state with a
		// hardcoded `key: 'adj'` and `shapeType: 'roundrect'` and passed dx only,
		// so every preset other than a round-rect was adjusted as if it were one.
		const adjustments = getDraggedShapeAdjustments(g.state, dxScreen / scale, dyScreen / scale);
		g.lastValues = adjustments;
		context.onAdjust({ id: g.id, adjustments });
	}

	function onAdjustPointerUp(event: PointerEvent): void {
		const g = adjustGesture;
		if (!g || event.pointerId !== g.pointerId) {
			return;
		}
		detachAdjust();
		adjustGesture = null;
		context.onAdjustEnd({ id: g.id, adjustments: g.lastValues });
	}

	function detachAdjust(): void {
		window.removeEventListener('pointermove', onAdjustPointerMove);
		window.removeEventListener('pointerup', onAdjustPointerUp);
		window.removeEventListener('pointercancel', onAdjustPointerUp);
	}

	return { beginGesture, beginAdjust };
}
