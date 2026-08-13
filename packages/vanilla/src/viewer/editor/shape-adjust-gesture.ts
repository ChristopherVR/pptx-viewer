import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { ShapeAdjustmentDragState, ShapeAdjustmentHandleDescriptor } from 'pptx-viewer-shared';
import {
	beginShapeAdjustment,
	getDraggedShapeAdjustments,
	getShapeAdjustmentHandleDescriptors,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import {
	findActiveElement,
	getActiveElements,
	replaceActiveElements,
} from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * The shape adjustment (amber diamond) gesture: PowerPoint's `a:avLst` handle,
 * which reshapes a preset instead of resizing its box. Dragging it writes
 * `element.shapeAdjustments[key]`, so the element keeps its geometry and only
 * its corner radius (round-rect) changes.
 *
 * Every number comes from shared (`getShapeAdjustmentHandleDescriptor` for the
 * placement + current value, `getDraggedShapeAdjustmentValue` for the drag);
 * this module owns only the pointer lifecycle and the store writes.
 */

/** Dead zone in screen px before a press becomes an adjustment drag. */
const DRAG_DEAD_ZONE_PX = 2;

export interface ShapeAdjustGestureDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Stage scale (screen px per element px): the drag delta is screen-space. */
	getScale(): number;
}

export interface ShapeAdjustGesture {
	/** Begin from a pointerdown on ONE of the overlay's adjust handles. */
	begin(event: PointerEvent, descriptor: ShapeAdjustmentHandleDescriptor): void;
	isActive(): boolean;
	dispose(): void;
}

/**
 * Every adjustment handle the single selection offers, empty when there is
 * none. PowerPoint shows one amber diamond per `a:avLst` guide and presets
 * routinely have several (`quadArrow` three, `callout3` four); this used to
 * return one, so the rest were unreachable.
 */
export function selectedAdjustmentDescriptors(
	state: ViewerState,
): ShapeAdjustmentHandleDescriptor[] {
	if (!state.editable || state.presenting || state.selectedElementIds.length !== 1) {
		return [];
	}
	const element = state.selectedElementId
		? findActiveElement(state, state.selectedElementId)
		: undefined;
	return element ? getShapeAdjustmentHandleDescriptors(element) : [];
}

export function createShapeAdjustGesture(deps: ShapeAdjustGestureDeps): ShapeAdjustGesture {
	const { store, ops } = deps;
	let drag: ShapeAdjustmentDragState | null = null;

	const writeAdjustment = (adjustments: Record<string, number>): void => {
		if (!drag) {
			return;
		}
		const { elementId } = drag;
		const state = store.get();
		const elements = getActiveElements(state);
		store.set(
			replaceActiveElements(
				state,
				elements.map((element): PptxElement =>
					element.id === elementId && hasShapeProperties(element)
						? { ...element, shapeAdjustments: { ...element.shapeAdjustments, ...adjustments } }
						: element,
				),
			),
		);
	};

	const detach = (): void => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onEnd);
		window.removeEventListener('pointercancel', onEnd);
	};

	function onMove(event: PointerEvent): void {
		if (!drag) {
			return;
		}
		const scale = deps.getScale();
		const divisor = scale > 0 ? scale : 1;
		// The overlay is unscaled screen space, so the pointer delta has to be
		// brought back into element px before shared compares it to the element's
		// own width/height. BOTH axes: only a round-rect's diamond travels
		// horizontally, and feeding 0 for dy pinned every other preset's handle.
		const deltaX = (event.clientX - drag.startClientX) / divisor;
		const deltaY = (event.clientY - drag.startClientY) / divisor;
		if (!drag.moved) {
			if (
				Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) <=
				DRAG_DEAD_ZONE_PX
			) {
				return;
			}
			drag.moved = true;
			ops.pushHistory();
			store.set({ interactionActive: true });
		}
		writeAdjustment(getDraggedShapeAdjustments(drag, deltaX, deltaY));
	}

	function onEnd(): void {
		const moved = drag?.moved ?? false;
		drag = null;
		detach();
		if (moved) {
			store.set({ interactionActive: false });
			ops.commitChange();
		}
	}

	return {
		begin(event, descriptor) {
			const state = store.get();
			const id = state.selectedElementId;
			const element = id ? findActiveElement(state, id) : undefined;
			if (!id || !element || !descriptor || !hasShapeProperties(element)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			// Shared builds the state so the captured SOLVER (this handle's
			// measured px-per-guide-unit scale) and the element's other
			// adjustments travel with the gesture; a hand-built one dropped both.
			drag = beginShapeAdjustment(element, descriptor, event.clientX, event.clientY);
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onEnd);
			window.addEventListener('pointercancel', onEnd);
		},
		isActive: () => drag !== null,
		dispose() {
			drag = null;
			detach();
		},
	};
}
