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

/** Delete the oldest entry in the autosave store. Returns true if one was removed. */
async function deleteOldestAutosaveEntry(): Promise<boolean> {
	const db = await openAutosaveDb();
	return new Promise((resolve) => {
		try {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			let oldestKey: IDBValidKey | null = null;
			let oldestTimestamp = Infinity;
			const cursorReq = store.openCursor();
			cursorReq.onsuccess = () => {
				const cursor = cursorReq.result;
				if (cursor) {
					const value = cursor.value as { timestamp?: number };
					if (typeof value.timestamp === 'number' && value.timestamp < oldestTimestamp) {
						oldestTimestamp = value.timestamp;
						oldestKey = cursor.primaryKey;
					}
					cursor.continue();
				} else if (oldestKey !== null) {
					store.delete(oldestKey);
				}
			};
			tx.oncomplete = () => {
				db.close();
				resolve(oldestKey !== null);
			};
			tx.onerror = () => {
				db.close();
				resolve(false);
			};
		} catch {
			try {
				db.close();
			} catch {
				// Ignore
			}
			resolve(false);
		}
	});
}

function putAutosaveRecord(filePath: string, data: Uint8Array): Promise<boolean> {
	return openAutosaveDb().then(
		(db) =>
			new Promise<boolean>((resolve, reject) => {
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
			}),
	);
}

async function saveToIndexedDb(filePath: string, data: Uint8Array): Promise<boolean> {
	try {
		return await putAutosaveRecord(filePath, data);
	} catch (err) {
		// On QuotaExceededError, drop the oldest record and retry once.
		const errName = err instanceof Error || err instanceof DOMException ? err.name : '';
		if (errName !== 'QuotaExceededError') {
			throw err;
		}
		const deleted = await deleteOldestAutosaveEntry();
		if (!deleted) {
			throw err;
		}
		return putAutosaveRecord(filePath, data);
	}
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
