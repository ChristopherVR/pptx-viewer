// oxlint-disable react-hooks/rules-of-hooks
/**
 * The prop-versus-toggle rule, as this binding wires it.
 *
 * Vue used to read `props.autosave ?? false`, so a host that said nothing got no
 * crash recovery at all while React and Angular gave it to everyone. All five
 * now run the shared `resolveAutosaveActivation`: the prop is a ceiling, the
 * toggle is a preference inside it, and the default is ON.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';

import { useAutosaveWiring } from './useAutosaveWiring';
import type { UseAutosaveWiringResult } from './useAutosaveWiring';

// There is no IndexedDB in this environment, and the store is not what is under
// test: intercept the write so a snapshot that DOES happen is observable rather
// than an unhandled rejection. Everything else in the shared package stays real.
// (`vi.mock` is hoisted above the imports, so its position here is cosmetic.)
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: async () => true,
}));

function slide(id: string): PptxSlide {
	return { id, elements: [] } as unknown as PptxSlide;
}

interface WireHarness {
	api: UseAutosaveWiringResult;
	/** The reactive stores the composition owns, so a test can drive a load. */
	slides: ReturnType<typeof shallowRef<PptxSlide[]>>;
	loading: ReturnType<typeof ref<boolean>>;
	/** How many recovery snapshots were actually serialised. */
	snapshots: () => number;
	stop: () => void;
}

function wire(overrides: { hostAutosave?: boolean; canEdit?: boolean } = {}): WireHarness {
	const scope = effectScope();
	const slides = shallowRef<PptxSlide[]>([]);
	const loading = ref(false);
	const getRecoverySnapshot = vi.fn(() => Promise.resolve(new Uint8Array()));
	let api!: UseAutosaveWiringResult;
	scope.run(() => {
		api = useAutosaveWiring({
			slides,
			loading,
			canEdit: () => overrides.canEdit ?? true,
			autosaveEnabledByHost: () => overrides.hostAutosave,
			intervalMs: () => 2000,
			snapshotName: () => 'deck.pptx',
			getRecoverySnapshot,
			emitAutosave: vi.fn(),
			captureVersion: vi.fn(),
		});
	});
	return {
		api,
		slides,
		loading,
		snapshots: () => getRecoverySnapshot.mock.calls.length,
		stop: () => scope.stop(),
	};
}

describe('useAutosaveWiring activation', () => {
	it('runs by default, with no `autosave` prop at all', () => {
		const { api, stop } = wire({});
		expect(api.autosaveActive.value).toBeTruthy();
		expect(api.autosaveDisabledReason.value).toBeUndefined();
		stop();
	});

	it('lets the user toggle it off, and back on', () => {
		const { api, stop } = wire({});
		api.toggleAutosave();
		expect(api.autosaveActive.value).toBeFalsy();
		expect(api.autosaveDisabledReason.value).toBe('autosave_toggle_off');
		api.toggleAutosave();
		expect(api.autosaveActive.value).toBeTruthy();
		stop();
	});

	it('refuses to let the toggle overrule an explicit host veto', () => {
		const { api, stop } = wire({ hostAutosave: false });
		expect(api.autosaveActive.value).toBeFalsy();
		expect(api.autosaveDisabledReason.value).toBe('autosave_host_off');
		api.toggleAutosave();
		expect(api.autosaveActive.value).toBeFalsy();
		expect(api.autosaveEnabled.value).toBeTruthy();
		stop();
	});

	it('stays off for a read-only deck, and says why', () => {
		const { api, stop } = wire({ canEdit: false });
		expect(api.autosaveActive.value).toBeFalsy();
		expect(api.autosaveDisabledReason.value).toBe('read_only');
		stop();
	});
});

/**
 * Opening a deck is not editing it.
 *
 * `useAutosave` arms its debounce on any reassignment of the watched stores,
 * and the load pipeline reassigns `slides` with the freshly parsed deck. This
 * wiring already answered that by clearing `isDirty` once `loading` settles,
 * but the ARMED TIMER outlived the flag: it fired one interval later and saved
 * unconditionally. Measured on the running demos, IndexedDB held a recovery
 * snapshot ~2s after a plain load with no interaction at all, so the next visit
 * offered to "recover unsaved changes" for a deck the user had only read.
 * Angular and Vanilla poll a real dirty flag and never did this.
 *
 * The fix is in `useAutosave`: the timer re-reads `isDirty` when it fires
 * instead of trusting the arm. These tests drive it through the wiring because
 * that is where the flag is cleared, and pin BOTH directions - a load writes
 * nothing, a later edit still writes.
 */
describe('a read-only session writes no recovery snapshot', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	/**
	 * What the load pipeline does: raise `loading`, parse (asynchronously), commit
	 * the parsed slides, then lower it. The awaits are load-bearing - a `loading`
	 * ref that goes up and down inside one flush never reaches the watcher.
	 */
	async function load(harness: WireHarness): Promise<void> {
		harness.loading.value = true;
		await nextTick();
		harness.slides.value = [slide('a'), slide('b'), slide('c')];
		harness.loading.value = false;
		// The `loading` watcher that clears the flag is a default (pre-flush)
		// watcher, so it runs on the scheduler rather than synchronously.
		await nextTick();
	}

	it('writes nothing after a load with no edits', async () => {
		const harness = wire();

		await load(harness);
		expect(harness.api.autosave.isDirty.value).toBeFalsy();

		// Three intervals' worth of idling: an armed-but-cancelled timer would
		// have fired long before this.
		vi.advanceTimersByTime(6000);
		await vi.runOnlyPendingTimersAsync();

		expect(harness.snapshots()).toBe(0);
		harness.stop();
	});

	it('still writes for the first real edit after that load', async () => {
		const harness = wire();

		await load(harness);
		vi.advanceTimersByTime(6000);
		await vi.runOnlyPendingTimersAsync();
		expect(harness.snapshots()).toBe(0);

		// A genuine edit: the editor reassigns the array immutably.
		harness.slides.value = [...harness.slides.value, slide('d')];
		expect(harness.api.autosave.isDirty.value).toBeTruthy();
		vi.advanceTimersByTime(2000);
		await vi.runOnlyPendingTimersAsync();

		expect(harness.snapshots()).toBe(1);
		harness.stop();
	});
});
