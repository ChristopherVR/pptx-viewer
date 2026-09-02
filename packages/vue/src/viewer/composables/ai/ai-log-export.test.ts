// @vitest-environment happy-dom
import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

const downloaded: { blob: Blob; filename: string }[] = [];
vi.mock(import('pptx-viewer-shared'), () => ({
	downloadBlob: (blob: Blob, filename: string) => {
		downloaded.push({ blob, filename });
	},
}));

const { exportAiChatLogs } = await import('./ai-log-export');

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

// `buildChatLogExport` / `buildChatLogMarkdown` / `collectStoredChats` are pure
// shared helpers (packages/shared/src/ai/chat-log-export.ts) covered by that
// module's own tests. This file pins only Vue's DOM glue: that the wrapper
// reads the store, hands the shared builder's output to `downloadBlob`, and
// preserves the shared filename/format contract through the binding.
describe('exportAiChatLogs (Vue DOM glue)', () => {
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
