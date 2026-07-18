import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import type { ViewerStateBag } from './create-viewer-state-types';
import CreateViewerStateHarness from './CreateViewerStateHarness.svelte';

/**
 * Runtime proof that `createViewerState` actually works under Svelte's
 * reactivity/lifecycle system (not just typechecks): `onMount` / `onDestroy`
 * / `setContext` all require being invoked during a component's
 * initialisation. `mount()`ing the `CreateViewerStateHarness` fixture below
 * exercises exactly that: it calls `createViewerState` synchronously from
 * its own script, mirroring how a real host viewer-shell component would.
 * If the factory's lifecycle wiring were broken (e.g. `onMount` called
 * outside a component context), `mount()` itself would throw.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderHarness(): ViewerStateBag {
	let captured: ViewerStateBag | undefined;
	const target = document.createElement('div');
	const instance = mount(CreateViewerStateHarness, {
		target,
		props: {
			onready: (state: ViewerStateBag) => {
				captured = state;
			},
		},
	});
	cleanup = () => unmount(instance);
	if (!captured) {
		throw new Error('createViewerState harness did not report its state synchronously');
	}
	return captured;
}

describe('createViewerState', () => {
	it('mounts without throwing and constructs every controller', () => {
		const state = renderHarness();

		expect(state.loader).toBeDefined();
		expect(state.viewer).toBeDefined();
		expect(state.editor).toBeDefined();
		expect(state.controller).toBeDefined();
		expect(state.parityUi).toBeDefined();
		expect(state.chromeUi).toBeDefined();
		expect(state.findReplace).toBeDefined();
		expect(state.collab).toBeDefined();
		expect(state.dialogs).toBeDefined();
		expect(state.autosaveCtl).toBeDefined();
		expect(state.presentation).toBeDefined();
		expect(state.presenterSession).toBeDefined();
		expect(state.exportWiring).toBeDefined();
		expect(state.exportUi).toBeDefined();
	});

	it('starts at slide 0 with no presentation loaded (no `source` supplied)', () => {
		const state = renderHarness();

		expect(state.viewer.current).toBe(0);
		expect(state.loader.slides).toHaveLength(0);
		expect(state.displaySlides).toHaveLength(0);
		expect(state.activeSlide).toBeUndefined();
	});

	it('exposes live-reading derived state (scale, mode, ribbon visibility)', () => {
		const state = renderHarness();

		// getViewportWidth/Height are 0 in the harness; `fitScale` clamps to 1.
		expect(state.scale).toBe(1);
		expect(Number.isFinite(state.effectivePercent)).toBeTruthy();
		expect(state.viewerMode).toBe('preview');
		// `getEditable` is false in the harness, so the compact toolbar (not the ribbon) applies.
		expect(state.showRibbon).toBeFalsy();
		expect(state.editingActive).toBeFalsy();
		expect(state.chromeVisible).toBeTruthy();
	});

	it('runs local UI state transitions (notes toggle, autosave flag)', () => {
		const state = renderHarness();

		expect(state.notesExpanded).toBeFalsy();
		state.onNotesToggle();
		expect(state.notesExpanded).toBeTruthy();

		expect(state.autosaveEnabled).toBeFalsy();
		state.setAutosaveEnabled(true);
		expect(state.autosaveEnabled).toBeTruthy();
	});

	it('tears down cleanly on unmount (the harness calls destroy() from its own onDestroy)', () => {
		renderHarness();
		expect(() => cleanup?.()).not.toThrow();
		cleanup = undefined;
	});
});
