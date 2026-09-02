import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PptxAiChatStore, PptxAiStoredChat, PptxAiUIMessage } from '../../internal/shared-ai';
import {
	buildChatLogExport,
	buildChatLogMarkdown,
	collectStoredChats,
	exportAiChatLogs,
} from './ai-log-export';

/** A stored chat whose assistant turn contains one tool call with input + output. */
function storedChat(): PptxAiStoredChat {
	const messages: PptxAiUIMessage[] = [
		{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Recolor slide 3' }] },
		{
			id: 'm2',
			role: 'assistant',
			parts: [
				{ type: 'text', text: 'Done.' },
				{
					type: 'tool-update_element_style',
					toolCallId: 'call-1',
					state: 'output-available',
					input: { slideIndex: 2, elementId: 'shape-9', fill: '#ff0000' },
					output: { ok: true },
				},
			],
		},
	] as unknown as PptxAiUIMessage[];
	return {
		id: 'c1',
		title: 'Recolor',
		deckId: 'deck-1',
		createdAt: 1000,
		updatedAt: 2000,
		messages,
	};
}

/** In-memory chat store for the export path (no IndexedDB). */
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
		saveChat: async () => {},
		deleteChat: async () => {},
	} as unknown as PptxAiChatStore;
}

describe('buildChatLogExport', () => {
	it('captures each tool call with its full input and output', () => {
		const doc = buildChatLogExport([storedChat()], { now: 5000 });
		expect(doc.format).toBe('pptx-ai-chat-log');
		expect(doc.detailed).toBeTruthy();
		expect(doc.chatCount).toBe(1);

		const assistant = doc.chats[0].messages[1];
		expect(assistant.role).toBe('assistant');
		expect(assistant.text).toBe('Done.');
		expect(assistant.toolCalls).toHaveLength(1);
		const call = assistant.toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toStrictEqual({ slideIndex: 2, elementId: 'shape-9', fill: '#ff0000' });
		expect(call.output).toStrictEqual({ ok: true });
	});

	it('omits tool payloads when detailed is false but keeps name + state', () => {
		const doc = buildChatLogExport([storedChat()], { detailed: false });
		const call = doc.chats[0].messages[1].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.state).toBe('output-available');
		expect(call.input).toBeUndefined();
		expect(call.output).toBeUndefined();
	});

	it('renders a Markdown transcript that includes the tool input JSON', () => {
		const md = buildChatLogMarkdown(buildChatLogExport([storedChat()]));
		expect(md).toContain('# AI chat logs');
		expect(md).toContain('Tool `update_element_style`');
		expect(md).toContain('"elementId": "shape-9"');
	});
});

describe('collectStoredChats', () => {
	it('loads every stored chat in full from the store', async () => {
		const chats = await collectStoredChats(fakeStore([storedChat()]));
		expect(chats).toHaveLength(1);
		expect(chats[0].messages).toHaveLength(2);
	});

	it('returns an empty list for an empty store', async () => {
		await expect(collectStoredChats(fakeStore([]))).resolves.toStrictEqual([]);
	});
});

describe('exportAiChatLogs', () => {
	let createObjectUrl: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		createObjectUrl = vi.fn(() => 'blob:ai-chat-log');
		Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
		Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('reads the given store and triggers a JSON download by default', async () => {
		const count = await exportAiChatLogs({ store: fakeStore([storedChat()]), now: 5000 });
		expect(count).toBe(1);
		expect(createObjectUrl).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'application/json' }),
		);
	});

	it('triggers a Markdown download when format is markdown', async () => {
		await exportAiChatLogs({ store: fakeStore([storedChat()]), format: 'markdown', now: 5000 });
		expect(createObjectUrl).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'text/markdown' }),
		);
	});

	it('does not download and returns 0 for an empty store', async () => {
		const count = await exportAiChatLogs({ store: fakeStore([]) });
		expect(count).toBe(0);
		expect(createObjectUrl).not.toHaveBeenCalled();
	});
});
