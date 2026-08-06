import { mount } from '@vue/test-utils';
import type {
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiStoredChat,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import type { UseAiChatHistoryResult } from './useAiChatHistory';
import { useAiChatHistory } from './useAiChatHistory';

function userMessage(text: string): PptxAiUIMessage {
	return { id: 'm1', role: 'user', parts: [{ type: 'text', text }] } as PptxAiUIMessage;
}

function toChatSummary(chat: PptxAiStoredChat): PptxAiChatSummary {
	return {
		id: chat.id,
		title: chat.title,
		deckId: chat.deckId,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		messageCount: chat.messages.length,
	};
}

/** In-memory PptxAiChatStore. */
function fakeStore(): PptxAiChatStore & { records: Map<string, PptxAiStoredChat> } {
	const records = new Map<string, PptxAiStoredChat>();
	return {
		records,
		async listChats(opts?: { deckId?: string }): Promise<PptxAiChatSummary[]> {
			return [...records.values()]
				.filter((c) => opts?.deckId === undefined || c.deckId === opts.deckId)
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

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe('useAiChatHistory', () => {
	it('resumeChat loads the stored transcript through setMessages', async () => {
		const store = fakeStore();
		const stored: PptxAiStoredChat = {
			id: 'c9',
			title: 'Stored',
			deckId: 'deck-1',
			messages: [userMessage('stored text')],
			createdAt: 1,
			updatedAt: 2,
		};
		await store.saveChat(stored);

		const messages = ref<PptxAiUIMessage[]>([]);
		const setMessages = vi.fn((next: PptxAiUIMessage[]) => {
			messages.value = next;
		});
		let history: UseAiChatHistoryResult | undefined;
		const Harness = defineComponent({
			setup() {
				// oxlint-disable-next-line react-hooks/rules-of-hooks -- Vue composable, not a React hook.
				history = useAiChatHistory({ deckId: 'deck-1', messages, setMessages, store });
				return () => h('div');
			},
		});
		wrapper = mount(Harness);

		await history?.resumeChat('c9');
		expect(setMessages).toHaveBeenCalledOnce();
		expect(setMessages.mock.calls[0][0]).toStrictEqual(stored.messages);
		expect(messages.value).toStrictEqual(stored.messages);
		expect(history?.activeChatId.value).toBe('c9');
	});

	it('debounce-saves transcript changes under the active chat id', async () => {
		vi.useFakeTimers();
		try {
			const store = fakeStore();
			const messages = ref<PptxAiUIMessage[]>([]);
			let history: UseAiChatHistoryResult | undefined;
			const Harness = defineComponent({
				setup() {
					// oxlint-disable-next-line react-hooks/rules-of-hooks -- Vue composable, not a React hook.
					history = useAiChatHistory({
						deckId: 'deck-1',
						messages,
						setMessages: (next) => {
							messages.value = next;
						},
						store,
					});
					return () => h('div');
				},
			});
			wrapper = mount(Harness);

			messages.value = [userMessage('Make slide two blue')];
			// Let the watcher flush, then run the 800ms debounce + async save.
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(900);
			expect(store.records.size).toBe(1);
			const saved = [...store.records.values()][0];
			expect(saved.title).toBe('Make slide two blue');
			expect(saved.id).toBe(history?.activeChatId.value);
		} finally {
			vi.useRealTimers();
		}
	});
});
