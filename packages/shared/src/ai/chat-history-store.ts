/**
 * Persistent chat-history store for the AI assistant panel.
 *
 * The store is IndexedDB-first: {@link createChatHistoryStore} opens IndexedDB
 * on first use and, when that global is missing or fails to open (private mode,
 * blocked, or a non-DOM environment), transparently falls back to localStorage.
 * Both backends expose the identical {@link PptxAiChatStore} surface so callers
 * never branch on which one is live.
 *
 * All browser globals are read lazily from inside methods, so importing this
 * module in Node (SSR / tests) never throws.
 */

import type { PptxAiUIMessage } from './config';

/** A chat conversation persisted for later resumption. */
export interface PptxAiStoredChat {
	/** Stable id (also the storage key). */
	id: string;
	/** Human-readable title (usually derived from the first user message). */
	title: string;
	/** Deck this chat is scoped to, when known. Enables per-deck listing. */
	deckId?: string;
	/** Full UI-message transcript. */
	messages: PptxAiUIMessage[];
	/** Epoch ms when first saved. */
	createdAt: number;
	/** Epoch ms of the most recent save. */
	updatedAt: number;
}

/** Lightweight listing entry (no message bodies) for the history sidebar. */
export interface PptxAiChatSummary {
	id: string;
	title: string;
	deckId?: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
}

/** Storage-agnostic chat history API. */
export interface PptxAiChatStore {
	/** List chat summaries newest-first, optionally filtered by deck. */
	listChats(opts?: { deckId?: string }): Promise<PptxAiChatSummary[]>;
	/** Load one full chat, or null when it does not exist. */
	loadChat(id: string): Promise<PptxAiStoredChat | null>;
	/** Upsert a chat. Always refreshes `updatedAt` (and `createdAt` if unset). */
	saveChat(chat: PptxAiStoredChat): Promise<void>;
	/** Delete one chat by id (no-op when absent). */
	deleteChat(id: string): Promise<void>;
	/** Delete every chat, or every chat for one deck when `deckId` is given. */
	clearChats(opts?: { deckId?: string }): Promise<void>;
}

/**
 * Internal backend contract shared by the IndexedDB and localStorage
 * implementations. The public store wraps this with opts unwrapping + timestamp
 * normalisation so both backends behave identically.
 */
export interface ChatBackend {
	list(deckId: string | undefined): Promise<PptxAiChatSummary[]>;
	load(id: string): Promise<PptxAiStoredChat | null>;
	save(chat: PptxAiStoredChat): Promise<void>;
	remove(id: string): Promise<void>;
	clear(deckId: string | undefined): Promise<void>;
}

/** Derive a summary (no message bodies) from a full stored chat. */
export function toChatSummary(chat: PptxAiStoredChat): PptxAiChatSummary {
	return {
		id: chat.id,
		title: chat.title,
		deckId: chat.deckId,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		messageCount: chat.messages.length,
	};
}

/** Minimal `Storage` surface this module relies on (matches DOM `localStorage`). */
interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** Read the localStorage global, or throw when it is unavailable. */
function getLocalStorage(): KeyValueStore {
	const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
	if (!ls) {
		throw new Error('localStorage is not available in this environment.');
	}
	return ls;
}

/** Create a localStorage-backed {@link ChatBackend} under a key namespace. */
export function createLocalStorageBackend(namespace: string): ChatBackend {
	const indexKey = `${namespace}:index`;
	const chatKey = (id: string): string => `${namespace}:chat:${id}`;

	const readIndex = (ls: KeyValueStore): string[] => {
		const raw = ls.getItem(indexKey);
		if (!raw) {
			return [];
		}
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as string[]) : [];
		} catch {
			return [];
		}
	};
	const readChat = (ls: KeyValueStore, id: string): PptxAiStoredChat | null => {
		const raw = ls.getItem(chatKey(id));
		if (!raw) {
			return null;
		}
		try {
			return JSON.parse(raw) as PptxAiStoredChat;
		} catch {
			return null;
		}
	};

	return {
		async list(deckId: string | undefined): Promise<PptxAiChatSummary[]> {
			const ls = getLocalStorage();
			const summaries: PptxAiChatSummary[] = [];
			for (const id of readIndex(ls)) {
				const chat = readChat(ls, id);
				if (chat && (deckId === undefined || chat.deckId === deckId)) {
					summaries.push(toChatSummary(chat));
				}
			}
			return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
		},
		async load(id: string): Promise<PptxAiStoredChat | null> {
			return readChat(getLocalStorage(), id);
		},
		async save(chat: PptxAiStoredChat): Promise<void> {
			const ls = getLocalStorage();
			const ids = readIndex(ls);
			if (!ids.includes(chat.id)) {
				ids.push(chat.id);
				ls.setItem(indexKey, JSON.stringify(ids));
			}
			ls.setItem(chatKey(chat.id), JSON.stringify(chat));
		},
		async remove(id: string): Promise<void> {
			const ls = getLocalStorage();
			const ids = readIndex(ls).filter((existing) => existing !== id);
			ls.setItem(indexKey, JSON.stringify(ids));
			ls.removeItem(chatKey(id));
		},
		async clear(deckId: string | undefined): Promise<void> {
			const ls = getLocalStorage();
			const ids = readIndex(ls);
			const keep: string[] = [];
			for (const id of ids) {
				const chat = readChat(ls, id);
				if (deckId !== undefined && chat && chat.deckId !== deckId) {
					keep.push(id);
				} else {
					ls.removeItem(chatKey(id));
				}
			}
			ls.setItem(indexKey, JSON.stringify(keep));
		},
	};
}

/** Try IndexedDB first; fall back to localStorage on any failure. */
async function resolveBackend(dbName: string, namespace: string): Promise<ChatBackend> {
	try {
		const { openChatDb, createIdbBackend } = await import('./chat-history-idb');
		const db = await openChatDb(dbName);
		return createIdbBackend(db);
	} catch {
		return createLocalStorageBackend(namespace);
	}
}

/**
 * Create a persistent chat store. IndexedDB is preferred; localStorage is the
 * transparent fallback. The backend is chosen once, lazily, on the first call.
 *
 * @param options.dbName - IndexedDB database name (default `pptx-ai-chats`).
 * @param options.namespace - localStorage key prefix (default: `dbName`).
 */
export function createChatHistoryStore(options?: {
	dbName?: string;
	namespace?: string;
}): PptxAiChatStore {
	const dbName = options?.dbName ?? 'pptx-ai-chats';
	const namespace = options?.namespace ?? dbName;
	let backendPromise: Promise<ChatBackend> | null = null;
	const backend = (): Promise<ChatBackend> => {
		backendPromise ??= resolveBackend(dbName, namespace);
		return backendPromise;
	};

	return {
		async listChats(opts?: { deckId?: string }): Promise<PptxAiChatSummary[]> {
			return (await backend()).list(opts?.deckId);
		},
		async loadChat(id: string): Promise<PptxAiStoredChat | null> {
			return (await backend()).load(id);
		},
		async saveChat(chat: PptxAiStoredChat): Promise<void> {
			const now = Date.now();
			const normalized: PptxAiStoredChat = {
				...structuredClone(chat),
				createdAt: chat.createdAt || now,
				updatedAt: now,
			};
			await (await backend()).save(normalized);
		},
		async deleteChat(id: string): Promise<void> {
			await (await backend()).remove(id);
		},
		async clearChats(opts?: { deckId?: string }): Promise<void> {
			await (await backend()).clear(opts?.deckId);
		},
	};
}
