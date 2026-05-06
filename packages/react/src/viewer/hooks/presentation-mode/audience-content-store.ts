/**
 * audience-content-store — IndexedDB-based storage for sharing PPTX content
 * between the presenter tab and audience tab.
 *
 * When the presenter opens an audience window, the PPTX bytes are stored in
 * IndexedDB. The audience tab retrieves them on load and then cleans up.
 */

const DB_NAME = 'pptx-viewer-audience';
const DB_VERSION = 1;
const STORE_NAME = 'content';
const CONTENT_KEY = 'pptx-bytes';

/** Maximum age (ms) for stored audience content. Older records are rejected. */
const MAX_CONTENT_AGE_MS = 5 * 60 * 1000;

interface AudienceContentRecord {
	bytes: Uint8Array;
	createdAt: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store PPTX content bytes so the audience tab can retrieve them.
 * Called by the presenter before opening the audience window.
 */
export async function storeAudienceContent(content: ArrayBuffer | Uint8Array): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		// Store as Uint8Array for consistent retrieval, wrapped with a timestamp.
		const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
		const record: AudienceContentRecord = { bytes, createdAt: Date.now() };
		store.put(record, CONTENT_KEY);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

/**
 * Load PPTX content bytes stored by the presenter tab.
 * Returns `null` if nothing is stored.
 */
export async function loadAudienceContent(): Promise<Uint8Array | null> {
	try {
		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const request = store.get(CONTENT_KEY);
			request.onsuccess = () => {
				db.close();
				const result = request.result;
				// New format: { bytes, createdAt } record with TTL check.
				if (result && typeof result === 'object' && 'bytes' in result && 'createdAt' in result) {
					const record = result as AudienceContentRecord;
					const age = Date.now() - record.createdAt;
					if (age > MAX_CONTENT_AGE_MS) {
						resolve(null);
						return;
					}
					const raw: unknown = record.bytes;
					if (raw instanceof Uint8Array) {
						resolve(raw);
					} else if (raw instanceof ArrayBuffer) {
						resolve(new Uint8Array(raw));
					} else {
						resolve(null);
					}
					return;
				}
				// Legacy format (raw bytes without timestamp) — reject for safety.
				resolve(null);
			};
			request.onerror = () => {
				db.close();
				reject(request.error);
			};
		});
	} catch {
		return null;
	}
}

/**
 * Remove stored audience content (cleanup).
 */
export async function clearAudienceContent(): Promise<void> {
	try {
		const db = await openDb();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			store.delete(CONTENT_KEY);
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				resolve(); // swallow errors on cleanup
			};
		});
	} catch {
		// Ignore cleanup errors
	}
}
