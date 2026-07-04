/**
 * IndexedDB-backed autosave recovery store, shared by every binding.
 *
 * Extracted from the React `useAutosave` hook so Vue/Angular reuse the same
 * database (`pptx-viewer-autosave` / `recoveryVersions`) instead of each
 * binding growing its own copy. Records are keyed by the host-supplied file
 * path; on quota exhaustion the oldest record is evicted and the write is
 * retried once.
 */

export const AUTOSAVE_DB_NAME = 'pptx-viewer-autosave';
export const AUTOSAVE_DB_VERSION = 1;
export const AUTOSAVE_STORE_NAME = 'recoveryVersions';

/** Default autosave interval in seconds. */
export const AUTOSAVE_DEFAULT_INTERVAL_SECONDS = 120;

/** Minimum allowed autosave interval in seconds. */
export const AUTOSAVE_MIN_INTERVAL_SECONDS = 10;

/** Clamp a user-supplied interval (seconds) and convert to milliseconds. */
export function autosaveIntervalMs(intervalSeconds: number): number {
	return Math.max(intervalSeconds, AUTOSAVE_MIN_INTERVAL_SECONDS) * 1000;
}

export function openAutosaveDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(AUTOSAVE_DB_NAME, AUTOSAVE_DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(AUTOSAVE_STORE_NAME)) {
				db.createObjectStore(AUTOSAVE_STORE_NAME, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/** Delete the oldest entry in the autosave store. Returns true if one was removed. */
export async function deleteOldestAutosaveEntry(): Promise<boolean> {
	const db = await openAutosaveDb();
	return new Promise((resolve) => {
		try {
			const tx = db.transaction(AUTOSAVE_STORE_NAME, 'readwrite');
			const store = tx.objectStore(AUTOSAVE_STORE_NAME);
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
				const tx = db.transaction(AUTOSAVE_STORE_NAME, 'readwrite');
				const store = tx.objectStore(AUTOSAVE_STORE_NAME);
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

/**
 * Persist a recovery snapshot. On QuotaExceededError the oldest record is
 * dropped and the write retried once.
 */
export async function saveAutosaveSnapshot(filePath: string, data: Uint8Array): Promise<boolean> {
	try {
		return await putAutosaveRecord(filePath, data);
	} catch (err) {
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
