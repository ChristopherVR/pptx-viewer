/**
 * Tests for the Angular touch-gesture adapter (`touch-gestures.ts`).
 *
 * These exercise the pure adapter layer over the shared
 * `createTouchGestureRecognizer`: the `clampScale` wrapper bound to the Angular
 * viewer's zoom range, and `attachTouchGestures`, which wires real DOM touch
 * listeners onto an element and tears them down again. happy-dom supplies the
 * `EventTarget` / `addEventListener` plumbing, so no Angular TestBed is needed
 * (the plain vitest environment has no JIT compiler).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	attachTouchGestures,
	clampScale,
	getTouchDistance,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
	MAX_ZOOM_SCALE,
	MIN_ZOOM_SCALE,
	SWIPE_MAX_VERTICAL_PX,
	SWIPE_THRESHOLD_PX,
} from './touch-gestures';

// ---------------------------------------------------------------------------
// Synthetic touch helpers
// ---------------------------------------------------------------------------

interface FakeTouch {
	clientX: number;
	clientY: number;
}

/**
 * Build a minimal structural `TouchEvent` and dispatch it via a CustomEvent so
 * happy-dom routes it to the element's listeners. The recogniser only reads
 * `touches`, `changedTouches`, and `preventDefault`, so a structural object is
 * sufficient.
 */
function dispatchTouch(
	el: HTMLElement,
	type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
	touches: FakeTouch[],
	changedTouches: FakeTouch[] = touches,
): { preventDefaultCalled: boolean } {
	let preventDefaultCalled = false;
	const event = new Event(type, { cancelable: true, bubbles: false });
	Object.defineProperty(event, 'touches', { value: touches, configurable: true });
	Object.defineProperty(event, 'changedTouches', { value: changedTouches, configurable: true });
	const originalPreventDefault = event.preventDefault.bind(event);
	event.preventDefault = () => {
		preventDefaultCalled = true;
		originalPreventDefault();
	};
	el.dispatchEvent(event);
	return { preventDefaultCalled };
}

// ---------------------------------------------------------------------------
// clampScale (Angular viewer zoom range = [0.2, 3])
// ---------------------------------------------------------------------------

describe('clampScale (angular)', () => {
	it('returns the value within range', () => {
		expect(clampScale(1)).toBe(1);
		expect(clampScale(2.5)).toBe(2.5);
	});

	it('clamps below the minimum to MIN_ZOOM_SCALE', () => {
		expect(clampScale(0.1)).toBe(MIN_ZOOM_SCALE);
		expect(clampScale(-5)).toBe(MIN_ZOOM_SCALE);
		expect(MIN_ZOOM_SCALE).toBe(0.2);
	});

	it('clamps above the maximum to MAX_ZOOM_SCALE', () => {
		expect(clampScale(99)).toBe(MAX_ZOOM_SCALE);
		expect(MAX_ZOOM_SCALE).toBe(3);
	});

	it('returns the boundary values exactly', () => {
		expect(clampScale(0.2)).toBe(0.2);
		expect(clampScale(3)).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// Re-exported pure helpers / constants
// ---------------------------------------------------------------------------

describe('re-exports', () => {
	it('getTouchDistance computes Euclidean distance', () => {
		expect(getTouchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 })).toBe(5);
	});

	it('exposes the shared gesture constants', () => {
		expect(SWIPE_THRESHOLD_PX).toBe(50);
		expect(SWIPE_MAX_VERTICAL_PX).toBe(100);
		expect(LONG_PRESS_DURATION_MS).toBe(500);
		expect(LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// attachTouchGestures: listener lifecycle + gesture routing
// ---------------------------------------------------------------------------

describe('attachTouchGestures', () => {
	let el: HTMLElement;

	beforeEach(() => {
		vi.useFakeTimers();
		el = document.createElement('div');
		document.body.appendChild(el);
	});

	afterEach(() => {
		vi.useRealTimers();
		el.remove();
	});

	it('drives pinch-to-zoom and preventDefault on the two-finger path', () => {
		const onPinchZoom = vi.fn();
		const teardown = attachTouchGestures(el, {
			getScale: () => 1,
			callbacks: { onPinchZoom },
		});

		// Two fingers 100px apart, then spread to 200px → ratio 2 → scale 2.
		const start = dispatchTouch(el, 'touchstart', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 100, clientY: 0 },
		]);
		expect(start.preventDefaultCalled).toBeTruthy();

		const move = dispatchTouch(el, 'touchmove', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 200, clientY: 0 },
		]);
		expect(move.preventDefaultCalled).toBeTruthy();
		expect(onPinchZoom).toHaveBeenLastCalledWith(2);

		teardown();
	});

	it('clamps a pinch-out beyond the max zoom', () => {
		const onPinchZoom = vi.fn();
		const teardown = attachTouchGestures(el, {
			getScale: () => 1,
			callbacks: { onPinchZoom },
		});
		dispatchTouch(el, 'touchstart', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 100, clientY: 0 },
		]);
		// Spread to 10x → 1 * 10 = 10 → clamped to MAX_ZOOM_SCALE (3).
		dispatchTouch(el, 'touchmove', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 1000, clientY: 0 },
		]);
		expect(onPinchZoom).toHaveBeenLastCalledWith(MAX_ZOOM_SCALE);
		teardown();
	});

	it('emits a leftward swipe (direction -1) on a horizontal drag', () => {
		const onSwipe = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onSwipe } });

		dispatchTouch(el, 'touchstart', [{ clientX: 200, clientY: 100 }]);
		dispatchTouch(el, 'touchend', [], [{ clientX: 100, clientY: 100 }]);
		expect(onSwipe).toHaveBeenCalledWith(-1);
		teardown();
	});

	it('emits a rightward swipe (direction 1) on a horizontal drag', () => {
		const onSwipe = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onSwipe } });

		dispatchTouch(el, 'touchstart', [{ clientX: 100, clientY: 100 }]);
		dispatchTouch(el, 'touchend', [], [{ clientX: 200, clientY: 100 }]);
		expect(onSwipe).toHaveBeenCalledWith(1);
		teardown();
	});

	it('ignores a vertical-dominant drag (scroll, not swipe)', () => {
		const onSwipe = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onSwipe } });

		dispatchTouch(el, 'touchstart', [{ clientX: 100, clientY: 100 }]);
		// 60px horizontal but 200px vertical → exceeds SWIPE_MAX_VERTICAL_PX.
		dispatchTouch(el, 'touchend', [], [{ clientX: 160, clientY: 300 }]);
		expect(onSwipe).not.toHaveBeenCalled();
		teardown();
	});

	it('fires a long-press after the hold duration with the press coordinates', () => {
		const onLongPress = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onLongPress } });

		dispatchTouch(el, 'touchstart', [{ clientX: 42, clientY: 84 }]);
		expect(onLongPress).not.toHaveBeenCalled();
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).toHaveBeenCalledWith(42, 84);
		teardown();
	});

	it('cancels the long-press when the finger moves beyond tolerance', () => {
		const onLongPress = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onLongPress } });

		dispatchTouch(el, 'touchstart', [{ clientX: 100, clientY: 100 }]);
		dispatchTouch(el, 'touchmove', [
			{ clientX: 100 + LONG_PRESS_MOVE_TOLERANCE_PX + 5, clientY: 100 },
		]);
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).not.toHaveBeenCalled();
		teardown();
	});

	it('does not fire a long-press for a quick tap (released before the hold)', () => {
		const onLongPress = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onLongPress } });

		dispatchTouch(el, 'touchstart', [{ clientX: 10, clientY: 10 }]);
		dispatchTouch(el, 'touchend', [], [{ clientX: 10, clientY: 10 }]);
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).not.toHaveBeenCalled();
		teardown();
	});

	it('teardown removes the listeners so later events are ignored', () => {
		const onPinchZoom = vi.fn();
		const teardown = attachTouchGestures(el, { getScale: () => 1, callbacks: { onPinchZoom } });
		teardown();

		dispatchTouch(el, 'touchstart', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 100, clientY: 0 },
		]);
		dispatchTouch(el, 'touchmove', [
			{ clientX: 0, clientY: 0 },
			{ clientX: 200, clientY: 0 },
		]);
		expect(onPinchZoom).not.toHaveBeenCalled();
	});
});
