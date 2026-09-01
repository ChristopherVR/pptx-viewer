import { describe, expect, it, vi } from 'vitest';

import type { PptxAiChatStore, PptxAiStoredChat } from './chat-history-store';
import {
	buildChatLogExport,
	buildChatLogMarkdown,
	collectStoredChats,
	exportAiChatLogs,
	toLogChat,
	toolCallLine,
} from './chat-log-export';

function chatWithToolCall(): PptxAiStoredChat {
	return {
		id: 'chat-1',
		title: 'Recolor the title',
		deckId: 'my-deck::3',
		createdAt: 1_000,
		updatedAt: 2_000,
		messages: [
			{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Make the title red' }] },
			{
				id: 'm2',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'Done.' },
					{
						type: 'tool-update_element_style',
						toolCallId: 'call-1',
						state: 'output-available',
						input: { slideIndex: 0, color: 'FF0000' },
						output: { updated: true },
					},
				],
			},
		],
	} as unknown as PptxAiStoredChat;
}

function mockStore(chats: PptxAiStoredChat[]): PptxAiChatStore {
	return {
		listChats: vi.fn(async () =>
			chats.map((c) => ({
				id: c.id,
				title: c.title,
				deckId: c.deckId,
				createdAt: c.createdAt,
				updatedAt: c.updatedAt,
				messageCount: c.messages.length,
			})),
		),
		loadChat: vi.fn(async (id: string) => chats.find((c) => c.id === id) ?? null),
		saveChat: vi.fn(async () => {}),
		deleteChat: vi.fn(async () => {}),
		clearChats: vi.fn(async () => {}),
	};
}

describe('toLogChat', () => {
	it('splits parts into text runs and tool calls', () => {
		const chat = toLogChat(chatWithToolCall(), true);
		expect(chat.messages[1].text).toBe('Done.');
		expect(chat.messages[1].toolCalls).toHaveLength(1);
		expect(chat.messages[1].toolCalls[0].toolName).toBe('update_element_style');
	});
});

describe('buildChatLogExport', () => {
	it('captures tool call name, input, state, and output in detail', () => {
		const doc = buildChatLogExport([chatWithToolCall()], { now: 5_000 });
		expect(doc.format).toBe('pptx-ai-chat-log');
		expect(doc.chatCount).toBe(1);
		const chat = doc.chats[0];
		expect(chat.deckId).toBe('my-deck::3');
		expect(chat.createdAtIso).toBe(new Date(1_000).toISOString());
		const assistant = chat.messages[1];
		expect(assistant.text).toBe('Done.');
		expect(assistant.toolCalls).toHaveLength(1);
		const call = assistant.toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.state).toBe('output-available');
		expect(call.input).toStrictEqual({ slideIndex: 0, color: 'FF0000' });
		expect(call.output).toStrictEqual({ updated: true });
	});

	it('omits tool inputs/outputs when detailed is false', () => {
		const doc = buildChatLogExport([chatWithToolCall()], { detailed: false });
		const call = doc.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toBeUndefined();
		expect(call.output).toBeUndefined();
	});

	it('handles the empty case', () => {
		const doc = buildChatLogExport([]);
		expect(doc.chatCount).toBe(0);
		expect(doc.chats).toStrictEqual([]);
		const md = buildChatLogMarkdown(doc);
		expect(md).toContain('Chats: 0');
	});
});

describe('toolCallLine', () => {
	it('includes the error line when errorText is set', () => {
		const line = toolCallLine(
			{
				toolName: 'update_element_style',
				toolCallId: 'call-1',
				state: 'output-error',
				input: {},
				output: undefined,
				errorText: 'boom',
			},
			false,
		);
		expect(line).toContain('error: boom');
		expect(line).not.toContain('input:');
	});
});

describe('buildChatLogMarkdown', () => {
	it('renders tool calls with fenced JSON payloads', () => {
		const md = buildChatLogMarkdown(buildChatLogExport([chatWithToolCall()]));
		expect(md).toContain('## Recolor the title');
		expect(md).toContain('Tool `update_element_style`');
		expect(md).toContain('FF0000');
	});
});

describe('collectStoredChats', () => {
	it('loads every chat in full from the store', async () => {
		const chats = await collectStoredChats(mockStore([chatWithToolCall()]));
		expect(chats).toHaveLength(1);
		expect(chats[0].messages).toHaveLength(2);
	});
});

describe('exportAiChatLogs', () => {
	it('saves a JSON body containing tool call details and returns the count', async () => {
		const chats = await collectStoredChats(mockStore([chatWithToolCall()]));
		const saved: { filename: string; content: string; mime: string }[] = [];
		const count = exportAiChatLogs(
			chats,
			{ format: 'json', now: 5_000 },
			(filename, content, mime) => {
				saved.push({ filename, content, mime });
			},
		);
		expect(count).toBe(1);
		expect(saved).toHaveLength(1);
		expect(saved[0].filename).toMatch(/^pptx-ai-chats-\d{8}-\d{6}\.json$/u);
		expect(saved[0].mime).toBe('application/json');
		const parsed = JSON.parse(saved[0].content) as {
			chats: {
				messages: { toolCalls: { toolName: string; input: unknown; output: unknown }[] }[];
			}[];
		};
		const call = parsed.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toStrictEqual({ slideIndex: 0, color: 'FF0000' });
		expect(call.output).toStrictEqual({ updated: true });
	});

	it('saves a markdown transcript when requested', async () => {
		const chats = await collectStoredChats(mockStore([chatWithToolCall()]));
		const saved: { filename: string; content: string; mime: string }[] = [];
		exportAiChatLogs(chats, { format: 'markdown' }, (filename, content, mime) => {
			saved.push({ filename, content, mime });
		});
		expect(saved[0].filename).toMatch(/\.md$/u);
		expect(saved[0].mime).toBe('text/markdown');
		expect(saved[0].content).toContain('Tool `update_element_style`');
	});

	it('does not call save and returns 0 when there are no chats', () => {
		const save = vi.fn();
		const count = exportAiChatLogs([], undefined, save);
		expect(count).toBe(0);
		expect(save).not.toHaveBeenCalled();
	});
});
