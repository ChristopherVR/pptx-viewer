import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import { buildChatLogExport, buildChatLogMarkdown, exportAiChatLogs } from './ai-log-export';

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
				parts: [
					{ type: 'text', text: 'Done.' },
					{
						type: 'tool-update_element_style',
						toolCallId: 'c1',
						state: 'output-available',
						input: { slideIndex: 0, elementId: 'el-1', fill: '#0000ff' },
						output: { ok: true },
					},
				],
			},
		] as unknown as PptxAiStoredChat['messages'],
	};
}

describe('buildChatLogExport', () => {
	it('captures tool inputs and outputs when detailed', () => {
		const doc = buildChatLogExport([storedChat()], { detailed: true, now: 5_000 });
		expect(doc.format).toBe('pptx-ai-chat-log');
		expect(doc.chatCount).toBe(1);
		const message = doc.chats[0]?.messages.find((m) => m.role === 'assistant');
		expect(message?.text).toBe('Done.');
		const call = message?.toolCalls[0];
		expect(call?.toolName).toBe('update_element_style');
		expect(call?.input).toStrictEqual({ slideIndex: 0, elementId: 'el-1', fill: '#0000ff' });
		expect(call?.output).toStrictEqual({ ok: true });
	});

	it('omits tool payloads when not detailed but keeps name + state', () => {
		const doc = buildChatLogExport([storedChat()], { detailed: false, now: 5_000 });
		const call = doc.chats[0]?.messages.find((m) => m.role === 'assistant')?.toolCalls[0];
		expect(call?.toolName).toBe('update_element_style');
		expect(call?.state).toBe('output-available');
		expect(call?.input).toBeUndefined();
		expect(call?.output).toBeUndefined();
	});

	it('renders a Markdown transcript including the tool JSON', () => {
		const md = buildChatLogMarkdown(buildChatLogExport([storedChat()], { detailed: true }));
		expect(md).toContain('# AI chat logs');
		expect(md).toContain('Tool `update_element_style`');
		expect(md).toContain('"fill": "#0000ff"');
	});
});

describe('exportAiChatLogs', () => {
	it('returns the exported chat count (JSON) from a store', async () => {
		let downloadCount = 0;
		const store: PptxAiChatStore = {
			listChats: async () => [
				{ id: 'chat-1', title: 'Recolour deck', updatedAt: 2_000, messageCount: 2 },
			],
			loadChat: async () => storedChat(),
			saveChat: async () => undefined,
			deleteChat: async () => undefined,
		} as unknown as PptxAiChatStore;
		// jsdom download is a no-op anchor click; just assert the count + no throw.
		const anchorClick = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function click() {
			downloadCount += 1;
		};
		try {
			const exported = await exportAiChatLogs({ store, format: 'json', now: 5_000 });
			expect(exported).toBe(1);
			expect(downloadCount).toBe(1);
		} finally {
			HTMLAnchorElement.prototype.click = anchorClick;
		}
	});

	it('exports nothing (count 0) when the store is empty', async () => {
		const store: PptxAiChatStore = {
			listChats: async () => [],
			loadChat: async () => null,
			saveChat: async () => undefined,
			deleteChat: async () => undefined,
		} as unknown as PptxAiChatStore;
		await expect(exportAiChatLogs({ store })).resolves.toBe(0);
	});
});
