// @vitest-environment happy-dom
import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

const downloaded: { blob: Blob; filename: string }[] = [];
vi.mock(import('./dom-helpers'), () => ({
	downloadBlob: (blob: Blob, filename: string) => {
		downloaded.push({ blob, filename });
	},
}));

const { buildChatLogExport, buildChatLogMarkdown, collectStoredChats, exportAiChatLogs } =
	await import('./ai-log-export');

afterEach(() => {
	downloaded.length = 0;
});

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
	it('downloads a JSON blob containing tool call details and returns the count', async () => {
		const store = mockStore([chatWithToolCall()]);
		const count = await exportAiChatLogs({ store, format: 'json', now: 5_000 });
		expect(count).toBe(1);
		expect(store.listChats).toHaveBeenCalledOnce();
		expect(store.loadChat).toHaveBeenCalledWith('chat-1');
		expect(downloaded).toHaveLength(1);
		expect(downloaded[0].filename).toMatch(/^pptx-ai-chats-\d{8}-\d{6}\.json$/u);
		const parsed = JSON.parse(await downloaded[0].blob.text()) as {
			chats: {
				messages: { toolCalls: { toolName: string; input: unknown; output: unknown }[] }[];
			}[];
		};
		const call = parsed.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toStrictEqual({ slideIndex: 0, color: 'FF0000' });
		expect(call.output).toStrictEqual({ updated: true });
	});

	it('downloads a markdown transcript when requested', async () => {
		await exportAiChatLogs({ store: mockStore([chatWithToolCall()]), format: 'markdown' });
		expect(downloaded[0].filename).toMatch(/\.md$/u);
		await expect(downloaded[0].blob.text()).resolves.toContain('Tool `update_element_style`');
	});

	it('does not download and returns 0 when there are no chats', async () => {
		const count = await exportAiChatLogs({ store: mockStore([]) });
		expect(count).toBe(0);
		expect(downloaded).toHaveLength(0);
	});
});
