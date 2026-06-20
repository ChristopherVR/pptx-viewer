import { ref } from 'vue';
import type { Ref } from 'vue';

export interface SheetDismissDrag {
	/** Current downward drag offset in px (0 when not dragging). */
	dragY: Ref<number>;
	/** True while a pointer drag is in progress (suppresses the snap-back transition). */
	dragging: Ref<boolean>;
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
}

/**
 * Drag-to-dismiss logic for mobile bottom sheets. Dragging the grab region down
 * past `threshold` px invokes `onClose`; a shorter drag snaps back.
 *
 * Vue port of the React `useSheetDismissDrag` hook; keeps every Vue mobile
 * sheet (notes / format / comments) consistent with the React viewer.
 */
export function useSheetDismissDrag(onClose: () => void, threshold = 120): SheetDismissDrag {
	const dragY = ref(0);
	const dragging = ref(false);
	let startY: number | null = null;

	function onPointerDown(e: PointerEvent): void {
		startY = e.clientY;
		dragging.value = true;
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (startY === null) {
			return;
		}
		dragY.value = Math.max(0, e.clientY - startY);
	}

	function onPointerUp(e: PointerEvent): void {
		if (startY === null) {
			return;
		}
		const delta = e.clientY - startY;
		startY = null;
		dragging.value = false;
		(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
		if (delta > threshold) {
			onClose();
		}
		dragY.value = 0;
	}

	return { dragY, dragging, onPointerDown, onPointerMove, onPointerUp };
}
