import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createChatHistoryStore } from './chat-history-store';
import type { PptxAiStoredChat } from './chat-history-store';
import type { PptxAiUIMessage } from './config';

/**
 * The chat store is IndexedDB-first with a transparent localStorage fallback.
 * The SAME behavioural suite runs against both backends: the IDB case provides a
 * fake `indexedDB`; the fallback case removes it and installs a localStorage
 * stub, forcing `resolveBackend` down the catch path. Identical assertions in
 * both prove the two backends are interchangeable.
 */

type GlobalWithStorage = typeof globalThis & {
	indexedDB?: IDBFactory;
	IDBKeyRange?: typeof IDBKeyRange;
	localStorage?: Storage;
};

const g = globalThis as GlobalWithStorage;

/** Minimal in-memory localStorage stub (only the methods the store uses). */
function makeLocalStorageStub(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k: string) => map.get(k) ?? null,
		key: (i: number) => [...map.keys()][i] ?? null,
		removeItem: (k: string) => {
			map.delete(k);
		},
		setItem: (k: string, v: string) => {
			map.set(k, String(v));
		},
	};
}

function message(id: string, text: string): PptxAiUIMessage {
	return { id, role: 'user', parts: [{ type: 'text', text }] } as unknown as PptxAiUIMessage;
}

function chat(id: string, deckId?: string, messages: PptxAiUIMessage[] = []): PptxAiStoredChat {
	return { id, title: `Chat ${id}`, deckId, messages, createdAt: 0, updatedAt: 0 };
}

interface BackendCase {
	name: string;
	install(): void;
}

const cases: BackendCase[] = [
	{
		name: 'indexeddb',
		install() {
			g.indexedDB = new IDBFactory();
			g.IDBKeyRange = IDBKeyRange;
			delete g.localStorage;
		},
	},
	{
		name: 'localStorage fallback',
		install() {
			delete g.indexedDB;
			delete g.IDBKeyRange;
			g.localStorage = makeLocalStorageStub();
		},
	},
];

describe.each(cases)('chat history store ($name)', ({ install }) => {
	let now = 1_000;

	beforeEach(() => {
		install();
		now = 1_000;
		// Deterministic, strictly-increasing timestamps so ordering is stable.
		vi.spyOn(Date, 'now').mockImplementation(() => (now += 1));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('saves, lists (newest-first), loads, deletes, and clears', async () => {
		const store = createChatHistoryStore({ dbName: 'test-db', namespace: 'test-ns' });

		await store.saveChat(chat('a'));
		await store.saveChat(chat('b'));
		await store.saveChat(chat('c'));

		let list = await store.listChats();
		expect(list.map((s) => s.id)).toStrictEqual(['c', 'b', 'a']);

		// Re-saving 'a' bumps its updatedAt, moving it to the front.
		await store.saveChat(chat('a'));
		list = await store.listChats();
		expect(list.map((s) => s.id)).toStrictEqual(['a', 'c', 'b']);

		const loaded = await store.loadChat('b');
		expect(loaded?.id).toBe('b');
		expect(loaded?.title).toBe('Chat b');

		await store.deleteChat('b');
		await expect(store.loadChat('b')).resolves.toBeNull();
		expect((await store.listChats()).map((s) => s.id)).toStrictEqual(['a', 'c']);

		await store.clearChats();
		await expect(store.listChats()).resolves.toStrictEqual([]);
	});

	it('filters by deckId on list and clear', async () => {
		const store = createChatHistoryStore({ dbName: 'deck-db', namespace: 'deck-ns' });

		await store.saveChat(chat('d1a', 'deck-1'));
		await store.saveChat(chat('d2a', 'deck-2'));
		await store.saveChat(chat('d1b', 'deck-1'));
		await store.saveChat(chat('nodeck'));

		const deck1 = await store.listChats({ deckId: 'deck-1' });
		expect(deck1.map((s) => s.id).sort()).toStrictEqual(['d1a', 'd1b']);

		const deck2 = await store.listChats({ deckId: 'deck-2' });
		expect(deck2.map((s) => s.id)).toStrictEqual(['d2a']);

		// Clearing one deck leaves the others (and undeck-scoped chats) intact.
		await store.clearChats({ deckId: 'deck-1' });
		await expect(store.listChats({ deckId: 'deck-1' })).resolves.toStrictEqual([]);
		expect((await store.listChats()).map((s) => s.id).sort()).toStrictEqual(['d2a', 'nodeck']);
	});

	it('round-trips messages and sets timestamps + messageCount', async () => {
		const store = createChatHistoryStore({ dbName: 'msg-db', namespace: 'msg-ns' });
		const messages = [message('m1', 'Hello there'), message('m2', 'General Kenobi')];

		await store.saveChat(chat('conv', 'deck-x', messages));

		const summaries = await store.listChats();
		expect(summaries).toHaveLength(1);
		expect(summaries[0].messageCount).toBe(2);
		expect(summaries[0].createdAt).toBeGreaterThan(0);
		expect(summaries[0].updatedAt).toBeGreaterThanOrEqual(summaries[0].createdAt);

		const loaded = await store.loadChat('conv');
		expect(loaded?.messages).toStrictEqual(messages);
		expect(loaded?.deckId).toBe('deck-x');
	});
});
