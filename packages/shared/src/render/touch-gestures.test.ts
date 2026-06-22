import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
	getTouchDistance,
	clampScale,
	createTouchGestureRecognizer,
	SWIPE_THRESHOLD_PX,
	SWIPE_MAX_VERTICAL_PX,
	LONG_PRESS_DURATION_MS,
	LONG_PRESS_MOVE_TOLERANCE_PX,
} from './touch-gestures';
import type { TouchEventLike, TouchPoint, TouchGestureCallbacks } from './touch-gestures';

// ---------------------------------------------------------------------------
// Fake DOM-event builders (cast through `unknown`, never `any`)
// ---------------------------------------------------------------------------

function point(clientX: number, clientY: number): TouchPoint {
	return { clientX, clientY };
}

interface FakeTouchEvent {
	touches: TouchPoint[];
	changedTouches: TouchPoint[];
	preventDefault: () => void;
}

function makeEvent(touches: TouchPoint[], changedTouches: TouchPoint[] = []): TouchEventLike {
	const evt: FakeTouchEvent = {
		touches,
		changedTouches,
		preventDefault: vi.fn(),
	};
	return evt as unknown as TouchEventLike;
}

const MIN = 0.2;
const MAX = 5;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('getTouchDistance', () => {
	it('returns 0 for coincident points', () => {
		expect(getTouchDistance(point(10, 10), point(10, 10))).toBe(0);
	});

	it('computes a horizontal distance', () => {
		expect(getTouchDistance(point(0, 0), point(100, 0))).toBe(100);
	});

	it('computes a vertical distance', () => {
		expect(getTouchDistance(point(0, 0), point(0, 50))).toBe(50);
	});

	it('computes a 3-4-5 diagonal', () => {
		expect(getTouchDistance(point(0, 0), point(3, 4))).toBe(5);
	});

	it('is symmetric', () => {
		expect(getTouchDistance(point(10, 20), point(30, 40))).toBeCloseTo(
			getTouchDistance(point(30, 40), point(10, 20)),
			10,
		);
	});
});

describe('clampScale', () => {
	it('passes through values within range', () => {
		expect(clampScale(1, MIN, MAX)).toBe(1);
		expect(clampScale(2.5, MIN, MAX)).toBe(2.5);
	});

	it('clamps below the minimum', () => {
		expect(clampScale(0.1, MIN, MAX)).toBe(MIN);
		expect(clampScale(-3, MIN, MAX)).toBe(MIN);
	});

	it('clamps above the maximum', () => {
		expect(clampScale(6, MIN, MAX)).toBe(MAX);
		expect(clampScale(100, MIN, MAX)).toBe(MAX);
	});

	it('returns boundary values exactly', () => {
		expect(clampScale(MIN, MIN, MAX)).toBe(MIN);
		expect(clampScale(MAX, MIN, MAX)).toBe(MAX);
	});
});

describe('gesture constants', () => {
	it('have the documented values', () => {
		expect(SWIPE_THRESHOLD_PX).toBe(50);
		expect(SWIPE_MAX_VERTICAL_PX).toBe(100);
		expect(LONG_PRESS_DURATION_MS).toBe(500);
		expect(LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Pinch
// ---------------------------------------------------------------------------

describe('createTouchGestureRecognizer: pinch', () => {
	function setup(scale: number, cb: TouchGestureCallbacks) {
		return createTouchGestureRecognizer({
			getScale: () => scale,
			minScale: MIN,
			maxScale: MAX,
			callbacks: cb,
		});
	}

	it('doubles the scale when the finger distance doubles', () => {
		const onPinchZoom = vi.fn();
		const r = setup(1, { onPinchZoom });
		r.onTouchStart(makeEvent([point(0, 0), point(100, 0)]));
		r.onTouchMove(makeEvent([point(0, 0), point(200, 0)]));
		expect(onPinchZoom).toHaveBeenLastCalledWith(2);
	});

	it('halves the scale when the distance halves, scaled by base', () => {
		const onPinchZoom = vi.fn();
		const r = setup(1.5, { onPinchZoom });
		r.onTouchStart(makeEvent([point(0, 0), point(100, 0)]));
		r.onTouchMove(makeEvent([point(0, 0), point(50, 0)]));
		expect(onPinchZoom).toHaveBeenLastCalledWith(0.75);
	});

	it('clamps the pinch result to maxScale', () => {
		const onPinchZoom = vi.fn();
		const r = setup(1, { onPinchZoom });
		r.onTouchStart(makeEvent([point(0, 0), point(100, 0)]));
		r.onTouchMove(makeEvent([point(0, 0), point(1000, 0)]));
		expect(onPinchZoom).toHaveBeenLastCalledWith(MAX);
	});

	it('calls preventDefault on the pinch start and move', () => {
		const r = setup(1, { onPinchZoom: vi.fn() });
		const start = makeEvent([point(0, 0), point(100, 0)]);
		r.onTouchStart(start);
		expect(start.preventDefault).toHaveBeenCalledOnce();
		const move = makeEvent([point(0, 0), point(120, 0)]);
		r.onTouchMove(move);
		expect(move.preventDefault).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

describe('createTouchGestureRecognizer: swipe', () => {
	function setup(onSwipe: (d: -1 | 1) => void) {
		return createTouchGestureRecognizer({
			getScale: () => 1,
			minScale: MIN,
			maxScale: MAX,
			callbacks: { onSwipe },
		});
	}

	function swipe(
		r: ReturnType<typeof createTouchGestureRecognizer>,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) {
		r.onTouchStart(makeEvent([point(fromX, fromY)]));
		r.onTouchEnd(makeEvent([], [point(toX, toY)]));
	}

	it('emits 1 for a rightward horizontal swipe', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 100, 200, 200, 200);
		expect(onSwipe).toHaveBeenCalledWith(1);
	});

	it('emits -1 for a leftward horizontal swipe', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 200, 200, 100, 200);
		expect(onSwipe).toHaveBeenCalledWith(-1);
	});

	it('rejects a swipe below the horizontal threshold', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 0, 0, SWIPE_THRESHOLD_PX - 1, 0);
		expect(onSwipe).not.toHaveBeenCalled();
	});

	it('accepts a swipe exactly at the horizontal threshold', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 0, 0, SWIPE_THRESHOLD_PX, 0);
		expect(onSwipe).toHaveBeenCalledWith(1);
	});

	it('rejects a vertical-dominant gesture (too much vertical travel)', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 100, 100, 200, 100 + SWIPE_MAX_VERTICAL_PX);
		expect(onSwipe).not.toHaveBeenCalled();
	});

	it('accepts a diagonal swipe within the vertical tolerance', () => {
		const onSwipe = vi.fn();
		swipe(setup(onSwipe), 100, 200, 160, 230);
		expect(onSwipe).toHaveBeenCalledWith(1);
	});
});

// ---------------------------------------------------------------------------
// Long-press
// ---------------------------------------------------------------------------

describe('createTouchGestureRecognizer: swipe (empty changedTouches fallback)', () => {
	function setup(onSwipe: (d: -1 | 1) => void) {
		return createTouchGestureRecognizer({
			getScale: () => 1,
			minScale: MIN,
			maxScale: MAX,
			callbacks: { onSwipe },
		});
	}

	it('measures the swipe from the last move position when touchend omits changedTouches', () => {
		const onSwipe = vi.fn();
		const r = setup(onSwipe);
		r.onTouchStart(makeEvent([point(200, 200)]));
		r.onTouchMove(makeEvent([point(120, 205)])); // moved left, within vertical tolerance
		r.onTouchEnd(makeEvent([], [])); // synthetic dispatcher: no changedTouches
		expect(onSwipe).toHaveBeenCalledWith(-1);
	});

	it('still prefers changedTouches when present (move tracking does not override)', () => {
		const onSwipe = vi.fn();
		const r = setup(onSwipe);
		r.onTouchStart(makeEvent([point(100, 200)]));
		r.onTouchMove(makeEvent([point(150, 200)]));
		r.onTouchEnd(makeEvent([], [point(200, 200)])); // changedTouches wins -> end at 200
		expect(onSwipe).toHaveBeenCalledWith(1);
	});

	it('does not emit when no move occurred and changedTouches is empty', () => {
		const onSwipe = vi.fn();
		const r = setup(onSwipe);
		r.onTouchStart(makeEvent([point(100, 100)]));
		r.onTouchEnd(makeEvent([], [])); // delta 0 -> no swipe
		expect(onSwipe).not.toHaveBeenCalled();
	});
});

describe('createTouchGestureRecognizer: long-press', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function setup(onLongPress: (x: number, y: number) => void) {
		return createTouchGestureRecognizer({
			getScale: () => 1,
			minScale: MIN,
			maxScale: MAX,
			callbacks: { onLongPress },
		});
	}

	it('fires after the hold duration with the press coordinates', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(42, 84)]));
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).toHaveBeenCalledWith(42, 84);
	});

	it('does not fire before the hold duration elapses', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(42, 84)]));
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS - 1);
		expect(onLongPress).not.toHaveBeenCalled();
	});

	it('cancels when the finger moves beyond the tolerance', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(100, 100)]));
		r.onTouchMove(makeEvent([point(100 + LONG_PRESS_MOVE_TOLERANCE_PX + 1, 100)]));
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).not.toHaveBeenCalled();
	});

	it('does not cancel for movement within the tolerance', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(100, 100)]));
		r.onTouchMove(makeEvent([point(100 + LONG_PRESS_MOVE_TOLERANCE_PX, 100)]));
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).toHaveBeenCalledWith(100, 100);
	});

	it('cancels when a second touch begins a pinch', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(100, 100)]));
		r.onTouchStart(makeEvent([point(100, 100), point(200, 100)]));
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).not.toHaveBeenCalled();
	});

	it('cancel() clears a pending long-press', () => {
		const onLongPress = vi.fn();
		const r = setup(onLongPress);
		r.onTouchStart(makeEvent([point(100, 100)]));
		r.cancel();
		vi.advanceTimersByTime(LONG_PRESS_DURATION_MS);
		expect(onLongPress).not.toHaveBeenCalled();
	});
});
