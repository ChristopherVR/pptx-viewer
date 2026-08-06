import type {
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiStoredChat,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
import { createAiChatHistoryController } from 'pptx-viewer-shared/ai';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AiHistoryMenu from './AiHistoryMenu.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function summary(id: string, title: string): PptxAiChatSummary {
	return { id, title, deckId: 'deck-1', createdAt: 1, updatedAt: 2, messageCount: 3 };
}

/** In-memory PptxAiChatStore. */
function fakeStore(records: Map<string, PptxAiStoredChat>): PptxAiChatStore {
	return {
		async listChats(): Promise<PptxAiChatSummary[]> {
			return [...records.values()].map((chat) => ({
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
		async saveChat(): Promise<void> {},
		async deleteChat(id: string): Promise<void> {
			records.delete(id);
		},
		async clearChats(): Promise<void> {
			records.clear();
		},
	};
}

function mountMenu(props: Partial<Parameters<typeof mount>[1]['props']> = {}) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AiHistoryMenu, {
		target,
		props: {
			chats: [],
			activeChatId: 'none',
			canClear: false,
			onresume: () => undefined,
			ondelete: () => undefined,
			onnewchat: () => undefined,
			onclearchat: () => undefined,
			...props,
		},
	});
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('aiHistoryMenu', () => {
	it('renders a Chats button that toggles the saved-chat menu', () => {
		const target = mountMenu({ chats: [summary('c1', 'Resize the chart')] });

		const chatsBtn = [...target.querySelectorAll('button')].find(
			(b) => b.textContent?.trim() === 'Chats',
		);
		expect(chatsBtn).toBeTruthy();
		expect(target.querySelector('.pptx-svelte-ai-history-menu')).toBeNull();

		chatsBtn?.click();
		flushSync();
		const menu = target.querySelector('.pptx-svelte-ai-history-menu');
		expect(menu).not.toBeNull();
		expect(menu?.textContent).toContain('Saved chats');
		expect(menu?.textContent).toContain('Resize the chart');
		expect(menu?.textContent).toContain('Chats are saved in this browser.');

		chatsBtn?.click();
		flushSync();
		expect(target.querySelector('.pptx-svelte-ai-history-menu')).toBeNull();
	});

	it('shows the empty state and a New chat action', () => {
		const onnewchat = vi.fn();
		const target = mountMenu({ onnewchat });
		[...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Chats')?.click();
		flushSync();
		expect(target.querySelector('.pptx-svelte-ai-history-empty')?.textContent).toBe(
			'No saved chats yet.',
		);
		[...target.querySelectorAll('button')]
			.find((b) => b.textContent?.trim() === 'New chat')
			?.click();
		flushSync();
		expect(onnewchat).toHaveBeenCalledOnce();
	});

	it('resume flows through the shared controller into setMessages with the stored transcript', async () => {
		const transcript = [
			{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'stored text' }] },
		] as PptxAiUIMessage[];
		const records = new Map<string, PptxAiStoredChat>([
			[
				'c9',
				{
					id: 'c9',
					title: 'Stored',
					deckId: 'deck-1',
					messages: transcript,
					createdAt: 1,
					updatedAt: 2,
				},
			],
		]);
		const setMessages = vi.fn();
		const controller = createAiChatHistoryController({
			deckId: 'deck-1',
			store: fakeStore(records),
			getMessages: () => [],
			setMessages,
		});

		const ondelete = vi.fn((id: string) => void controller.deleteChat(id));
		const target = mountMenu({
			chats: [summary('c9', 'Stored')],
			onresume: (id: string) => void controller.resumeChat(id),
			ondelete,
		});
		[...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Chats')?.click();
		flushSync();

		const resume = target.querySelector<HTMLButtonElement>('.pptx-svelte-ai-history-resume');
		expect(resume).toBeTruthy();
		resume?.click();
		await vi.waitFor(() => {
			expect(setMessages).toHaveBeenCalledOnce();
		});
		expect(setMessages.mock.calls[0][0]).toStrictEqual(transcript);
		expect(controller.activeChatId()).toBe('c9');

		// Resuming closed the menu; reopen it to reach the delete affordance.
		[...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Chats')?.click();
		flushSync();
		const del = target.querySelector<HTMLButtonElement>('.pptx-svelte-ai-history-delete');
		del?.click();
		expect(ondelete).toHaveBeenCalledWith('c9');
	});
});
