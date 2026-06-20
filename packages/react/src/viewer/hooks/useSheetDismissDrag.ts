import type React from 'react';
import { useCallback, useRef, useState } from 'react';

export interface SheetDismissDragHandlers {
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
	onPointerCancel: (e: React.PointerEvent) => void;
}

export interface SheetDismissDrag {
	/** Current downward drag offset in px (0 when not dragging). */
	dragY: number;
	/** True while a pointer drag is in progress. */
	dragging: boolean;
	/** Spread onto the drag handle / header to make a bottom sheet swipe-dismissable. */
	handlers: SheetDismissDragHandlers;
}

/**
 * Shared drag-to-dismiss logic for mobile bottom sheets. Dragging the grab
 * region down past `threshold` px invokes `onClose`; anything less snaps back.
 *
 * Centralising this keeps every sheet (menu, slides, inspector/format,
 * comments) consistent: previously only the `MobileSheet`-based sheets could
 * be swiped closed while the inspector's handle was purely decorative.
 */
export function useSheetDismissDrag(onClose: () => void, threshold = 120): SheetDismissDrag {
	const [dragY, setDragY] = useState(0);
	const [dragging, setDragging] = useState(false);
	const startRef = useRef<number | null>(null);

	const onPointerDown = useCallback((e: React.PointerEvent) => {
		startRef.current = e.clientY;
		setDragging(true);
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
	}, []);

	const onPointerMove = useCallback((e: React.PointerEvent) => {
		if (startRef.current === null) {
			return;
		}
		setDragY(Math.max(0, e.clientY - startRef.current));
	}, []);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (startRef.current === null) {
				return;
			}
			const delta = e.clientY - startRef.current;
			startRef.current = null;
			setDragging(false);
			(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
			if (delta > threshold) {
				onClose();
			}
			setDragY(0);
		},
		[onClose, threshold],
	);

	return {
		dragY,
		dragging,
		handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
	};
}
