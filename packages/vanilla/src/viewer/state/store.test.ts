import { describe, expect, it, vi } from 'vitest';

import { createStore } from './store';
import { clampSlideIndex, createInitialViewerState } from './viewer-state';

describe('createStore', () => {
	it('returns the initial state', () => {
		const store = createStore({ a: 1, b: 'x' });
		expect(store.get()).toStrictEqual({ a: 1, b: 'x' });
	});

	it('merges patches and notifies subscribers with next + previous state', () => {
		const store = createStore({ a: 1, b: 'x' });
		const listener = vi.fn();
		store.subscribe(listener);

		store.set({ a: 2 });

		expect(store.get()).toStrictEqual({ a: 2, b: 'x' });
		expect(listener).toHaveBeenCalledExactlyOnceWith({ a: 2, b: 'x' }, { a: 1, b: 'x' });
	});

	it('does not notify when the patch changes nothing', () => {
		const store = createStore({ a: 1 });
		const listener = vi.fn();
		store.subscribe(listener);

		store.set({ a: 1 });
		store.set({});

		expect(listener).not.toHaveBeenCalled();
	});

	it('stops notifying after unsubscribe', () => {
		const store = createStore({ a: 1 });
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		unsubscribe();
		store.set({ a: 2 });

		expect(listener).not.toHaveBeenCalled();
	});

	it('supports multiple subscribers', () => {
		const store = createStore({ a: 1 });
		const first = vi.fn();
		const second = vi.fn();
		store.subscribe(first);
		store.subscribe(second);

		store.set({ a: 3 });

		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
	});
});

describe('viewer state helpers', () => {
	it('creates a sane initial state', () => {
		const state = createInitialViewerState();
		expect(state.slides).toStrictEqual([]);
		expect(state.currentSlide).toBe(0);
		expect(state.zoom).toBe('fit');
		expect(state.loading).toBeFalsy();
		expect(state.error).toBeNull();
		expect(state.presenting).toBeFalsy();
		expect(state.canvasSize.width).toBeGreaterThan(0);
	});

	it('clamps slide indices into range', () => {
		expect(clampSlideIndex(-5, 10)).toBe(0);
		expect(clampSlideIndex(3, 10)).toBe(3);
		expect(clampSlideIndex(99, 10)).toBe(9);
		expect(clampSlideIndex(2.7, 10)).toBe(2);
		expect(clampSlideIndex(4, 0)).toBe(0);
	});
});
