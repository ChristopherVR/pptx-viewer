/**
 * version-history-helpers.ts: IndexedDB access and formatting for the version-
 * history panel. Split out of the component so the DOM-free `formatFileSize`
 * formatter is unit testable and the IndexedDB plumbing (which mirrors the
 * autosave store) lives in one focused module.
 */

/** A single autosaved recovery snapshot. */
export interface RecoveryVersion {
	key: string;
	timestamp: number;
	size: number;
	data: Uint8Array;
}

const DB_NAME = 'pptx-viewer-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'recoveryVersions';

function openAutosaveDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);
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

/** Read the recovery snapshots stored for a given file path (empty on error). */
export async function getVersions(filePath: string): Promise<RecoveryVersion[]> {
	try {
		const db = await openAutosaveDb();
		return await new Promise<RecoveryVersion[]>((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const req = store.get(filePath);
			req.onsuccess = () => {
				db.close();
				const result = req.result as RecoveryVersion | undefined;
				resolve(result ? [result] : []);
			};
			req.onerror = () => {
				db.close();
				resolve([]);
			};
		});
	} catch {
		return [];
	}
}

/** Delete the recovery snapshot stored under `filePath` (best-effort). */
export async function deleteVersion(filePath: string): Promise<void> {
	try {
		const db = await openAutosaveDb();
		await new Promise<void>((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.delete(filePath);
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				resolve();
			};
		});
	} catch {
		// ignore
	}
}

/** Format a byte count as a human-readable size (B / KB / MB). */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
