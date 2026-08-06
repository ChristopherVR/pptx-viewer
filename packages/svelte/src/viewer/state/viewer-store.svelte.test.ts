/**
 * Performance contract for the Svelte viewer-store adapter.
 *
 * Counts effect runs against a `$state`-backed getter: a rune read inside
 * `$effect` re-runs only when the value it tracked actually changed, so an
 * unrelated slice moving must cost this nothing (issue #145).
 */
import { createViewerStore } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { describe, it, expect, vi } from 'vitest';

import { viewerStoreSelection } from './viewer-store.svelte';

interface State {
	slideIndex: number;
	zoom: number;
}

const initial: State = { slideIndex: 0, zoom: 1 };

describe('viewerStoreSelection', () => {
	it('exposes the current value', () => {
		const store = createViewerStore(initial);
		const selection = viewerStoreSelection(store, (s) => s.zoom);

		expect(selection.value).toBe(1);
		selection.destroy();
	});

	it('updates when its own slice changes', () => {
		const store = createViewerStore(initial);
		const selection = viewerStoreSelection(store, (s) => s.zoom);

		store.setState((s) => ({ ...s, zoom: 5 }));

		expect(selection.value).toBe(5);
		selection.destroy();
	});

	it('does NOT re-run a tracking effect when an unrelated slice changes', () => {
		const store = createViewerStore(initial);
		const selection = viewerStoreSelection(store, (s) => s.zoom);
		const seen = vi.fn();

		const cleanup = $effect.root(() => {
			$effect(() => seen(selection.value));
		});
		flushSync();
		const afterMount = seen.mock.calls.length;

		store.setState((s) => ({ ...s, slideIndex: 4 }));
		flushSync();

		expect(seen.mock.calls.length - afterMount).toBe(0);
		cleanup();
		selection.destroy();
	});

	it('re-runs a tracking effect once for a batch touching several fields', () => {
		const store = createViewerStore(initial);
		const selection = viewerStoreSelection(store, (s) => s.zoom);
		const seen = vi.fn();

		const cleanup = $effect.root(() => {
			$effect(() => seen(selection.value));
		});
		flushSync();
		const afterMount = seen.mock.calls.length;

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState((s) => ({ ...s, zoom: 3 }));
			store.setState((s) => ({ ...s, slideIndex: 9 }));
		});
		flushSync();

		expect(seen.mock.calls.length - afterMount).toBe(1);
		cleanup();
		selection.destroy();
	});

	it('stops updating after destroy', () => {
		const store = createViewerStore(initial);
		const selection = viewerStoreSelection(store, (s) => s.zoom);
		selection.destroy();

		store.setState((s) => ({ ...s, zoom: 9 }));

		expect(selection.value).toBe(1);
	});
});
