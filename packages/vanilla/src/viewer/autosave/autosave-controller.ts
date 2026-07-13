import type { PptxHandler } from 'pptx-viewer-core';
import type { AutosaveRecord } from 'pptx-viewer-shared';
import { getAutosaveSnapshot, saveAutosaveSnapshot } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';

/**
 * Debounced autosave for the vanilla viewer, layered on the shared IndexedDB
 * recovery store (`pptx-viewer-shared/autosave-store`).
 *
 * Semantics mirror the React/Vue bindings: a local edit marks the document
 * dirty; a debounce timer then re-serializes the deck through
 * `PptxHandler.save` and persists it under `filePath` via
 * `saveAutosaveSnapshot` (evicting the oldest record on quota exhaustion). The
 * recovery blob is a crash-safety net only; it never clears the editor's dirty
 * flag or stands in for the user's real Save.
 *
 * On construction it probes `getAutosaveSnapshot(filePath)` and, when a snapshot
 * from a previous session exists, offers it back through `onRecovery` so the
 * host can decide whether to restore it (e.g. via `loadFile`).
 */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveControllerDeps {
	store: Store<ViewerState>;
	/** Live core handler used to serialize the current slides to `.pptx` bytes. */
	getHandler: () => PptxHandler | null;
	/** IndexedDB key for the recovery snapshot (usually the open file's name). */
	filePath: string;
	/** Debounce window (ms) between the last edit and the persisted snapshot. */
	intervalMs: number;
	/** Surface status transitions (toolbar indicator + optional host callback). */
	onStatus?: (status: AutosaveStatus) => void;
	/** Offered any recovery snapshot found for `filePath` on construction. */
	onRecovery?: (record: AutosaveRecord) => void;
	/** Whether recovery autosave starts enabled. */
	enabled?: boolean;
}

export interface AutosaveController {
	/** Force an immediate snapshot, bypassing the debounce window. */
	saveNow(): Promise<void>;
	/** Current status. */
	getStatus(): AutosaveStatus;
	/** Enable or disable future debounced snapshots. */
	setEnabled(enabled: boolean): void;
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
	let enabled = deps.enabled ?? true;
	let recoveryChecked = false;

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
		if (disposed || !enabled || saving || !handler || !store.get().dirty) {
			return;
		}
		saving = true;
		setStatus('saving');
		try {
			const bytes = await handler.save(store.get().slides);
			await saveAutosaveSnapshot(deps.filePath, bytes);
			if (!disposed && enabled) {
				setStatus('saved');
			}
		} catch {
			if (!disposed && enabled) {
				setStatus('error');
			}
		} finally {
			saving = false;
		}
	}

	const schedule = (): void => {
		if (!enabled) {
			return;
		}
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void runSave();
		}, deps.intervalMs);
	};

	// Only local edits set `dirty` (loads and remote collaboration applies do
	// not), so keying autosave on the dirty flag avoids re-persisting a deck the
	// user just opened.
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.dirty && (state.dirty !== previous.dirty || state.slides !== previous.slides)) {
			schedule();
		} else if (!state.dirty && previous.dirty && !saving) {
			// A manual save cleared the dirty flag: reflect it in the indicator.
			setStatus('saved');
		}
	});

	const offerRecovery = (): void => {
		if (recoveryChecked || !enabled) {
			return;
		}
		recoveryChecked = true;
		void getAutosaveSnapshot(deps.filePath).then((record) => {
			if (record && !disposed && enabled) {
				deps.onRecovery?.(record);
			}
			return record;
		});
	};
	offerRecovery();

	return {
		saveNow: runSave,
		getStatus: () => status,
		setEnabled(next) {
			if (enabled === next || disposed) {
				return;
			}
			enabled = next;
			clearTimer();
			setStatus('idle');
			if (enabled) {
				offerRecovery();
				if (store.get().dirty) {
					schedule();
				}
			}
		},
		isEnabled: () => enabled,
		destroy() {
			disposed = true;
			clearTimer();
			unsubscribe();
		},
	};
}
