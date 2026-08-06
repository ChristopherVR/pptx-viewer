/**
 * AiHistoryService tests: the signal facade over the shared chat-history
 * controller. Bypasses TestBed (the service is a plain class); a fake in-memory
 * store isolates persistence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiStoredChat,
	PptxAiUIMessage,
} from '../../internal/shared-ai';
import { AiHistoryService } from './ai-history.service';

function userMessage(text: string): PptxAiUIMessage {
	return { id: 'm1', role: 'user', parts: [{ type: 'text', text }] } as PptxAiUIMessage;
}

/** In-memory PptxAiChatStore. */
function fakeStore(): PptxAiChatStore & { records: Map<string, PptxAiStoredChat> } {
	const records = new Map<string, PptxAiStoredChat>();
	return {
		records,
		async listChats(opts?: { deckId?: string }): Promise<PptxAiChatSummary[]> {
			return [...records.values()]
				.filter((c) => opts?.deckId === undefined || c.deckId === opts.deckId)
				.map((chat) => ({
					id: chat.id,
					title: chat.title,
					deckId: chat.deckId,
					createdAt: chat.createdAt,
					updatedAt: chat.updatedAt,
					messageCount: chat.messages.length,
				}));
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

describe('aiHistoryService', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function setup(initialTranscript: PptxAiUIMessage[] = []) {
		const store = fakeStore();
		let transcript = initialTranscript;
		const setMessages = vi.fn((next: PptxAiUIMessage[]) => {
			transcript = next;
		});
		const service = new AiHistoryService();
		service.init({
			deckId: 'deck-1',
			store,
			getMessages: () => transcript,
			setMessages,
		});
		return { store, service, setMessages };
	}

	it('resumeChat swaps the stored transcript in through setMessages', async () => {
		const { store, service, setMessages } = setup();
		const stored: PptxAiStoredChat = {
			id: 'c9',
			title: 'Stored',
			deckId: 'deck-1',
			messages: [userMessage('stored text')],
			createdAt: 1,
			updatedAt: 2,
		};
		await store.saveChat(stored);

		await service.resumeChat('c9');
		expect(setMessages).toHaveBeenCalledOnce();
		expect(setMessages.mock.calls[0][0]).toStrictEqual(stored.messages);
		expect(service.activeChatId()).toBe('c9');
	});

	it('notifyMessagesChanged debounce-saves and refreshes the chats signal', async () => {
		const { store, service } = setup([userMessage('Make the title bolder')]);
		service.notifyMessagesChanged();
		await vi.advanceTimersByTimeAsync(900);
		expect(store.records.size).toBe(1);
		const saved = [...store.records.values()][0];
		expect(saved.title).toBe('Make the title bolder');
		expect(saved.id).toBe(service.activeChatId());
		expect(service.chats().map((c) => c.id)).toStrictEqual([saved.id]);
	});

	it('newChat rotates the active id and clears the transcript', () => {
		const { service, setMessages } = setup([userMessage('draft')]);
		const before = service.activeChatId();
		service.newChat();
		expect(service.activeChatId()).not.toBe(before);
		expect(setMessages).toHaveBeenCalledWith([]);
	});

	it('deleteChat removes the record and empties the listing', async () => {
		const { store, service } = setup([userMessage('save me')]);
		service.notifyMessagesChanged();
		await vi.advanceTimersByTimeAsync(900);
		const id = service.activeChatId();
		await service.deleteChat(id);
		expect(store.records.size).toBe(0);
		expect(service.chats()).toStrictEqual([]);
	});

	it('toggleMenu flips the dropdown state', () => {
		const { service } = setup();
		expect(service.menuOpen()).toBeFalsy();
		service.toggleMenu();
		expect(service.menuOpen()).toBeTruthy();
		service.toggleMenu();
		expect(service.menuOpen()).toBeFalsy();
	});
});
