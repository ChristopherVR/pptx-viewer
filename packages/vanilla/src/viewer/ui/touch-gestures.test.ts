import { describe, expect, it, vi } from 'vitest';

import { attachTouchGestures } from './touch-gestures';

interface Point {
	clientX: number;
	clientY: number;
}

function dispatchTouch(
	target: HTMLElement,
	type: string,
	touches: Point[],
	changedTouches = touches,
): Event {
	const event = new Event(type, { cancelable: true });
	Object.defineProperties(event, {
		touches: { value: touches },
		changedTouches: { value: changedTouches },
	});
	target.dispatchEvent(event);
	return event;
}

describe('attachTouchGestures', () => {
	it('zooms on pinch and prevents the browser default gesture', () => {
		const target = document.createElement('div');
		const onPinchZoom = vi.fn();
		const detach = attachTouchGestures(target, {
			getScale: () => 1,
			onPinchZoom,
			isSwipeEnabled: () => true,
			onNext: vi.fn(),
			onPrevious: vi.fn(),
		});

		dispatchTouch(target, 'touchstart', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 100, clientY: 0 },
		]);
		const move = dispatchTouch(target, 'touchmove', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 150, clientY: 0 },
		]);

		expect(move.defaultPrevented).toBeTruthy();
		expect(onPinchZoom).toHaveBeenCalledWith(1.5);
		detach();
	});

	it('maps preview swipes to next and previous slides, but respects editing', () => {
		const target = document.createElement('div');
		const onNext = vi.fn();
		const onPrevious = vi.fn();
		let swipeEnabled = true;
		const detach = attachTouchGestures(target, {
			getScale: () => 1,
			onPinchZoom: vi.fn(),
			isSwipeEnabled: () => swipeEnabled,
			onNext,
			onPrevious,
		});

		dispatchTouch(target, 'touchstart', [{ clientX: 180, clientY: 20 }]);
		dispatchTouch(target, 'touchend', [], [{ clientX: 100, clientY: 25 }]);
		expect(onNext).toHaveBeenCalledOnce();

		dispatchTouch(target, 'touchstart', [{ clientX: 100, clientY: 20 }]);
		dispatchTouch(target, 'touchend', [], [{ clientX: 170, clientY: 20 }]);
		expect(onPrevious).toHaveBeenCalledOnce();

		swipeEnabled = false;
		dispatchTouch(target, 'touchstart', [{ clientX: 180, clientY: 20 }]);
		dispatchTouch(target, 'touchend', [], [{ clientX: 100, clientY: 20 }]);
		expect(onNext).toHaveBeenCalledOnce();
		detach();
	});
});
