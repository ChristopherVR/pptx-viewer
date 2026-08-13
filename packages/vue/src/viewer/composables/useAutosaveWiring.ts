/**
 * useAutosaveWiring: the title-bar AutoSave toggle plus the debounced save
 * engine behind it.
 *
 * Autosave is gated on three independent things (the host opted in, editing is
 * allowed, and the user has not switched the toggle off), and the title bar has
 * to explain WHICH one is missing, so the gate and its explanation live
 * together rather than being recomputed at two call sites.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { saveAutosaveSnapshot } from 'pptx-viewer-shared';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { computed, ref, watch } from 'vue';

import type { UseAutosaveResult } from './useAutosave';
import { useAutosave } from './useAutosave';

/** Default debounce window when the host does not specify one. */
const DEFAULT_AUTOSAVE_INTERVAL_MS = 2000;

export interface UseAutosaveWiringOptions {
	slides: ShallowRef<PptxSlide[]>;
	/**
	 * The per-slide master/layout (template) element store. Edit-template mode
	 * rebuilds this and NOT `slides`, so without it those edits are never
	 * autosaved. See `UseAutosaveOptions.templateElements`.
	 */
	templateElements?: Ref<unknown>;
	/** True while the load pipeline is running; used to clear the dirty flag after a load. */
	loading: Ref<boolean>;
	canEdit: () => boolean;
	/** Host opt-in (`autosave` prop), read as a getter so a mid-session change applies. */
	autosaveEnabledByHost: () => boolean;
	intervalMs: () => number | undefined;
	/** Label the recovery snapshot is stored under (file path, else file name). */
	snapshotName: () => string;
	/**
	 * Serialise the current deck for crash recovery. Must be the plaintext
	 * (`recovery-snapshot`) serialisation, NOT `getContent`: an encrypted
	 * snapshot cannot be reopened, because no recovery path has the password.
	 */
	getRecoverySnapshot: () => Promise<Uint8Array>;
	/** Emit the serialised bytes to the host. */
	emitAutosave: (bytes: Uint8Array) => void;
	/** Snapshot a restorable version (version history). */
	captureVersion: (label: string, at: number) => void;
}

export interface UseAutosaveWiringResult {
	autosave: UseAutosaveResult;
	/** The title bar's user-facing AutoSave toggle (defaults on). */
	autosaveEnabled: Ref<boolean>;
	toggleAutosave: () => void;
	/** Why autosave is inactive, for the title bar's status message. */
	autosaveDisabledReason: ComputedRef<string | undefined>;
}

export function useAutosaveWiring(options: UseAutosaveWiringOptions): UseAutosaveWiringResult {
	const autosaveEnabled = ref(true);
	const autosaveActive = computed(
		() => options.canEdit() && options.autosaveEnabledByHost() && autosaveEnabled.value,
	);

	const autosaveDisabledReason = computed<string | undefined>(() => {
		if (autosaveActive.value) {
			return undefined;
		}
		if (!autosaveEnabled.value) {
			return 'autosave_toggle_off';
		}
		if (!options.autosaveEnabledByHost()) {
			return 'no_file_path';
		}
		if (!options.canEdit()) {
			return 'autosave_toggle_off';
		}
		return undefined;
	});

	function toggleAutosave(): void {
		autosaveEnabled.value = !autosaveEnabled.value;
	}

	const autosave = useAutosave({
		slides: options.slides,
		...(options.templateElements ? { templateElements: options.templateElements } : {}),
		enabled: autosaveActive,
		// A computed, not a snapshot: `useAutosave` re-reads it each time the timer
		// is armed, so a host changing the AutoRecover cadence (File > Options >
		// Save) takes effect on the next edit instead of needing a remount.
		intervalMs: computed(() => options.intervalMs() ?? DEFAULT_AUTOSAVE_INTERVAL_MS),
		onSave: async () => {
			const bytes = await options.getRecoverySnapshot();
			options.emitAutosave(bytes);
			options.captureVersion('Autosave', Date.now());
			// Also persist to the shared IndexedDB recovery store (matches
			// React/Angular/Vanilla/Svelte's `useAutosave`), so File > Account's
			// Storage & Privacy panel (`getLocalStorageUsageSummary`) and File >
			// Open's "Recent" list have something real to report. Recovery reads
			// these bytes back with no password, so they are deliberately a plain
			// ZIP even when the deck is protected.
			void saveAutosaveSnapshot(options.snapshotName(), bytes);
		},
	});

	// Loading a deck reassigns `slides`, which the autosave watcher counts as an
	// edit; clear the dirty flag once loading settles so a freshly opened deck
	// reads "Saved to this PC" in the title bar, matching React.
	watch(options.loading, (now, was) => {
		if (was && !now) {
			autosave.isDirty.value = false;
		}
	});

	return { autosave, autosaveEnabled, toggleAutosave, autosaveDisabledReason };
}
