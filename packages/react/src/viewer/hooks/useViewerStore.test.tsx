// @vitest-environment happy-dom
/**
 * Performance contract for the React viewer-store adapter.
 *
 * Counts RENDERS. The whole reason the adapter exists is that a component
 * should be able to read one slice of viewer state without the rest of the
 * state re-rendering it (issue #145), and only a render count can show that.
 */
import { createViewerStore } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useViewerStore } from './useViewerStore';

interface State {
	slideIndex: number;
	zoom: number;
}

const selectZoom = (state: State) => state.zoom;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('useViewerStore', () => {
	it('does NOT re-render when an unrelated slice changes', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const onRender = vi.fn();
		function Zoom(): null {
			onRender();
			useViewerStore(store, selectZoom);
			return null;
		}
		act(() => {
			root.render(<Zoom />);
		});
		const afterMount = onRender.mock.calls.length;

		act(() => {
			store.setState((s) => ({ ...s, slideIndex: 5 }));
		});

		expect(onRender.mock.calls.length - afterMount).toBe(0);
	});

	it('re-renders with the new value when its own slice changes', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		let seen: number | null = null;
		function Zoom(): null {
			seen = useViewerStore(store, selectZoom);
			return null;
		}
		act(() => {
			root.render(<Zoom />);
		});
		expect(seen).toBe(1);

		act(() => {
			store.setState((s) => ({ ...s, zoom: 4 }));
		});

		expect(seen).toBe(4);
	});

	it('keeps a stable value for an allocating selector under a custom equality', () => {
		// Without the cache this loops forever inside useSyncExternalStore, so a
		// passing render here is itself the assertion that the memo works.
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const selectView = (state: State) => ({ zoom: state.zoom });
		const sameZoom = (a: { zoom: number }, b: { zoom: number }) => a.zoom === b.zoom;
		const onRender = vi.fn();
		function View(): null {
			onRender();
			useViewerStore(store, selectView, sameZoom);
			return null;
		}
		act(() => {
			root.render(<View />);
		});
		const afterMount = onRender.mock.calls.length;

		act(() => {
			store.setState((s) => ({ ...s, slideIndex: 3 }));
		});

		expect(onRender.mock.calls.length - afterMount).toBe(0);
	});

	it('renders once for a batch that changes several fields', () => {
		const store = createViewerStore<State>({ slideIndex: 0, zoom: 1 });
		const onRender = vi.fn();
		function Both(): null {
			onRender();
			useViewerStore(store, (s) => s.zoom);
			return null;
		}
		act(() => {
			root.render(<Both />);
		});
		const afterMount = onRender.mock.calls.length;

		act(() => {
			store.batch(() => {
				store.setState((s) => ({ ...s, zoom: 2 }));
				store.setState((s) => ({ ...s, zoom: 3 }));
				store.setState((s) => ({ ...s, slideIndex: 9 }));
			});
		});

		expect(onRender.mock.calls.length - afterMount).toBe(1);
	});
});
