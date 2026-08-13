import {
	autosaveSnapshotMark,
	saveAutosaveSnapshot,
	shouldWriteAutosaveSnapshot,
} from 'pptx-viewer-shared';
import type { AutosaveSnapshotMark } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
	computeAutosaveIntervalMs,
	DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
} from './useAutosave-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutosaveStatus =
	| { state: 'idle' }
	| { state: 'disabled'; reason: string }
	| { state: 'saving' }
	| { state: 'saved'; timestamp: number }
	| { state: 'error'; message: string };

export interface UseAutosaveInput {
	/** Whether the document has unsaved changes. */
	isDirty: boolean;
	/** File path or name of the currently-open PPTX. Required for autosave to work. */
	filePath: string | undefined;
	/** Serialise current editor state to a Uint8Array. */
	serializeSlides: () => Promise<Uint8Array | null>;
	/** Autosave interval in seconds (default 120). */
	intervalSeconds?: number;
	/** Whether autosave is enabled. */
	enabled?: boolean;
	/**
	 * The values a snapshot is built from, read fresh on each tick.
	 *
	 * `isDirty` stays true from the first edit until the user performs a real
	 * save, so on its own it makes the timer re-serialize and rewrite an
	 * identical deck every N seconds forever. Vue, Svelte and Vanilla never had
	 * that problem because they debounce on the slides array being reassigned;
	 * this is the same trigger, and `shouldWriteAutosaveSnapshot` writes
	 * whenever it is unsure. Omit it and every tick writes, as before.
	 */
	getChangeSources?: () => readonly unknown[];
}

export interface UseAutosaveResult {
	/** Current autosave status for display in the StatusBar. */
	autosaveStatus: AutosaveStatus;
	/** Manually trigger an autosave right now. */
	triggerAutosave: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook (the IndexedDB store itself lives in pptx-viewer-shared)
// ---------------------------------------------------------------------------

export function useAutosave(input: UseAutosaveInput): UseAutosaveResult {
	const {
		isDirty,
		filePath,
		serializeSlides,
		intervalSeconds = DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
		enabled = true,
		getChangeSources,
	} = input;

	const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
		state: 'idle',
	});

	// Refs to avoid stale closures in the interval callback.
	const isDirtyRef = useRef(isDirty);
	const filePathRef = useRef(filePath);
	const serializeRef = useRef(serializeSlides);
	const isSavingRef = useRef(false);
	const changeSourcesRef = useRef(getChangeSources);
	const lastSnapshotRef = useRef<AutosaveSnapshotMark | undefined>(undefined);

	useEffect(() => {
		isDirtyRef.current = isDirty;
	}, [isDirty]);
	useEffect(() => {
		filePathRef.current = filePath;
	}, [filePath]);
	useEffect(() => {
		serializeRef.current = serializeSlides;
	}, [serializeSlides]);
	useEffect(() => {
		changeSourcesRef.current = getChangeSources;
	}, [getChangeSources]);

	// ── Core save logic ─────────────────────────────────────────────
	// `polled` distinguishes the interval from an explicit `triggerAutosave()`:
	// a poll may be skipped as redundant, a request never is. It is an options
	// object rather than a positional boolean so that wiring the trigger
	// straight to a DOM handler cannot smuggle an event in as `true`.
	const doAutosave = useCallback(async (options?: { polled?: boolean }) => {
		const path = filePathRef.current;
		if (!path) {
			return;
		}
		const sources = changeSourcesRef.current?.() ?? [];
		if (
			!shouldWriteAutosaveSnapshot({
				filePath: path,
				isDirty: isDirtyRef.current,
				saving: isSavingRef.current,
				sources: options?.polled === true ? sources : [],
				lastSnapshot: lastSnapshotRef.current,
			})
		) {
			return;
		}

		isSavingRef.current = true;
		setAutosaveStatus({ state: 'saving' });

		try {
			const data = await serializeRef.current();
			if (!data) {
				setAutosaveStatus({ state: 'idle' });
				isSavingRef.current = false;
				return;
			}

			await saveAutosaveSnapshot(path, data);
			// Mark AFTER the write, and from the sources read before it, so an
			// edit made while serialising is not mistaken for one already
			// captured: the next tick sees a different reference and writes.
			lastSnapshotRef.current = autosaveSnapshotMark(path, sources);
			setAutosaveStatus({ state: 'saved', timestamp: Date.now() });
		} catch (err) {
			setAutosaveStatus({
				state: 'error',
				message: err instanceof Error ? err.message : 'Autosave failed',
			});
		} finally {
			isSavingRef.current = false;
		}
	}, []);

	// ── Interval timer ──────────────────────────────────────────────
	useEffect(() => {
		if (!enabled) {
			setAutosaveStatus({ state: 'disabled', reason: 'autosave_toggle_off' });
			return;
		}
		if (!filePath) {
			setAutosaveStatus({
				state: 'disabled',
				reason: 'no_file_path',
			});
			return;
		}

		// Requirements met; reset to idle if currently disabled.
		setAutosaveStatus((prev) => (prev.state === 'disabled' ? { state: 'idle' } : prev));

		const ms = computeAutosaveIntervalMs(intervalSeconds);
		const id = setInterval(() => {
			void doAutosave({ polled: true });
		}, ms);

		return () => clearInterval(id);
	}, [enabled, filePath, intervalSeconds, doAutosave]);

	return {
		autosaveStatus,
		triggerAutosave: () => doAutosave(),
	};
}
