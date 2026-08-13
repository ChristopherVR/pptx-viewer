import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { ShapeAdjustmentDragState } from 'pptx-viewer-shared';
import {
	getDraggedShapeAdjustmentValue,
	getShapeAdjustmentHandleDescriptor,
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
	/** Begin from a pointerdown on the overlay's adjust handle. */
	begin(event: PointerEvent): void;
	isActive(): boolean;
	dispose(): void;
}

/** The descriptor for the single selected element, or null when there is none. */
export function selectedAdjustmentDescriptor(
	state: ViewerState,
): ReturnType<typeof getShapeAdjustmentHandleDescriptor> {
	if (!state.editable || state.presenting || state.selectedElementIds.length !== 1) {
		return null;
	}
	const element = state.selectedElementId
		? findActiveElement(state, state.selectedElementId)
		: undefined;
	return element ? getShapeAdjustmentHandleDescriptor(element) : null;
}

export function createShapeAdjustGesture(deps: ShapeAdjustGestureDeps): ShapeAdjustGesture {
	const { store, ops } = deps;
	let drag: ShapeAdjustmentDragState | null = null;

	const writeAdjustment = (value: number): void => {
		if (!drag) {
			return;
		}
		const { elementId, key } = drag;
		const state = store.get();
		const elements = getActiveElements(state);
		store.set(
			replaceActiveElements(
				state,
				elements.map((element): PptxElement =>
					element.id === elementId && hasShapeProperties(element)
						? { ...element, shapeAdjustments: { ...element.shapeAdjustments, [key]: value } }
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
		// The overlay is unscaled screen space, so the pointer delta has to be
		// brought back into element px before shared compares it to the element's
		// own width/height.
		const deltaX = (event.clientX - drag.startClientX) / (scale > 0 ? scale : 1);
		if (!drag.moved) {
			if (Math.abs(event.clientX - drag.startClientX) <= DRAG_DEAD_ZONE_PX) {
				return;
			}
			drag.moved = true;
			ops.pushHistory();
			store.set({ interactionActive: true });
		}
		writeAdjustment(getDraggedShapeAdjustmentValue(drag, deltaX));
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
		begin(event) {
			const state = store.get();
			const id = state.selectedElementId;
			const element = id ? findActiveElement(state, id) : undefined;
			const descriptor = selectedAdjustmentDescriptor(state);
			if (!id || !element || !descriptor || !hasShapeProperties(element)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			drag = {
				elementId: id,
				key: descriptor.key,
				shapeType: String(element.shapeType ?? '').toLowerCase(),
				startClientX: event.clientX,
				startClientY: event.clientY,
				startAdjustment: descriptor.value,
				startWidth: element.width,
				startHeight: element.height,
				moved: false,
			};
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
