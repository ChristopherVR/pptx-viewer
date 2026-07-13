export interface SheetPointerEventLike {
	clientY: number;
	pointerId: number;
	currentTarget?: {
		setPointerCapture?(pointerId: number): void;
		releasePointerCapture?(pointerId: number): void;
	};
}

export interface SheetDismissGesture {
	pointerDown(event: SheetPointerEventLike): void;
	pointerMove(event: SheetPointerEventLike): void;
	pointerUp(event: SheetPointerEventLike): void;
	cancel(event: SheetPointerEventLike): void;
}

/** Framework-neutral downward drag recognizer for mobile bottom sheets. */
export function createSheetDismissGesture(
	onOffset: (offset: number, dragging: boolean) => void,
	onDismiss: () => void,
	threshold = 120,
): SheetDismissGesture {
	let startY: number | null = null;

	const finish = (event: SheetPointerEventLike, allowDismiss: boolean): void => {
		if (startY === null) {
			return;
		}
		const delta = Math.max(0, event.clientY - startY);
		startY = null;
		event.currentTarget?.releasePointerCapture?.(event.pointerId);
		onOffset(0, false);
		if (allowDismiss && delta > threshold) {
			onDismiss();
		}
	};

	return {
		pointerDown(event) {
			startY = event.clientY;
			event.currentTarget?.setPointerCapture?.(event.pointerId);
			onOffset(0, true);
		},
		pointerMove(event) {
			if (startY !== null) {
				onOffset(Math.max(0, event.clientY - startY), true);
			}
		},
		pointerUp(event) {
			finish(event, true);
		},
		cancel(event) {
			finish(event, false);
		},
	};
}
