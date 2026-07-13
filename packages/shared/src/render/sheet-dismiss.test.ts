import { describe, expect, it, vi } from 'vitest';

import { createSheetDismissGesture } from './sheet-dismiss';

const event = (clientY: number) => ({ clientY, pointerId: 1 });

describe('createSheetDismissGesture', () => {
	it('dismisses only after a downward drag beyond the threshold', () => {
		const dismiss = vi.fn();
		const offsets: number[] = [];
		const gesture = createSheetDismissGesture((offset) => offsets.push(offset), dismiss, 100);
		gesture.pointerDown(event(20));
		gesture.pointerMove(event(130));
		gesture.pointerUp(event(130));
		expect(offsets).toStrictEqual([0, 110, 0]);
		expect(dismiss).toHaveBeenCalledOnce();
	});

	it('snaps back after a short drag or cancellation', () => {
		const dismiss = vi.fn();
		const gesture = createSheetDismissGesture(() => {}, dismiss, 100);
		gesture.pointerDown(event(20));
		gesture.pointerUp(event(80));
		gesture.pointerDown(event(20));
		gesture.cancel(event(200));
		expect(dismiss).not.toHaveBeenCalled();
	});
});
