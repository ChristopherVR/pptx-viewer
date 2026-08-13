/**
 * session-restore: keep the deck a host app has open across a page refresh.
 *
 * A host (the demo apps, or any embedder) owns the bytes it hands to the
 * viewer, so a plain reload drops them and the user lands back on the file
 * dropzone with their presentation gone. This store remembers the open deck in
 * IndexedDB and hands it back on the next load.
 *
 * Scope is deliberately per-tab: the record is keyed by an id kept in
 * `sessionStorage`, which survives a reload but NOT a new tab. Refreshing
 * restores the deck this tab had open, while a second tab opened on the same
 * origin still starts on the landing page, and two tabs holding different decks
 * never steal each other's content.
 *
 * `restoreSessionDeck` additionally prefers a NEWER autosave snapshot for the
 * same file (see `./autosave-store`), so a refresh mid-edit comes back with the
 * edited deck rather than the pristine bytes that were first opened.
 *
 * Every operation is best-effort: a blocked IndexedDB, a partitioned
 * `sessionStorage`, or an exhausted quota degrades to "no restore", never to a
 * thrown error in the host.
 */

import { markAutosaveSnapshotConsumed } from './autosave-recovery';
import { getAutosaveSnapshot } from './autosave-store';
import { secureRandomToken } from './secure-random';

/** IndexedDB database name. Kept identical across bindings. */
const DB_NAME = 'pptx-viewer-session';
const DB_VERSION = 1;
const STORE_NAME = 'openDeck';

/** `sessionStorage` key holding this tab's id (survives reload, not a new tab). */
const TAB_ID_KEY = 'pptx-viewer-session-tab';

/** Records older than this are abandoned (the tab that wrote them is gone). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** A deck remembered for the current tab. */
export interface SessionDeck {
	/** File name the deck was opened under, used as the autosave key. */
	fileName: string;
	/** The presentation bytes. */
	data: Uint8Array;
	/** When these bytes were remembered (epoch ms). */
	timestamp: number;
}

interface SessionDeckRecord extends SessionDeck {
	key: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasIndexedDb(): boolean {
	return typeof indexedDB !== 'undefined';
}

/**
 * This tab's session id, or `null` when `sessionStorage` is unavailable (a
 * sandboxed iframe, or a browser with storage disabled).
 *
 * @param create Mint and persist an id when the tab does not have one yet.
 *   Reads pass `false` so a fresh tab never claims another tab's record.
 */
export function getSessionTabId(create = false): string | null {
	try {
		if (typeof sessionStorage === 'undefined') {
			return null;
		}
		const existing = sessionStorage.getItem(TAB_ID_KEY);
		if (existing) {
			return existing;
		}
		if (!create) {
			return null;
		}
		const id = secureRandomToken(12);
		sessionStorage.setItem(TAB_ID_KEY, id);
		return id;
	} catch {
		return null;
	}
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'key' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/** Normalise a stored `data` field back to bytes, or `null` if unusable. */
function toBytes(value: unknown): Uint8Array | null {
	if (value instanceof Uint8Array) {
		return value;
	}
	if (value instanceof ArrayBuffer) {
		return new Uint8Array(value);
	}
	return null;
}

/**
 * Write `record`, evicting other tabs' entries along the way: stale ones
 * always, every one of them when `dropOthers` is set (the quota-recovery pass).
 */
function writeRecord(record: SessionDeckRecord, dropOthers: boolean): Promise<boolean> {
	return openDb().then(
		(db) =>
			new Promise<boolean>((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, 'readwrite');
				const store = tx.objectStore(STORE_NAME);
				const cutoff = Date.now() - MAX_AGE_MS;
				const cursorReq = store.openCursor();
				cursorReq.onsuccess = () => {
					const cursor = cursorReq.result;
					if (!cursor) {
						return;
					}
					const value = cursor.value as Partial<SessionDeckRecord>;
					const stale = typeof value.timestamp !== 'number' || value.timestamp < cutoff;
					if (value.key !== record.key && (dropOthers || stale)) {
						cursor.delete();
					}
					cursor.continue();
				};
				store.put(record);
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remember `data` as the deck this tab has open, so the next load can restore
 * it. Resolves `false` when the browser refused to store it; callers treat that
 * as "no restore available later", never as an error.
 */
export async function rememberSessionDeck(fileName: string, data: Uint8Array): Promise<boolean> {
	const key = getSessionTabId(true);
	if (!key || !hasIndexedDb() || data.byteLength === 0) {
		return false;
	}
	// Copy: the caller's view may be a slice of a larger buffer, and structured
	// clone would then persist the whole backing store.
	const record: SessionDeckRecord = {
		key,
		fileName,
		data: new Uint8Array(data),
		timestamp: Date.now(),
	};
	try {
		return await writeRecord(record, false);
	} catch (err) {
		const name = err instanceof Error || err instanceof DOMException ? err.name : '';
		if (name !== 'QuotaExceededError') {
			return false;
		}
		try {
			// Second pass drops every other tab's deck, then retries once.
			return await writeRecord(record, true);
		} catch {
			return false;
		}
	}
}

/** The deck remembered for this tab, or `null` when there is nothing to restore. */
export async function loadSessionDeck(): Promise<SessionDeck | null> {
	const key = getSessionTabId(false);
	if (!key || !hasIndexedDb()) {
		return null;
	}
	try {
		const db = await openDb();
		const record = await new Promise<Partial<SessionDeckRecord> | undefined>((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readonly');
			const request = tx.objectStore(STORE_NAME).get(key);
			request.onsuccess = () => {
				db.close();
				resolve(request.result as Partial<SessionDeckRecord> | undefined);
			};
			request.onerror = () => {
				db.close();
				resolve(undefined);
			};
		});
		if (!record) {
			return null;
		}
		const data = toBytes(record.data);
		const timestamp = typeof record.timestamp === 'number' ? record.timestamp : 0;
		if (!data || data.byteLength === 0 || Date.now() - timestamp > MAX_AGE_MS) {
			return null;
		}
		return {
			fileName: typeof record.fileName === 'string' ? record.fileName : '',
			data,
			timestamp,
		};
	} catch {
		return null;
	}
}

/** Forget this tab's deck (the host closed it, or handed the tab to another flow). */
export async function forgetSessionDeck(): Promise<void> {
	const key = getSessionTabId(false);
	if (!key || !hasIndexedDb()) {
		return;
	}
	try {
		const db = await openDb();
		await new Promise<void>((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).delete(key);
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
		// Best-effort cleanup.
	}
}

/**
 * The deck to reopen on load: this tab's remembered bytes, upgraded to a newer
 * autosave snapshot of the same file when the viewer wrote one after they were
 * remembered. Without that upgrade a refresh mid-edit would silently roll the
 * presentation back to the state it was opened in.
 */
export async function restoreSessionDeck(): Promise<SessionDeck | null> {
	const deck = await loadSessionDeck();
	if (!deck?.fileName) {
		return deck;
	}
	try {
		const snapshot = await getAutosaveSnapshot(deck.fileName);
		const bytes = snapshot ? toBytes(snapshot.data) : null;
		if (snapshot && bytes && bytes.byteLength > 0 && snapshot.timestamp > deck.timestamp) {
			// The host is taking delivery of this snapshot, so the viewer must not
			// also offer to "recover" the very bytes it is about to be handed. See
			// `./autosave-recovery`, which reads the same per-tab marker.
			markAutosaveSnapshotConsumed(snapshot.timestamp);
			return { fileName: deck.fileName, data: bytes, timestamp: snapshot.timestamp };
		}
	} catch {
		// Autosave store unavailable: the remembered bytes still stand.
	}
	return deck;
}
