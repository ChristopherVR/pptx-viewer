/**
 * Performance contract for the Angular viewer-store adapter.
 *
 * Angular already stops change detection at signal boundaries, so what has to
 * be proved is that an unrelated slice moving never reaches the signal at all
 * (issue #145).
 *
 * The assertions use an ALLOCATING selector paired with a custom equality, and
 * check reference identity. That is the only externally observable proof that
 * no write happened: had the adapter written, the signal would be holding a
 * different object, even though the values match. A plain scalar selector could
 * not tell "never written" from "written the same number again".
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { createViewerStore } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { viewerStoreSignal } from './viewer-store-signal';

interface State {
	slideIndex: number;
	zoom: number;
}

const initial: State = { slideIndex: 0, zoom: 1 };

const selectZoomView = (state: State) => ({ zoom: state.zoom });
const sameZoom = (a: { zoom: number }, b: { zoom: number }) => a.zoom === b.zoom;

describe('viewerStoreSignal', () => {
	it('exposes the current value', () => {
		const store = createViewerStore(initial);
		const selected = viewerStoreSignal(store, (s) => s.zoom);

		expect(selected.value()).toBe(1);
		selected.destroy();
	});

	it('updates when its own slice changes', () => {
		const store = createViewerStore(initial);
		const selected = viewerStoreSignal(store, (s) => s.zoom);

		store.setState((s) => ({ ...s, zoom: 6 }));

		expect(selected.value()).toBe(6);
		selected.destroy();
	});

	it('never writes the signal when an unrelated slice changes', () => {
		const store = createViewerStore(initial);
		const selected = viewerStoreSignal(store, selectZoomView, sameZoom);
		const before = selected.value();

		store.setState((s) => ({ ...s, slideIndex: 3 }));
		store.setState((s) => ({ ...s, slideIndex: 4 }));

		expect(selected.value()).toBe(before);
		selected.destroy();
	});

	it('writes the signal once for a batch touching several fields', () => {
		const store = createViewerStore(initial);
		const selected = viewerStoreSignal(store, selectZoomView, sameZoom);
		const before = selected.value();

		store.batch(() => {
			store.setState((s) => ({ ...s, zoom: 2 }));
			store.setState((s) => ({ ...s, zoom: 3 }));
			store.setState((s) => ({ ...s, slideIndex: 9 }));
		});

		const after = selected.value();
		expect(after).not.toBe(before);
		expect(after.zoom).toBe(3);
		selected.destroy();
	});

	it('tears down with the injection context that created it', () => {
		// The production path: a component or service calls this in a field
		// initialiser and never unsubscribes by hand.
		const store = createViewerStore(initial);
		const injector = Injector.create({ providers: [] });
		const selected = runInInjectionContext(injector, () => viewerStoreSignal(store, (s) => s.zoom));

		(injector as unknown as { destroy(): void }).destroy();
		store.setState((s) => ({ ...s, zoom: 42 }));

		expect(selected.value()).toBe(1);
	});

	it('still works outside an injection context, handing back destroy', () => {
		const store = createViewerStore(initial);
		const selected = viewerStoreSignal(store, (s) => s.zoom);

		store.setState((s) => ({ ...s, zoom: 3 }));
		expect(selected.value()).toBe(3);

		selected.destroy();
		store.setState((s) => ({ ...s, zoom: 4 }));
		expect(selected.value()).toBe(3);
	});
});
