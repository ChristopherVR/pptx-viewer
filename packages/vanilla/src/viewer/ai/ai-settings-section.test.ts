import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createAiSettingsSection } from './ai-settings-section';

function storedChat(): PptxAiStoredChat {
	return {
		id: 'chat-1',
		title: 'Recolour deck',
		deckId: 'deck-1',
		createdAt: 1_000,
		updatedAt: 2_000,
		messages: [
			{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Make it blue' }] },
			{
				id: 'a1',
				role: 'assistant',
				parts: [{ type: 'text', text: 'Done.' }],
			},
		],
	} as unknown as PptxAiStoredChat;
}

function fakeStore(chats: PptxAiStoredChat[]): PptxAiChatStore {
	return {
		listChats: async () =>
			chats.map((c) => ({
				id: c.id,
				title: c.title,
				deckId: c.deckId,
				createdAt: c.createdAt,
				updatedAt: c.updatedAt,
				messageCount: c.messages.length,
			})),
		loadChat: async (id: string) => chats.find((c) => c.id === id) ?? null,
		saveChat: async () => undefined,
		deleteChat: async () => undefined,
	} as unknown as PptxAiChatStore;
}

describe('createAiSettingsSection', () => {
	it('exports the JSON log via the shared exportAiChatLogs pipeline on click', async () => {
		const t = createTranslator();
		const store = fakeStore([storedChat()]);
		const section = createAiSettingsSection({ doc: document, t, store });

		let downloadCount = 0;
		const anchorClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function click() {
			downloadCount += 1;
		};
		try {
			const [jsonBtn] = section.querySelectorAll('button.pptxv-ai-settings-btn');
			expect(jsonBtn).toBeDefined();
			(jsonBtn as HTMLButtonElement).click();
			// runExport awaits collectStoredChats (a store round-trip); wait for the
			// download to actually fire rather than guessing a microtask count.
			await vi.waitFor(() => expect(downloadCount).toBe(1));
		} finally {
			HTMLAnchorElement.prototype.click = anchorClick;
		}
		const status = section.querySelector('.pptxv-ai-settings-status');
		expect(status?.textContent).toContain('1');
	});

	it('shows the empty-state message and downloads nothing for an empty store', async () => {
		const t = createTranslator();
		const store = fakeStore([]);
		const section = createAiSettingsSection({ doc: document, t, store });

		let downloadCount = 0;
		const anchorClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function click() {
			downloadCount += 1;
		};
		try {
			const [jsonBtn] = section.querySelectorAll('button.pptxv-ai-settings-btn');
			(jsonBtn as HTMLButtonElement).click();
			await vi.waitFor(() =>
				expect(section.querySelector('.pptxv-ai-settings-status')?.textContent).toBeTruthy(),
			);
		} finally {
			HTMLAnchorElement.prototype.click = anchorClick;
		}
		expect(downloadCount).toBe(0);
	});
});
