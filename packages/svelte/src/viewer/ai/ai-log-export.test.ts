import type { PptxAiChatStore, PptxAiStoredChat, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { describe, expect, it, vi } from 'vitest';

import { buildChatLogExport, buildChatLogMarkdown, exportAiChatLogs } from './ai-log-export';

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

describe('ai-log-export', () => {
	it('serializes tool inputs and outputs into the detailed JSON document', () => {
		const doc = buildChatLogExport([transcriptChat()], { detailed: true, now: 5_000 });
		expect(doc.format).toBe('pptx-ai-chat-log');
		expect(doc.chatCount).toBe(1);
		const assistant = doc.chats[0].messages.find((m) => m.role === 'assistant');
		expect(assistant?.text).toBe('Done.');
		expect(assistant?.toolCalls).toHaveLength(1);
		const call = assistant?.toolCalls[0];
		expect(call?.toolName).toBe('update_element');
		expect(call?.input).toStrictEqual({ slideIndex: 0, elementId: 'shape-1', color: '#ff0000' });
		expect(call?.output).toStrictEqual({ ok: true, changed: 1 });
	});

	it('omits tool payloads when detailed is false', () => {
		const doc = buildChatLogExport([transcriptChat()], { detailed: false });
		const call = doc.chats[0].messages.find((m) => m.role === 'assistant')?.toolCalls[0];
		expect(call?.toolName).toBe('update_element');
		expect(call?.input).toBeUndefined();
		expect(call?.output).toBeUndefined();
	});

	it('renders a Markdown transcript with the tool call detail', () => {
		const md = buildChatLogMarkdown(buildChatLogExport([transcriptChat()], { detailed: true }));
		expect(md).toContain('# AI chat logs');
		expect(md).toContain('Tool `update_element`');
		expect(md).toContain('"changed": 1');
	});

	it('exports from the store and reports the chat count', async () => {
		const store = seededStore([transcriptChat()]);
		const createObjectURL = vi.fn(() => 'blob:x');
		vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
		// Stub the anchor click so happy-dom does not attempt a real navigation.
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
		try {
			const count = await exportAiChatLogs({ store, format: 'json', now: 0 });
			expect(count).toBe(1);
			// A JSON blob was produced for download.
			expect(createObjectURL).toHaveBeenCalledOnce();
			const blob = createObjectURL.mock.calls[0][0] as Blob;
			expect(blob.type).toBe('application/json');
		} finally {
			clickSpy.mockRestore();
			vi.unstubAllGlobals();
		}
	});

	it('downloads nothing and returns 0 when the store is empty', async () => {
		const count = await exportAiChatLogs({ store: seededStore([]) });
		expect(count).toBe(0);
	});
});
