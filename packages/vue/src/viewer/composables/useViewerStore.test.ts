/**
 * Performance contract for the Vue viewer-store adapter.
 *
 * Counts REF WRITES, since a `shallowRef` assignment is what schedules a Vue
 * re-render. A component reading one slice of viewer state must not be woken by
 * an unrelated slice moving (issue #145).
 */
import { createViewerStore } from 'pptx-viewer-shared';
import { describe, it, expect, vi } from 'vitest';
import { effectScope, watchSyncEffect } from 'vue';

import { useViewerStore } from './useViewerStore';

interface State {
	slideIndex: number;
	zoom: number;
}

function withScope<T>(run: () => T): { result: T; stop: () => void } {
	const scope = effectScope();
	const result = scope.run(run) as T;
	return { result, stop: () => scope.stop() };
}

describe('useViewerStore (vue)', () => {
	it('does NOT notify when an unrelated slice changes', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const onValue = vi.fn();

		const { result: zoom, stop } = withScope(() => {
			const ref = useViewerStore(store, (s) => s.zoom);
			watchSyncEffect(() => onValue(ref.value));
			return ref;
		});
		const afterMount = onValue.mock.calls.length;

		store.setState((s) => ({ ...s, slideIndex: 5 }));

		expect(onValue.mock.calls.length - afterMount).toBe(0);
		expect(zoom.value).toBe(1);
		stop();
	});

	it('updates the ref when its own slice changes', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const { result: zoom, stop } = withScope(() => useViewerStore(store, (s) => s.zoom));

		store.setState((s) => ({ ...s, zoom: 4 }));

		expect(zoom.value).toBe(4);
		stop();
	});

	it('unsubscribes when the owning scope is disposed', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const { result: zoom, stop } = withScope(() => useViewerStore(store, (s) => s.zoom));

		stop();
		store.setState((s) => ({ ...s, zoom: 7 }));

		expect(zoom.value).toBe(1);
	});

	it('writes the ref once for a batch touching several fields', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const onValue = vi.fn();
		const { stop } = withScope(() => {
			const ref = useViewerStore(store, (s) => s.zoom);
			watchSyncEffect(() => onValue(ref.value));
		});
		const afterMount = onValue.mock.calls.length;

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState((s) => ({ ...s, zoom: 3 }));
			store.setState((s) => ({ ...s, slideIndex: 9 }));
		});

		expect(onValue.mock.calls.length - afterMount).toBe(1);
		stop();
	});
});
