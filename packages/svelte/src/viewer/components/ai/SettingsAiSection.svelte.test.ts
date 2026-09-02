import type { PptxAiChatStore, PptxAiStoredChat, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SettingsAiSection from './SettingsAiSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** An in-memory chat store seeded with a transcript containing a tool call. */
function seededStore(chats: PptxAiStoredChat[]): PptxAiChatStore {
	return {
		listChats: () =>
			Promise.resolve(
				chats.map((c) => ({
					id: c.id,
					title: c.title,
					deckId: c.deckId,
					createdAt: c.createdAt,
					updatedAt: c.updatedAt,
					messageCount: c.messages.length,
				})),
			),
		loadChat: (id) => Promise.resolve(chats.find((c) => c.id === id) ?? null),
		saveChat: () => Promise.resolve(),
		deleteChat: () => Promise.resolve(),
		clearChats: () => Promise.resolve(),
	};
}

function transcriptChat(): PptxAiStoredChat {
	const messages = [
		{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Recolor the title' }] },
		{
			id: 'm2',
			role: 'assistant',
			parts: [
				{ type: 'text', text: 'Done.' },
				{
					type: 'tool-update_element',
					toolCallId: 'call-1',
					state: 'output-available',
					input: { slideIndex: 0, elementId: 'shape-1', color: '#ff0000' },
					output: { ok: true, changed: 1 },
				},
			],
		},
	] as unknown as PptxAiUIMessage[];
	return {
		id: 'chat-1',
		title: 'Recolor the title',
		deckId: 'deck::1',
		messages,
		createdAt: 1_000,
		updatedAt: 2_000,
	};
}

function mountSection(store: PptxAiChatStore): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(SettingsAiSection, { target, props: { store } });
	cleanup = () => unmount(instance);
	return target;
}

describe('settingsAiSection', () => {
	it('exports the store contents to a downloadable JSON blob via shared exportAiChatLogs', async () => {
		const store = seededStore([transcriptChat()]);
		const createObjectURL = vi.fn(() => 'blob:x');
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
		try {
			const target = mountSection(store);
			// Let the mount-time chat-count effect settle before exporting.
			await Promise.resolve();
			await Promise.resolve();
			const jsonButton = Array.from(target.querySelectorAll('button')).find((b) =>
				b.textContent?.includes('JSON'),
			);
			expect(jsonButton).toBeDefined();
			jsonButton?.click();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(createObjectURL).toHaveBeenCalledOnce();
			const blob = createObjectURL.mock.calls[0][0] as Blob;
			expect(blob.type).toBe('application/json');
		} finally {
			clickSpy.mockRestore();
			vi.unstubAllGlobals();
		}
	});

	it('exports nothing and reports the empty state when the store has no chats', async () => {
		const target = mountSection(seededStore([]));
		await Promise.resolve();
		await Promise.resolve();
		const jsonButton = Array.from(target.querySelectorAll('button')).find((b) =>
			b.textContent?.includes('JSON'),
		);
		jsonButton?.click();
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(target.textContent).toContain('No saved chats to export.');
	});
});
