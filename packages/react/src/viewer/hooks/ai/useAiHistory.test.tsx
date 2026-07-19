// @vitest-environment happy-dom
import type {
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiStoredChat,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAiHistory } from './useAiHistory';
import type { UseAiHistoryResult } from './useAiHistory';

/** A synchronous in-memory chat store for deterministic tests. */
function memoryStore(): PptxAiChatStore {
	const chats = new Map<string, PptxAiStoredChat>();
	return {
		async listChats(opts): Promise<PptxAiChatSummary[]> {
			return [...chats.values()]
				.filter((c) => !opts?.deckId || c.deckId === opts.deckId)
				.sort((a, b) => b.updatedAt - a.updatedAt)
				.map((c) => ({
					id: c.id,
					title: c.title,
					deckId: c.deckId,
					createdAt: c.createdAt,
					updatedAt: c.updatedAt,
					messageCount: c.messages.length,
				}));
		},
		async loadChat(id) {
			return chats.get(id) ?? null;
		},
		async saveChat(chat) {
			chats.set(chat.id, { ...chat, updatedAt: Date.now() });
		},
		async deleteChat(id) {
			chats.delete(id);
		},
		async clearChats() {
			chats.clear();
		},
	};
}

function userMsg(text: string): PptxAiUIMessage {
	return {
		id: `u-${text}`,
		role: 'user',
		parts: [{ type: 'text', text }],
	} as unknown as PptxAiUIMessage;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** Mount useAiHistory over a mutable messages state, driven by the test. */
function mount(store: PptxAiChatStore): {
	api: () => UseAiHistoryResult;
	setMessages: (m: PptxAiUIMessage[]) => void;
	messages: () => PptxAiUIMessage[];
} {
	const captured: { api: UseAiHistoryResult | null; messages: PptxAiUIMessage[] } = {
		api: null,
		messages: [],
	};
	let setExternal: ((m: PptxAiUIMessage[]) => void) | null = null;

	function Probe(): null {
		const [messages, setMessages] = React.useState<PptxAiUIMessage[]>([]);
		setExternal = setMessages;
		captured.messages = messages;
		captured.api = useAiHistory({ deckId: 'deck-1', messages, setMessages, store });
		return null;
	}
	act(() => root.render(<Probe />));
	return {
		api: () => {
			if (!captured.api) {
				throw new Error('hook not captured');
			}
			return captured.api;
		},
		setMessages: (m) => act(() => setExternal?.(m)),
		messages: () => captured.messages,
	};
}

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

describe('useAiHistory', () => {
	it('debounce-saves the transcript and lists it under the deck', async () => {
		const store = memoryStore();
		const h = mount(store);

		h.setMessages([userMsg('Make the title bigger')]);
		await act(async () => {
			await delay(1000);
		});

		const chats = await store.listChats({ deckId: 'deck-1' });
		expect(chats).toHaveLength(1);
		expect(chats[0].title).toBe('Make the title bigger');
		expect(chats[0].messageCount).toBe(1);
	});

	it('resumes a stored chat into the transcript', async () => {
		const store = memoryStore();
		await store.saveChat({
			id: 'stored-1',
			title: 'Earlier chat',
			deckId: 'deck-1',
			messages: [userMsg('older question')],
			createdAt: Date.now() - 1000,
			updatedAt: Date.now() - 1000,
		});
		const h = mount(store);
		await act(async () => {
			await h.api().refresh();
		});

		await act(async () => {
			await h.api().resumeChat('stored-1');
		});
		expect(h.messages()).toHaveLength(1);
		expect(h.api().activeChatId).toBe('stored-1');
	});

	it('new chat clears the transcript and switches the active id', async () => {
		const store = memoryStore();
		const h = mount(store);
		h.setMessages([userMsg('something')]);
		const firstId = h.api().activeChatId;

		act(() => h.api().newChat());
		expect(h.messages()).toHaveLength(0);
		expect(h.api().activeChatId).not.toBe(firstId);
	});

	it('deletes a chat from the store', async () => {
		const store = memoryStore();
		await store.saveChat({
			id: 'del-1',
			title: 'to delete',
			deckId: 'deck-1',
			messages: [userMsg('x')],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});
		const h = mount(store);
		await act(async () => {
			await h.api().deleteChat('del-1');
		});
		await expect(store.loadChat('del-1')).resolves.toBeNull();
	});
});
