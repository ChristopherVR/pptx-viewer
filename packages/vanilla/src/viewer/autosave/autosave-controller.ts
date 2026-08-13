import type { PptxHandler } from 'pptx-viewer-core';
import type {
	AutosaveActivation,
	AutosaveRecord,
	AutosaveRecoveryOffer,
	DeckSaveIntent,
} from 'pptx-viewer-shared';
import {
	nextAutosaveDelayMs,
	probeAutosaveRecovery,
	recoverySnapshotIntent,
	saveAutosaveSnapshot,
	saveDeckWithPassword,
	shouldProbeAutosaveRecovery,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

/**
 * Debounced autosave for the vanilla viewer, layered on the shared IndexedDB
 * recovery store (`pptx-viewer-shared/autosave-store`).
 *
 * A local edit marks the document dirty; a debounce timer then re-serializes the
 * deck through the shared `saveDeckWithPassword` and persists it under
 * `filePath` via `saveAutosaveSnapshot` (evicting the oldest record on quota
 * exhaustion). The recovery blob is a crash-safety net only; **it never clears
 * the editor's dirty flag** or stands in for the user's real Save.
 *
 * The snapshot is written with `recoverySnapshotIntent`, so it is a plain ZIP
 * even when the deck is password protected: `getAutosaveSnapshot` hands the
 * bytes back with no password, and an encrypted package would simply refuse to
 * open (see `deck-save-encryption` in `pptx-viewer-shared` for the reasoning
 * and the cleartext-at-rest tradeoff it accepts).
 *
 * Two decisions are NOT made here, so all five bindings share them:
 *
 *  - **whether autosave runs at all** comes from the shared
 *    `resolveAutosaveActivation` verdict, read live through
 *    {@link AutosaveControllerDeps.getActivation}. This controller never owns a
 *    raw `enabled` boolean, because the host prop is a ceiling and the user's
 *    toggle is a preference inside it.
 *  - **how long the debounce may defer a snapshot** comes from the shared
 *    `nextAutosaveDelayMs`. A plain re-armed debounce can defer forever while
 *    the user keeps typing; the ceiling keeps the promise that a snapshot lands
 *    no later than one interval after the FIRST unsaved edit.
 *
 * Recovery is probed once per loaded deck through the shared
 * `shouldProbeAutosaveRecovery` / `probeAutosaveRecovery` pair, and surfaced
 * both to the host callback ({@link AutosaveControllerDeps.onRecovery}) and to
 * the viewer's own prompt ({@link AutosaveControllerDeps.onRecoveryOffer}).
 */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Fallback verdict when a host wires no activation function (tests, embeds). */
const ALWAYS_ACTIVE: AutosaveActivation = { active: true, toggleAvailable: true };

export interface AutosaveControllerDeps {
	store: Store<ViewerState>;
	/** Live core handler used to serialize the current slides to `.pptx` bytes. */
	getHandler: () => PptxHandler | null;
	/** IndexedDB key for the recovery snapshot (usually the open file's name). */
	filePath: string;
	/**
	 * The resolved cadence in ms, read EVERY time the timer is armed so a
	 * File > Options > Save change applies without rebuilding the viewer.
	 */
	getIntervalMs: () => number;
	/**
	 * The Protect-Presentation state, forwarded to the shared save decision.
	 * Deliberately inert here: a recovery snapshot is written in the clear
	 * whatever it says. It is threaded through so this path runs the same one
	 * decision function as every real save instead of side-stepping it.
	 */
	getSaveIntent?: () => DeckSaveIntent;
	/** Surface status transitions (toolbar indicator + optional host callback). */
	onStatus?: (status: AutosaveStatus) => void;
	/** The raw record, for the host's `onAutosaveRecovery` hook. */
	onRecovery?: (record: AutosaveRecord) => void;
	/** The shared prompt descriptor + record, for the viewer's own dialog. */
	onRecoveryOffer?: (offer: AutosaveRecoveryOffer) => void;
	/** The live shared activation verdict; omitted means "always active". */
	getActivation?: () => AutosaveActivation;
	/**
	 * Whether a snapshot may be OFFERED back. This is the host ceiling alone
	 * (`autosave !== false`): a user who merely switched the toggle off should
	 * still be asked about work a crash left behind.
	 */
	isRecoveryAllowed?: () => boolean;
}

export interface AutosaveController {
	/** Force an immediate snapshot, bypassing the debounce window. */
	saveNow(): Promise<void>;
	/** Current status. */
	getStatus(): AutosaveStatus;
	/** Re-read the activation verdict (the toggle or edit-ability changed). */
	refresh(): void;
	/** Whether new edits currently schedule recovery snapshots. */
	isEnabled(): boolean;
	/** Tear down the timer + store subscription. */
	destroy(): void;
}

export function createAutosaveController(deps: AutosaveControllerDeps): AutosaveController {
	const { store } = deps;
	let status: AutosaveStatus = 'idle';
	let timer: ReturnType<typeof setTimeout> | null = null;
	let saving = false;
	let disposed = false;
	let recoveryChecked = false;
	/**
	 * When the OLDEST still-unsaved edit happened. The debounce ceiling is
	 * measured from here, not from the newest edit, and it is cleared only by a
	 * snapshot that actually landed.
	 */
	let firstDirtyAt: number | null = null;

	const isActive = (): boolean => (deps.getActivation?.() ?? ALWAYS_ACTIVE).active;
	let active = isActive();

	const setStatus = (next: AutosaveStatus): void => {
		status = next;
		deps.onStatus?.(next);
	};

	const clearTimer = (): void => {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	};

	async function runSave(): Promise<void> {
		const handler = deps.getHandler();
		if (disposed || !isActive() || saving || !handler || !store.get().dirty) {
			return;
		}
		saving = true;
		setStatus('saving');
		try {
			const bytes = await saveDeckWithPassword(
				handler,
				store.get().slides,
				undefined,
				recoverySnapshotIntent(deps.getSaveIntent?.()),
			);
			await saveAutosaveSnapshot(deps.filePath, bytes);
			// The snapshot landed, so the ceiling restarts from the next edit. The
			// editor's own `dirty` flag is deliberately left alone: a recovery blob
			// is not the user's Save.
			firstDirtyAt = null;
			if (!disposed && isActive()) {
				setStatus('saved');
			}
		} catch {
			if (!disposed && isActive()) {
				setStatus('error');
			}
		} finally {
			saving = false;
		}
	}

	const schedule = (): void => {
		if (!isActive()) {
			return;
		}
		const now = Date.now();
		firstDirtyAt ??= now;
		const delay = nextAutosaveDelayMs({
			intervalMs: deps.getIntervalMs(),
			firstDirtyAt,
			now,
		});
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void runSave();
		}, delay);
	};

	const maybeProbeRecovery = (state: ViewerState): void => {
		if (
			disposed ||
			!shouldProbeAutosaveRecovery({
				alreadyChecked: recoveryChecked,
				filePath: deps.filePath,
				loading: state.loading,
				error: state.error,
				slideCount: state.slides.length,
				autosaveAllowed: deps.isRecoveryAllowed?.() ?? true,
			})
		) {
			return;
		}
		recoveryChecked = true;
		void probeAutosaveRecovery(deps.filePath).then((offer) => {
			if (offer && !disposed) {
				deps.onRecovery?.(offer.record);
				deps.onRecoveryOffer?.(offer);
			}
			return offer;
		});
	};

	/** Apply an activation flip (host prop, user toggle, or edit-ability). */
	const syncActivation = (): void => {
		const next = isActive();
		if (next === active || disposed) {
			return;
		}
		active = next;
		clearTimer();
		setStatus('idle');
		if (next) {
			firstDirtyAt = null;
			if (store.get().dirty) {
				schedule();
			}
		}
	};

	// Only local edits set `dirty` (loads and remote collaboration applies do
	// not), so keying autosave on the dirty flag avoids re-persisting a deck the
	// user just opened.
	const unsubscribe = store.subscribe((state, previous) => {
		syncActivation();
		// A fresh load is a fresh deck: it gets its own recovery probe.
		if (state.loading && !previous.loading) {
			recoveryChecked = false;
		}
		if (state.dirty && (state.dirty !== previous.dirty || state.slides !== previous.slides)) {
			schedule();
		} else if (!state.dirty && previous.dirty && !saving) {
			// A manual save cleared the dirty flag: reflect it in the indicator.
			setStatus('saved');
		}
		maybeProbeRecovery(state);
	});

	// A deck may already be open when the controller is built (a host that
	// re-created it after a load, for instance).
	maybeProbeRecovery(store.get());

	return {
		saveNow: runSave,
		getStatus: () => status,
		refresh: syncActivation,
		isEnabled: isActive,
		destroy() {
			disposed = true;
			clearTimer();
			unsubscribe();
		},
	};
}
