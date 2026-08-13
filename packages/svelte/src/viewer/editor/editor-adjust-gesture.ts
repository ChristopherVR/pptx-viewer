import type { PptxElement } from 'pptx-viewer-core';
import type { ShapeAdjustmentDragState, ShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';
import { beginShapeAdjustment, getDraggedShapeAdjustments } from 'pptx-viewer-shared';

/**
 * Pointer driver for PowerPoint's amber shape-adjustment diamond (the handle
 * that opens and closes a round-rect's corner radius).
 *
 * Svelte's canvas had no adjustment handle at ALL: the overlay drew eight
 * resize handles and a rotate knob and stopped, so the one authored parameter
 * `a:avLst` exposes was unreachable in this binding while the other four
 * offered it.
 *
 * The value math is the shared `shape-adjustment` model
 * (`getDraggedShapeAdjustments`); this module owns only the pointer
 * lifecycle (dead zone, window listeners, cancel), mirroring `editor-gestures`.
 * The drag writes `shapeAdjustments[key]` as an ELEMENT PATCH: an adjustment is
 * a geometry parameter, not a resize, so the element's box must not move.
 *
 * @module editor/editor-adjust-gesture
 */

/** Dead zone in screen px before a pointerdown becomes an adjustment drag. */
const ADJUST_DEAD_ZONE_PX = 2;

export interface AdjustGestureDeps {
	/** Stage scale (screen px per element px); the drag delta is un-scaled by it. */
	getScale(): number;
	/** First movement past the dead zone: push history, mark the interaction. */
	onStart(): void;
	/** Live frame: write the new adjustment map onto the element (no history). */
	onPreview(elementId: string, adjustments: Record<string, number>): void;
	/** Gesture finished. `moved` is false for a plain tap (no dead-zone exit). */
	onEnd(moved: boolean): void;
}

export interface AdjustGestureController {
	begin(
		element: PptxElement,
		descriptor: ShapeAdjustmentHandleDescriptor,
		event: PointerEvent,
	): void;
	isActive(): boolean;
	dispose(): void;
}

/**
 * Capture what the shared value math needs, at the moment the drag starts.
 *
 * Delegated to shared rather than hand-built, so the captured SOLVER (this
 * handle's measured px-per-guide-unit scale) and the element's other
 * adjustments travel with the gesture; a hand-built state dropped both.
 */
function dragStateOf(
	element: PptxElement,
	descriptor: ShapeAdjustmentHandleDescriptor,
	event: PointerEvent,
): ShapeAdjustmentDragState {
	return beginShapeAdjustment(element, descriptor, event.clientX, event.clientY);
}

/** `element` with `adjustments` merged over its existing `a:avLst` values. */
export function withShapeAdjustments(
	element: PptxElement,
	adjustments: Record<string, number>,
): PptxElement {
	const existing = 'shapeAdjustments' in element ? element.shapeAdjustments : undefined;
	return { ...element, shapeAdjustments: { ...existing, ...adjustments } } as PptxElement;
}

export function createAdjustGestureController(deps: AdjustGestureDeps): AdjustGestureController {
	let active: (ShapeAdjustmentDragState & { pointerId: number }) | null = null;

	function onPointerMove(event: PointerEvent): void {
		const state = active;
		if (!state || event.pointerId !== state.pointerId) {
			return;
		}
		const screenDeltaX = event.clientX - state.startClientX;
		// BOTH axes: only a round-rect's diamond travels horizontally. An arrow's
		// shaft thickness, a callout's leader line and a pie wedge's sweep all
		// need the vertical component, and feeding 0 pinned them to their start.
		const screenDeltaY = event.clientY - state.startClientY;
		if (!state.moved) {
			if (Math.hypot(screenDeltaX, screenDeltaY) <= ADJUST_DEAD_ZONE_PX) {
				return;
			}
			state.moved = true;
			deps.onStart();
		}
		// `startWidth`/`startHeight` are element px, so the delta must be too.
		const scale = deps.getScale() || 1;
		deps.onPreview(
			state.elementId,
			getDraggedShapeAdjustments(state, screenDeltaX / scale, screenDeltaY / scale),
		);
	}

	function onPointerUp(event: PointerEvent): void {
		const state = active;
		if (!state || event.pointerId !== state.pointerId) {
			return;
		}
		detach();
		active = null;
		deps.onEnd(state.moved);
	}

	function detach(): void {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

	return {
		begin(element, descriptor, event) {
			if (active) {
				return;
			}
			// The overlay sits above the element; without this the same pointerdown
			// would also arm a move gesture on the shape underneath.
			event.preventDefault();
			event.stopPropagation();
			active = { ...dragStateOf(element, descriptor, event), pointerId: event.pointerId };
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', onPointerUp);
			window.addEventListener('pointercancel', onPointerUp);
		},
		isActive() {
			return active !== null;
		},
		dispose() {
			detach();
			active = null;
		},
	};
}
