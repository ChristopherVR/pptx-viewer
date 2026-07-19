/**
 * IndexedDB backend for {@link createChatHistoryStore}. Kept in its own module
 * so the localStorage fallback and the public factory stay within the per-file
 * size budget. Uses the raw IndexedDB API with tiny promise wrappers so no new
 * runtime dependency is pulled in.
 *
 * Every browser global is touched lazily from inside a function, never at module
 * load, so importing this file in a non-DOM environment (Node, SSR) never throws.
 */

import type { ChatBackend, PptxAiChatSummary, PptxAiStoredChat } from './chat-history-store';
import { toChatSummary } from './chat-history-store';

/** Object store holding one record per chat, keyed by `id`. */
export const CHAT_STORE = 'chats';
/** Index over the optional `deckId` key path, used for per-deck filtering. */
const DECK_INDEX = 'deckId';

/** Resolve an `IDBRequest` to a promise. */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

/** Resolve when a transaction commits (or reject on error/abort). */
function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
	});
}

/**
 * Open (and if needed create/upgrade) the chat database. Throws when there is no
 * `indexedDB` global so the caller can transparently fall back to localStorage.
 */
export function openChatDb(dbName: string): Promise<IDBDatabase> {
	const idb = typeof indexedDB !== 'undefined' ? indexedDB : undefined;
	if (!idb) {
		throw new Error('IndexedDB is not available in this environment.');
	}
	return new Promise<IDBDatabase>((resolve, reject) => {
		const open = idb.open(dbName, 1);
		open.onupgradeneeded = () => {
			const db = open.result;
			if (!db.objectStoreNames.contains(CHAT_STORE)) {
				const store = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
				store.createIndex(DECK_INDEX, 'deckId', { unique: false });
			}
		};
		open.onsuccess = () => resolve(open.result);
		open.onerror = () => reject(open.error ?? new Error('Failed to open IndexedDB.'));
		open.onblocked = () => reject(new Error('IndexedDB open blocked by another connection.'));
	});
}

/** Read every stored chat (newest-first ordering is applied by the caller). */
async function readAll(db: IDBDatabase, deckId: string | undefined): Promise<PptxAiStoredChat[]> {
	const tx = db.transaction(CHAT_STORE, 'readonly');
	const store = tx.objectStore(CHAT_STORE);
	const source =
		deckId === undefined
			? store.getAll()
			: store.index(DECK_INDEX).getAll(IDBKeyRange.only(deckId));
	const rows = await requestToPromise<PptxAiStoredChat[]>(source);
	await transactionDone(tx);
	return rows;
}

/** Create an IndexedDB-backed {@link ChatBackend}. */
export function createIdbBackend(db: IDBDatabase): ChatBackend {
	return {
		async list(deckId: string | undefined): Promise<PptxAiChatSummary[]> {
			const rows = await readAll(db, deckId);
			return rows.map(toChatSummary).sort((a, b) => b.updatedAt - a.updatedAt);
		},
		async load(id: string): Promise<PptxAiStoredChat | null> {
			const tx = db.transaction(CHAT_STORE, 'readonly');
			const row = await requestToPromise<PptxAiStoredChat | undefined>(
				tx.objectStore(CHAT_STORE).get(id),
			);
			await transactionDone(tx);
			return row ?? null;
		},
		async save(chat: PptxAiStoredChat): Promise<void> {
			const tx = db.transaction(CHAT_STORE, 'readwrite');
			tx.objectStore(CHAT_STORE).put(chat);
			await transactionDone(tx);
		},
		async remove(id: string): Promise<void> {
			const tx = db.transaction(CHAT_STORE, 'readwrite');
			tx.objectStore(CHAT_STORE).delete(id);
			await transactionDone(tx);
		},
		async clear(deckId: string | undefined): Promise<void> {
			const tx = db.transaction(CHAT_STORE, 'readwrite');
			const store = tx.objectStore(CHAT_STORE);
			if (deckId === undefined) {
				store.clear();
			} else {
				const ids = await requestToPromise<IDBValidKey[]>(
					store.index(DECK_INDEX).getAllKeys(IDBKeyRange.only(deckId)),
				);
				for (const id of ids) {
					store.delete(id);
				}
			}
			await transactionDone(tx);
		},
	};
}
