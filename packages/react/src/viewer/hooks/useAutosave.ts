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
}

export interface UseAutosaveResult {
	/** Current autosave status for display in the StatusBar. */
	autosaveStatus: AutosaveStatus;
	/** Manually trigger an autosave right now. */
	triggerAutosave: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// IndexedDB-based autosave storage
// ---------------------------------------------------------------------------

const DB_NAME = 'pptx-viewer-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'recoveryVersions';

function openAutosaveDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function saveToIndexedDb(filePath: string, data: Uint8Array): Promise<boolean> {
	const db = await openAutosaveDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		store.put({
			key: filePath,
			data,
			timestamp: Date.now(),
			size: data.byteLength,
		});
		tx.oncomplete = () => {
			db.close();
			resolve(true);
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAutosave(input: UseAutosaveInput): UseAutosaveResult {
	const {
		isDirty,
		filePath,
		serializeSlides,
		intervalSeconds = DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
		enabled = true,
	} = input;

	const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>({
		state: 'idle',
	});

	// Refs to avoid stale closures in the interval callback.
	const isDirtyRef = useRef(isDirty);
	const filePathRef = useRef(filePath);
	const serializeRef = useRef(serializeSlides);
	const isSavingRef = useRef(false);

	useEffect(() => {
		isDirtyRef.current = isDirty;
	}, [isDirty]);
	useEffect(() => {
		filePathRef.current = filePath;
	}, [filePath]);
	useEffect(() => {
		serializeRef.current = serializeSlides;
	}, [serializeSlides]);

	// ── Core save logic ─────────────────────────────────────────────
	const doAutosave = useCallback(async () => {
		if (!filePathRef.current) {
			return;
		}
		if (!isDirtyRef.current) {
			return;
		}
		if (isSavingRef.current) {
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

			await saveToIndexedDb(filePathRef.current, data);
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
		if (!enabled || !filePath) {
			return;
		}

		const ms = computeAutosaveIntervalMs(intervalSeconds);
		const id = setInterval(() => {
			void doAutosave();
		}, ms);

		return () => clearInterval(id);
	}, [enabled, filePath, intervalSeconds, doAutosave]);

	return {
		autosaveStatus,
		triggerAutosave: doAutosave,
	};
}
