// oxlint-disable react-hooks/rules-of-hooks
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useTouchGestures } from './useTouchGestures';

// ---------------------------------------------------------------------------
// A minimal EventTarget stand-in that records attach/detach + can dispatch.
// ---------------------------------------------------------------------------

interface TouchLike {
	clientX: number;
	clientY: number;
}

function makeTouchEvent(touches: TouchLike[], changed: TouchLike[] = touches): TouchEvent {
	return {
		touches: touches as unknown as TouchList,
		changedTouches: changed as unknown as TouchList,
		preventDefault: vi.fn(),
	} as unknown as TouchEvent;
}

class FakeElement {
	listeners = new Map<string, EventListener>();
	addEventListener = vi.fn((type: string, cb: EventListener) => {
		this.listeners.set(type, cb);
	});
	removeEventListener = vi.fn((type: string) => {
		this.listeners.delete(type);
	});
	fire(type: string, event: TouchEvent): void {
		this.listeners.get(type)?.(event as unknown as Event);
	}
	asElement(): HTMLElement {
		return this as unknown as HTMLElement;
	}
}

describe('useTouchGestures', () => {
	it('attaches the four touch listeners on mount', () => {
		const el = new FakeElement();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: {},
			});
		});
		const types = el.addEventListener.mock.calls.map((c) => c[0]);
		expect(types).toStrictEqual(['touchstart', 'touchmove', 'touchend', 'touchcancel']);
		scope.stop();
	});

	it('uses passive:false for touchstart/touchmove and passive:true for end/cancel', () => {
		const el = new FakeElement();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: {},
			});
		});
		const opts = Object.fromEntries(
			el.addEventListener.mock.calls.map((c) => [c[0], c[2]]),
		) as Record<string, AddEventListenerOptions>;
		expect(opts.touchstart).toStrictEqual({ passive: false });
		expect(opts.touchmove).toStrictEqual({ passive: false });
		expect(opts.touchend).toStrictEqual({ passive: true });
		expect(opts.touchcancel).toStrictEqual({ passive: true });
		scope.stop();
	});

	it('does not attach when disabled', () => {
		const el = new FakeElement();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: {},
				enabled: false,
			});
		});
		expect(el.addEventListener).not.toHaveBeenCalled();
		scope.stop();
	});

	it('removes the listeners on scope dispose', () => {
		const el = new FakeElement();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: {},
			});
		});
		scope.stop();
		expect(el.removeEventListener).toHaveBeenCalledTimes(4);
	});

	it('re-attaches when the target node identity changes', async () => {
		const first = new FakeElement();
		const second = new FakeElement();
		const target = ref<HTMLElement | null>(first.asElement());
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: target,
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: {},
			});
		});
		expect(first.addEventListener).toHaveBeenCalledTimes(4);
		target.value = second.asElement();
		// Let the watcher flush.
		await nextTick();
		expect(first.removeEventListener).toHaveBeenCalledTimes(4);
		expect(second.addEventListener).toHaveBeenCalledTimes(4);
		scope.stop();
	});

	it('emits a pinch-zoom scale on a two-finger spread', () => {
		const el = new FakeElement();
		const onPinchZoom = vi.fn();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: { onPinchZoom },
			});
		});
		// Two fingers 100px apart, then 200px apart -> scale doubles.
		el.fire(
			'touchstart',
			makeTouchEvent([
				{ clientX: 0, clientY: 0 },
				{ clientX: 100, clientY: 0 },
			]),
		);
		el.fire(
			'touchmove',
			makeTouchEvent([
				{ clientX: 0, clientY: 0 },
				{ clientX: 200, clientY: 0 },
			]),
		);
		expect(onPinchZoom).toHaveBeenCalledWith(2);
		scope.stop();
	});

	it('emits a swipe direction on a single-finger horizontal swipe', () => {
		const el = new FakeElement();
		const onSwipe = vi.fn();
		const scope = effectScope();
		scope.run(() => {
			useTouchGestures({
				targetRef: ref(el.asElement()),
				currentScale: ref(1),
				minScale: 0.2,
				maxScale: 5,
				callbacks: { onSwipe },
			});
		});
		el.fire('touchstart', makeTouchEvent([{ clientX: 200, clientY: 100 }]));
		el.fire('touchend', makeTouchEvent([], [{ clientX: 80, clientY: 100 }]));
		expect(onSwipe).toHaveBeenCalledWith(-1);
		scope.stop();
	});
});
