import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import {
	buildChatLogExport,
	buildChatLogMarkdown,
	collectStoredChats,
	exportAiChatLogs,
} from './ai-log-export';

/**
 * ai-log-export tests: the detailed chat-log serialization preserves every tool
 * call's name, input and output (the debugging payload the panel hides in
 * collapsed cards), the Markdown transcript renders them, and `detailed: false`
 * omits the payloads while keeping the tool name + state.
 */
function chatWithToolCall(): PptxAiStoredChat {
	return {
		id: 'chat-1',
		title: 'Recolour the title',
		createdAt: 1_000,
		updatedAt: 2_000,
		messages: [
			{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Make the title blue' }] },
			{
				id: 'm2',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'Done.' },
					{
						type: 'tool-update_element_style',
						toolCallId: 'call-1',
						state: 'output-available',
						input: { slideIndex: 0, elementId: 'shape-1', fill: '#0000ff' },
						output: { ok: true },
					},
				],
			},
		] as unknown as PptxAiStoredChat['messages'],
	};
}

/** In-memory store seeded with one chat. */
function memoryStore(chats: PptxAiStoredChat[]): PptxAiChatStore {
	return {
		listChats: async () => chats.map((c) => ({ ...c, messageCount: c.messages.length })),
		loadChat: async (id) => chats.find((c) => c.id === id) ?? null,
		saveChat: async () => {},
		deleteChat: async () => {},
		clearChats: async () => {},
	};
}

describe('ai-log-export', () => {
	it('captures each tool call name, input and output when detailed', () => {
		const doc = buildChatLogExport([chatWithToolCall()], { now: 5_000 });
		expect(doc.format).toBe('pptx-ai-chat-log');
		expect(doc.chatCount).toBe(1);
		const call = doc.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.state).toBe('output-available');
		expect(call.input).toStrictEqual({ slideIndex: 0, elementId: 'shape-1', fill: '#0000ff' });
		expect(call.output).toStrictEqual({ ok: true });
	});

	it('omits tool inputs/outputs when not detailed (keeps name + state)', () => {
		const doc = buildChatLogExport([chatWithToolCall()], { detailed: false });
		const call = doc.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toBeUndefined();
		expect(call.output).toBeUndefined();
	});

	it('renders a Markdown transcript including the tool payloads', () => {
		const md = buildChatLogMarkdown(buildChatLogExport([chatWithToolCall()]));
		expect(md).toContain('# AI chat logs');
		expect(md).toContain('Recolour the title');
		expect(md).toContain('update_element_style');
		expect(md).toContain('#0000ff');
	});

	it('collectStoredChats loads every listed chat in full', async () => {
		const store = memoryStore([chatWithToolCall()]);
		const chats = await collectStoredChats(store);
		expect(chats).toHaveLength(1);
		expect(chats[0].messages).toHaveLength(2);
	});

	it('exportAiChatLogs returns 0 (no download) when there are no chats', async () => {
		const count = await exportAiChatLogs({ store: memoryStore([]) });
		expect(count).toBe(0);
	});
});
