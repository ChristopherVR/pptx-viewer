<script lang="ts">
	/**
	 * Test-only harness for `createViewerState`. Runtime rune/lifecycle code
	 * (`onMount` / `onDestroy` / `setContext` / `$effect`) can only run inside
	 * a real Svelte component's initialisation, so a plain `.svelte.test.ts`
	 * function call cannot exercise it directly. This tiny component calls
	 * `createViewerState` synchronously in its own script (exactly how a real
	 * host shell would) and hands the resulting bag back to the test via the
	 * `onready` callback prop, immediately and synchronously so the test can
	 * assert on it right after `mount()` returns.
	 */
	import { onDestroy } from 'svelte';

	import { createViewerState } from './create-viewer-state.svelte';
	import type { ViewerStateBag } from './create-viewer-state-types';

	const {
		onready,
		source,
	}: {
		onready: (state: ViewerStateBag) => void;
		/** Optional deck bytes, so a test can exercise the real load pipeline. */
		source?: Uint8Array | ArrayBuffer;
	} = $props();

	const state = createViewerState({
		getSource: () => source,
		getAutosave: () => false,
		getFilePath: () => undefined,
		getInitialSlide: () => 0,
		t: (key: string) => key,
		getSmartArt3D: () => false,
		getEditable: () => false,
		getStageHolderEl: () => undefined,
		getRootEl: () => undefined,
		getViewportWidth: () => 0,
		getViewportHeight: () => 0,
		getMasterScale: () => 1,
	});

	// Mirrors the real usage contract: the host tears the factory's
	// controllers down from its own `onDestroy`.
	onDestroy(() => state.destroy());

	// svelte-ignore state_referenced_locally -- `onready` is a plain callback
	// (never reassigned); a one-time synchronous call is intentional here.
	onready(state);
</script>
