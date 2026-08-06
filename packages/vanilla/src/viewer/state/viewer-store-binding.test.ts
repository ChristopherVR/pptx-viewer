/**
 * Performance contract for the vanilla viewer-store binding.
 *
 * Counts PAINTS. This binding writes the DOM directly, so a needless
 * notification is a needless DOM write, not just a wasted diff (issue #145).
 */
import { createViewerStore } from 'pptx-viewer-shared';
import { describe, it, expect, vi } from 'vitest';

import { watchViewerStore } from './viewer-store-binding';

interface State {
	slideIndex: number;
	zoom: number;
}

const initial: State = { slideIndex: 0, zoom: 1 };

describe('watchViewerStore', () => {
	it('paints immediately with the current value', () => {
		const store = createViewerStore(initial);
		const paint = vi.fn();

		watchViewerStore(store, (s) => s.zoom, paint);

		expect(paint).toHaveBeenCalledExactlyOnceWith(1, undefined);
	});

	it('does NOT repaint when an unrelated slice changes', () => {
		const store = createViewerStore(initial);
		const paint = vi.fn();
		watchViewerStore(store, (s) => s.zoom, paint);
		const afterFirst = paint.mock.calls.length;

		store.setState((s) => ({ ...s, slideIndex: 3 }));

		expect(paint.mock.calls.length - afterFirst).toBe(0);
	});

	it('repaints with both values when its own slice changes', () => {
		const store = createViewerStore(initial);
		const paint = vi.fn();
		watchViewerStore(store, (s) => s.zoom, paint);

		store.setState((s) => ({ ...s, zoom: 2 }));

		expect(paint).toHaveBeenLastCalledWith(2, 1);
	});

	it('repaints once for a batch touching several fields', () => {
		const store = createViewerStore(initial);
		const paint = vi.fn();
		watchViewerStore(store, (s) => s.zoom, paint);
		const afterFirst = paint.mock.calls.length;

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState((s) => ({ ...s, zoom: 3 }));
			store.setState((s) => ({ ...s, slideIndex: 9 }));
		});

		expect(paint.mock.calls.length - afterFirst).toBe(1);
	});

	it('stops painting after unsubscribe', () => {
		const store = createViewerStore(initial);
		const paint = vi.fn();
		const unsubscribe = watchViewerStore(store, (s) => s.zoom, paint);
		unsubscribe();

		store.setState((s) => ({ ...s, zoom: 8 }));

		expect(paint).toHaveBeenCalledOnce();
	});
});
