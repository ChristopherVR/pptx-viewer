/**
 * selection-gesture.ts: the pointer state machine behind `SelectionOverlay.vue`.
 *
 * Move, resize, rotate and shape-adjust are one gesture with four modes: they
 * share a dead zone, a pointer-capture lifecycle and a commit-on-release rule,
 * and splitting them into four handlers is how the "a tap that never moved
 * should open the inline editor" case gets lost. The maths itself is the
 * shared `element-interaction` engine; this owns only the state around it.
 *
 * Extracted from the SFC, which had grown past the repo's 300-LOC budget with
 * the state machine and the placement maths inline.
 *
 * @module viewer/composables/selection-gesture
 */
import type { InteractionBox, ResizeHandleId } from 'pptx-viewer-shared';
import {
	applyDragDelta,
	applyResize,
	boxCenter,
	computeRotation,
	snapAngle,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

import type {
	AdjustPayload,
	SelectedBox,
	TransformPayload,
} from '../components/selection-overlay-geometry';
import { payloadFromBox, startBoxOf } from '../components/selection-overlay-geometry';
import { getDraggedShapeAdjustmentValue } from './shape-adjustment';
import type { ShapeAdjustmentHandleDescriptor } from './shape-adjustment';

/** Which of the four gestures is running. */
export type GestureKind = 'move' | 'resize' | 'rotate' | 'adjust';

/** Movement (in screen px) below which a press is still a tap, not a drag. */
const DEAD_ZONE_PX = 2;

interface Gesture {
	kind: GestureKind;
	id: string;
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startBox: InteractionBox;
	handle?: ResizeHandleId;
	/** Whether the gesture has moved past the dead zone. */
	moved: boolean;
	/** Shift held: used for rotation snap. */
	shift: boolean;
	last: TransformPayload;
	/** Start state for an `adjust` gesture (round-rect corner radius). */
	adjust?: { startAdjustment: number; lastValue: number };
}

/** What the overlay must supply for the gesture to run. */
export interface SelectionGestureContext {
	/** Current stage zoom; raw pointer deltas are screen px and divide by it. */
	zoom: () => number;
	/** The live box for an id, or undefined once it stops being selected. */
	boxForId: (id: string) => SelectedBox | undefined;
	/** The shape-adjustment descriptor for an id, or null. */
	adjustDescriptorFor: (id: string) => ShapeAdjustmentHandleDescriptor | null;
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
	beginAdjust: (id: string, event: PointerEvent) => void;
}

export function useSelectionGesture(context: SelectionGestureContext): SelectionGesture {
	const gesture = ref<Gesture | null>(null);

	/**
	 * Convert a client (screen) point into element-space coordinates, accounting
	 * for the overlay's on-screen position and the canvas zoom. Only rotation
	 * needs this; move and resize work in raw deltas.
	 */
	function clientToElement(clientX: number, clientY: number): { x: number; y: number } {
		const scale = context.zoom() || 1;
		const rect = context.rootEl.value?.getBoundingClientRect();
		return {
			x: (clientX - (rect?.left ?? 0)) / scale,
			y: (clientY - (rect?.top ?? 0)) / scale,
		};
	}

	function attach(event: PointerEvent): void {
		const target = event.currentTarget as HTMLElement | null;
		target?.setPointerCapture?.(event.pointerId);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
	}

	function detach(): void {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

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

		const startBox = startBoxOf(box);
		gesture.value = {
			kind,
			id,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startBox,
			handle,
			moved: false,
			shift: event.shiftKey,
			last: payloadFromBox(id, startBox),
		};

		attach(event);
		context.onTransformStart({ id });
	}

	/** Begin a round-rect corner-radius adjustment gesture (the amber diamond). */
	function beginAdjust(id: string, event: PointerEvent): void {
		const box = context.boxForId(id);
		const descriptor = context.adjustDescriptorFor(id);
		if (!box || !descriptor) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();

		const startBox = startBoxOf(box);
		gesture.value = {
			kind: 'adjust',
			id,
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startBox,
			moved: false,
			shift: false,
			last: payloadFromBox(id, startBox),
			adjust: { startAdjustment: descriptor.value, lastValue: descriptor.value },
		};

		attach(event);
		context.onAdjustStart({ id });
	}

	/** The adjustment branch: emits a value, not a geometry transform. */
	function moveAdjust(g: Gesture, dxScreen: number): void {
		if (!g.adjust) {
			return;
		}
		const value = getDraggedShapeAdjustmentValue(
			{
				elementId: g.id,
				key: 'adj',
				shapeType: 'roundrect',
				startClientX: g.startClientX,
				startClientY: g.startClientY,
				startAdjustment: g.adjust.startAdjustment,
				startWidth: g.startBox.width,
				startHeight: g.startBox.height,
				moved: g.moved,
			},
			dxScreen / (context.zoom() || 1),
		);
		g.adjust.lastValue = value;
		context.onAdjust({ id: g.id, value });
	}

	function nextTransform(g: Gesture, event: PointerEvent): TransformPayload {
		const dxScreen = event.clientX - g.startClientX;
		const dyScreen = event.clientY - g.startClientY;
		const zoom = context.zoom();
		if (g.kind === 'move') {
			return payloadFromBox(g.id, applyDragDelta(g.startBox, dxScreen, dyScreen, zoom));
		}
		if (g.kind === 'resize' && g.handle) {
			return payloadFromBox(g.id, applyResize(g.startBox, g.handle, dxScreen, dyScreen, zoom));
		}
		const center = boxCenter(g.startBox);
		const pointer = clientToElement(event.clientX, event.clientY);
		const angle = computeRotation(center, pointer);
		return {
			...payloadFromBox(g.id, g.startBox),
			rotation: event.shiftKey ? snapAngle(angle) : angle,
		};
	}

	function onPointerMove(event: PointerEvent): void {
		const g = gesture.value;
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

		if (g.kind === 'adjust') {
			moveAdjust(g, dxScreen);
			return;
		}

		const next = nextTransform(g, event);
		g.last = next;
		context.onTransform(next);
	}

	function onPointerUp(event: PointerEvent): void {
		const g = gesture.value;
		if (!g || event.pointerId !== g.pointerId) {
			return;
		}
		detach();
		if (g.kind === 'adjust' && g.adjust) {
			context.onAdjustEnd({ id: g.id, value: g.adjust.lastValue });
		} else if (g.kind === 'move' && !g.moved) {
			// A tap on the already-selected element (no drag): enter inline edit,
			// mirroring React's "click a selected element again to edit".
			context.onRequestEdit({ id: g.id });
		} else {
			// Final commit. If the gesture never moved, `last` is the start box,
			// a harmless no-op commit (consumers can short-circuit identical ones).
			context.onTransformEnd(g.last);
		}
		gesture.value = null;
	}

	return { beginGesture, beginAdjust };
}
