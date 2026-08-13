import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
beforeEach(() => {
	// The File > Options store persists to localStorage, and its AutoSave entry
	// mirrors the viewer's toggle: without this, one test's toggle-off would
	// hydrate the next test's viewer.
	localStorage.clear();
});
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

interface HarnessProps {
	/** The host `autosave` POLICY prop; omitted means "the host said nothing". */
	autosave?: boolean;
	filePath?: string;
	editable?: boolean;
	onautosavetoggle?: (enabled: boolean) => void;
}

function renderHarness(props: HarnessProps = {}): ViewerStateBag {
	let captured: ViewerStateBag | undefined;
	const target = document.createElement('div');
	const instance = mount(CreateViewerStateHarness, {
		target,
		props: {
			...props,
			onready: (state: ViewerStateBag) => {
				captured = state;
			},
		},
	});
	cleanup = () => unmount(instance);
	if (!captured) {
		throw new Error('createViewerState harness did not report its state synchronously');
	}
	// Let the `editable` mirror and the File > Options wiring settle.
	flushSync();
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

	it('runs local UI state transitions (notes toggle)', () => {
		const state = renderHarness();

		expect(state.notesExpanded).toBeFalsy();
		state.onNotesToggle();
		expect(state.notesExpanded).toBeTruthy();
	});

	it('exposes the crash-recovery probe alongside the autosave writer', () => {
		expect(renderHarness().autosaveRecovery.prompt).toBeNull();
	});

	it('tears down cleanly on unmount (the harness calls destroy() from its own onDestroy)', () => {
		renderHarness();
		expect(() => cleanup?.()).not.toThrow();
		cleanup = undefined;
	});
});

/**
 * The host `autosave` prop is a POLICY CEILING and the title-bar toggle is the
 * user's preference inside it, decided once by `resolveAutosaveActivation` in
 * `pptx-viewer-shared`. This binding used to default the preference to the raw
 * prop (so `false`), which meant a host that never opted in wrote no recovery
 * snapshot at all and had no way to notice.
 */
describe('autosave activation', () => {
	const writable = { editable: true, filePath: 'deck.pptx' } as const;

	it('is ON by default when the host passes no autosave prop', () => {
		const state = renderHarness(writable);

		expect(state.autosaveEnabled).toBeTruthy();
		expect(state.autosaveToggleAvailable).toBeTruthy();
		expect(state.autosaveActive).toBeTruthy();
		expect(state.autosaveDisabledReason).toBeUndefined();
	});

	it('lets the user switch it off, and tells the host', () => {
		const onautosavetoggle = vi.fn();
		const state = renderHarness({ ...writable, onautosavetoggle });

		state.setAutosaveEnabled(false);

		expect(state.autosaveEnabled).toBeFalsy();
		expect(state.autosaveActive).toBeFalsy();
		expect(state.autosaveDisabledReason).toBe('autosave_toggle_off');
		expect(onautosavetoggle).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('honours an explicit autosave={true} the same way (the toggle still rules)', () => {
		const state = renderHarness({ ...writable, autosave: true });

		expect(state.autosaveActive).toBeTruthy();
		state.setAutosaveEnabled(false);
		expect(state.autosaveActive).toBeFalsy();
	});

	it('cannot be switched on by the user when the host passed autosave={false}', () => {
		const onautosavetoggle = vi.fn();
		const state = renderHarness({ ...writable, autosave: false, onautosavetoggle });

		expect(state.autosaveEnabled).toBeFalsy();
		expect(state.autosaveToggleAvailable).toBeFalsy();
		expect(state.autosaveDisabledReason).toBe('autosave_host_off');

		state.setAutosaveEnabled(true);

		// Inert: the switch stays off, nothing is written, and the host is not
		// told about a preference change it already forbade.
		expect(state.autosaveEnabled).toBeFalsy();
		expect(state.autosaveActive).toBeFalsy();
		expect(state.autosaveDisabledReason).toBe('autosave_host_off');
		expect(onautosavetoggle).not.toHaveBeenCalled();
	});

	it('stays off for a read-only viewer even with the toggle on', () => {
		const state = renderHarness({ filePath: 'deck.pptx', editable: false });

		expect(state.autosaveEnabled).toBeTruthy();
		expect(state.autosaveActive).toBeFalsy();
		expect(state.autosaveDisabledReason).toBe('read_only');
	});

	it('stays off without a filePath, since there is nowhere to write', () => {
		const state = renderHarness({ editable: true });

		expect(state.autosaveActive).toBeFalsy();
		expect(state.autosaveDisabledReason).toBe('no_file_path');
	});
});
