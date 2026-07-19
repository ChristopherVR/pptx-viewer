/**
 * audience-content-store: IndexedDB-based storage for sharing PPTX content
 * between the presenter tab and audience tab.
 *
 * When the presenter opens an audience window, the PPTX bytes are stored in
 * IndexedDB. The audience tab retrieves them on load and then cleans up.
 *
 * Framework-agnostic: every binding (React/Vue/Angular) re-exports these
 * symbols through a thin shim. The database, store, and key names are kept
 * identical across bindings so the cross-tab handoff stays wire-compatible
 * regardless of which binding opened the presenter window or renders the
 * audience tab.
 */

import {
	clearPresentationDeck,
	loadPresentationDeck,
	parsePresentationSessionId,
	storePresentationDeck,
} from './presentation-session';

/** IndexedDB database name. Must match every binding exactly. */
const DB_NAME = 'pptx-viewer-audience';
const DB_VERSION = 1;
const STORE_NAME = 'content';
const CONTENT_KEY = 'pptx-bytes';

/** URL hash that marks the current tab as the audience display. */
export const AUDIENCE_HASH = '#pptx-audience';

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

/** Returns true if the current page was opened as an audience tab. */
export function isAudienceTab(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	return window.location.hash.startsWith(AUDIENCE_HASH);
}

/**
 * Parse the session nonce from the current page URL hash. Returns `null` if the
 * hash is not in the expected `#pptx-audience&nonce=<uuid>` form.
 */
export function parseAudienceNonce(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	return parsePresentationSessionId(window.location.hash);
}

/**
 * Store PPTX content bytes so the audience tab can retrieve them.
 * Called by the presenter before opening the audience window.
 */
export async function storeAudienceContent(
	content: ArrayBuffer | Uint8Array,
	sessionId?: string,
): Promise<void> {
	if (sessionId) {
		return storePresentationDeck(sessionId, content);
	}
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
export async function loadAudienceContent(sessionId?: string): Promise<Uint8Array | null> {
	if (sessionId) {
		return loadPresentationDeck(sessionId);
	}
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
				// Legacy format (raw bytes without timestamp): reject for safety.
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
export async function clearAudienceContent(sessionId?: string): Promise<void> {
	if (sessionId) {
		return clearPresentationDeck(sessionId);
	}
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
