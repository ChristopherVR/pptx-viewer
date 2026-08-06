import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createAiChatHistoryController,
	deriveChatTitle,
	newChatId,
} from './chat-history-controller';
import type { PptxAiChatStore, PptxAiStoredChat, PptxAiChatSummary } from './chat-history-store';
import { toChatSummary } from './chat-history-store';
import type { PptxAiUIMessage } from './config';

function userMessage(text: string, id = 'm1'): PptxAiUIMessage {
	return { id, role: 'user', parts: [{ type: 'text', text }] } as PptxAiUIMessage;
}

/** In-memory PptxAiChatStore. */
function fakeStore(): PptxAiChatStore & { records: Map<string, PptxAiStoredChat> } {
	const records = new Map<string, PptxAiStoredChat>();
	return {
		records,
		async listChats(opts?: { deckId?: string }): Promise<PptxAiChatSummary[]> {
			return [...records.values()]
				.filter((c) => opts?.deckId === undefined || c.deckId === opts.deckId)
				.sort((a, b) => b.updatedAt - a.updatedAt)
				.map(toChatSummary);
		},
		async loadChat(id: string): Promise<PptxAiStoredChat | null> {
			return records.get(id) ?? null;
		},
		async saveChat(chat: PptxAiStoredChat): Promise<void> {
			records.set(chat.id, structuredClone(chat));
		},
		async deleteChat(id: string): Promise<void> {
			records.delete(id);
		},
		async clearChats(): Promise<void> {
			records.clear();
		},
	};
}

describe('newChatId / deriveChatTitle', () => {
	it('generates chat-prefixed ids', () => {
		expect(newChatId()).toMatch(/^chat-[0-9a-z]+-[0-9a-z]{6}$/u);
	});

	it('derives the title from the first user message, truncated to 40 chars', () => {
		expect(deriveChatTitle([userMessage('Make the title bigger')])).toBe('Make the title bigger');
		const long = 'x'.repeat(60);
		expect(deriveChatTitle([userMessage(long)]).length).toBeLessThanOrEqual(41);
		expect(deriveChatTitle([])).toBe('');
	});
});

describe('createAiChatHistoryController', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function setup(messages: PptxAiUIMessage[] = []) {
		const store = fakeStore();
		let transcript = messages;
		const setMessages = vi.fn((next: PptxAiUIMessage[]) => {
			transcript = next;
		});
		const onChatsChanged = vi.fn();
		const controller = createAiChatHistoryController({
			deckId: 'deck-1',
			store,
			getMessages: () => transcript,
			setMessages,
			onChatsChanged,
		});
		return {
			store,
			controller,
			setMessages,
			onChatsChanged,
			setTranscript: (next: PptxAiUIMessage[]) => {
				transcript = next;
			},
		};
	}

	it('lists the deck chats on creation', async () => {
		const store = fakeStore();
		await store.saveChat({
			id: 'c1',
			title: 'Old chat',
			deckId: 'deck-1',
			messages: [userMessage('hi')],
			createdAt: 1,
			updatedAt: 2,
		});
		await store.saveChat({
			id: 'other',
			title: 'Other deck',
			deckId: 'deck-2',
			messages: [userMessage('yo')],
			createdAt: 1,
			updatedAt: 2,
		});
		const onChatsChanged = vi.fn();
		const controller = createAiChatHistoryController({
			deckId: 'deck-1',
			store,
			getMessages: () => [],
			setMessages: () => undefined,
			onChatsChanged,
		});
		await vi.runAllTimersAsync();
		expect(controller.chats().map((c) => c.id)).toStrictEqual(['c1']);
		expect(onChatsChanged).toHaveBeenCalledWith([expect.objectContaining({ id: 'c1' })]);
	});

	it('debounce-saves the transcript 800ms after a change, skipping empty ones', async () => {
		const ctx = setup();
		ctx.controller.notifyMessagesChanged();
		await vi.advanceTimersByTimeAsync(1000);
		expect(ctx.store.records.size).toBe(0);

		ctx.setTranscript([userMessage('Resize the chart please')]);
		ctx.controller.notifyMessagesChanged();
		await vi.advanceTimersByTimeAsync(799);
		expect(ctx.store.records.size).toBe(0);
		await vi.advanceTimersByTimeAsync(2);
		await vi.runAllTimersAsync();
		expect(ctx.store.records.size).toBe(1);
		const saved = [...ctx.store.records.values()][0];
		expect(saved.title).toBe('Resize the chart please');
		expect(saved.deckId).toBe('deck-1');
		expect(saved.id).toBe(ctx.controller.activeChatId());
		// The listing refreshed after the save.
		expect(ctx.controller.chats().map((c) => c.id)).toStrictEqual([saved.id]);
	});

	it('newChat rotates the active id, clears the transcript, and cancels pending saves', async () => {
		const ctx = setup([userMessage('draft')]);
		const before = ctx.controller.activeChatId();
		ctx.controller.notifyMessagesChanged();
		ctx.controller.newChat();
		expect(ctx.setMessages).toHaveBeenCalledWith([]);
		expect(ctx.controller.activeChatId()).not.toBe(before);
		await vi.runAllTimersAsync();
		expect(ctx.store.records.size).toBe(0);
	});

	it('resumeChat loads the stored transcript through setMessages and adopts its id', async () => {
		const ctx = setup();
		const stored: PptxAiStoredChat = {
			id: 'c9',
			title: 'Stored',
			deckId: 'deck-1',
			messages: [userMessage('stored text', 'ms1')],
			createdAt: 111,
			updatedAt: 222,
		};
		await ctx.store.saveChat(stored);
		await ctx.controller.resumeChat('c9');
		expect(ctx.setMessages).toHaveBeenCalledOnce();
		expect(ctx.setMessages.mock.calls[0][0]).toStrictEqual(stored.messages);
		expect(ctx.controller.activeChatId()).toBe('c9');
	});

	it('deleteChat removes the record and resets when it was the active chat', async () => {
		const ctx = setup([userMessage('save me')]);
		ctx.controller.notifyMessagesChanged();
		await vi.runAllTimersAsync();
		const id = ctx.controller.activeChatId();
		expect(ctx.store.records.has(id)).toBeTruthy();

		await ctx.controller.deleteChat(id);
		expect(ctx.store.records.has(id)).toBeFalsy();
		expect(ctx.setMessages).toHaveBeenCalledWith([]);
		expect(ctx.controller.activeChatId()).not.toBe(id);
		expect(ctx.controller.chats()).toStrictEqual([]);
	});

	it('dispose cancels the pending debounce', async () => {
		const ctx = setup([userMessage('never saved')]);
		ctx.controller.notifyMessagesChanged();
		ctx.controller.dispose();
		await vi.runAllTimersAsync();
		expect(ctx.store.records.size).toBe(0);
	});
});
