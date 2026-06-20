import type React from 'react';
import { useCallback, useRef, useState } from 'react';

export interface ModalDismissDragHandlers {
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
	onPointerCancel: (e: React.PointerEvent) => void;
}

export interface ModalDismissDrag {
	/** Spread onto the panel element to follow the drag and snap back. */
	panelStyle: React.CSSProperties | undefined;
	/** Spread onto the header / title bar to make the dialog swipe-dismissable. */
	handlers: ModalDismissDragHandlers;
}

/**
 * Swipe-down-to-dismiss for centered modal dialogs. Mirrors the bottom-sheet
 * gesture but tuned for dialogs:
 *  - touch/pen only — a desktop mouse never starts a drag, so click/select on
 *    the header is unaffected;
 *  - drags that begin on an interactive control (the × close button, inputs,
 *    links) are ignored so those keep working;
 *  - dragging the header down past `threshold` px invokes `onClose`.
 */
export function useModalDismissDrag(onClose: () => void, threshold = 120): ModalDismissDrag {
	const [dragY, setDragY] = useState(0);
	const startRef = useRef<number | null>(null);

	const onPointerDown = useCallback((e: React.PointerEvent) => {
		if (e.pointerType === 'mouse') {
			return;
		}
		if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')) {
			return;
		}
		startRef.current = e.clientY;
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
			(e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
			if (delta > threshold) {
				onClose();
			}
			setDragY(0);
		},
		[onClose, threshold],
	);

	return {
		panelStyle:
			dragY > 0
				? { transform: `translateY(${dragY}px)`, transition: 'none' }
				: { transition: 'transform 150ms ease-out' },
		handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
	};
}
