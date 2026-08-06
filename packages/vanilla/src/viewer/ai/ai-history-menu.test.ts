import type {
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiStoredChat,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createAiHistoryMenu } from './ai-history-menu';
import type { AiHistoryMenu } from './ai-history-menu';

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

let menu: AiHistoryMenu | null = null;

afterEach(() => {
	menu?.destroy();
	menu = null;
});

describe('createAiHistoryMenu', () => {
	it('lists stored chats and resume swaps the transcript in via setMessages', async () => {
		const store = fakeStore();
		const stored: PptxAiStoredChat = {
			id: 'c9',
			title: 'Stored chat',
			deckId: 'deck-1',
			messages: [userMessage('stored text')],
			createdAt: 1,
			updatedAt: 2,
		};
		await store.saveChat(stored);

		const setMessages = vi.fn();
		menu = createAiHistoryMenu({
			doc: document,
			t: createTranslator('en'),
			deckId: 'deck-1',
			store,
			getMessages: () => [],
			setMessages,
		});
		document.body.append(menu.button, menu.el);

		// The initial async listing populates a resume row.
		await vi.waitFor(() => {
			expect(menu?.el.querySelector('.pptxv-ai-history-resume')).toBeTruthy();
		});
		expect(menu.el.querySelector('.pptxv-ai-history-name')?.textContent).toBe('Stored chat');

		menu.button.click();
		expect(menu.el.hidden).toBeFalsy();

		menu.el.querySelector<HTMLButtonElement>('.pptxv-ai-history-resume')?.click();
		await vi.waitFor(() => {
			expect(setMessages).toHaveBeenCalledOnce();
		});
		expect(setMessages.mock.calls[0][0]).toStrictEqual(stored.messages);
		// Resuming closes the dropdown.
		expect(menu.el.hidden).toBeTruthy();
	});

	it('deletes a stored chat from its row control', async () => {
		const store = fakeStore();
		await store.saveChat({
			id: 'c1',
			title: 'Doomed',
			deckId: 'deck-1',
			messages: [userMessage('bye')],
			createdAt: 1,
			updatedAt: 2,
		});
		menu = createAiHistoryMenu({
			doc: document,
			t: createTranslator('en'),
			deckId: 'deck-1',
			store,
			getMessages: () => [],
			setMessages: () => undefined,
		});
		document.body.append(menu.button, menu.el);
		await vi.waitFor(() => {
			expect(menu?.el.querySelector('.pptxv-ai-history-delete')).toBeTruthy();
		});

		menu.el.querySelector<HTMLButtonElement>('.pptxv-ai-history-delete')?.click();
		await vi.waitFor(() => {
			expect(store.records.size).toBe(0);
		});
		await vi.waitFor(() => {
			expect(menu?.el.querySelector('.pptxv-ai-history-empty')).toBeTruthy();
		});
	});

	it('debounce-saves transcript changes reported via notifyMessagesChanged', async () => {
		vi.useFakeTimers();
		try {
			const store = fakeStore();
			let transcript: PptxAiUIMessage[] = [];
			menu = createAiHistoryMenu({
				doc: document,
				t: createTranslator('en'),
				deckId: 'deck-1',
				store,
				getMessages: () => transcript,
				setMessages: (next) => {
					transcript = next;
				},
			});

			transcript = [userMessage('Align the shapes')];
			menu.notifyMessagesChanged();
			await vi.advanceTimersByTimeAsync(900);
			expect(store.records.size).toBe(1);
			expect([...store.records.values()][0].title).toBe('Align the shapes');
		} finally {
			vi.useRealTimers();
		}
	});
});
