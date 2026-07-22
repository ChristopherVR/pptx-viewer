// @vitest-environment happy-dom
import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, vars?: Record<string, unknown>) =>
			vars && 'count' in vars ? `${key}:${String(vars.count)}` : key,
	}),
}));

const downloaded: { blob: Blob; filename: string }[] = [];
vi.mock(import('../utils/dom-helpers'), () => ({
	downloadBlob: (blob: Blob, filename: string) => {
		downloaded.push({ blob, filename });
	},
}));

const { SettingsAiTab } = await import('./SettingsAiTab');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	downloaded.length = 0;
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function chatWithToolCall(): PptxAiStoredChat {
	return {
		id: 'chat-1',
		title: 'Recolor the title',
		deckId: 'deck::3',
		createdAt: 1_000,
		updatedAt: 2_000,
		messages: [
			{
				id: 'm2',
				role: 'assistant',
				parts: [
					{
						type: 'tool-update_element_style',
						toolCallId: 'call-1',
						state: 'output-available',
						input: { color: 'FF0000' },
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

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

function buttonByText(text: string): HTMLButtonElement {
	const btn = Array.from(container.querySelectorAll('button')).find((b) =>
		b.textContent?.includes(text),
	);
	expect(btn).toBeDefined();
	return btn as HTMLButtonElement;
}

describe('settingsAiTab', () => {
	it('shows the stored-chat count from the store', async () => {
		act(() => root.render(<SettingsAiTab store={mockStore([chatWithToolCall()])} />));
		await flush();
		expect(container.textContent).toContain('pptx.ai.exportLogsStoredCount:1');
	});

	it('exports a JSON blob that includes the tool call name, input, and output', async () => {
		const store = mockStore([chatWithToolCall()]);
		act(() => root.render(<SettingsAiTab store={store} />));
		await flush();

		await act(async () => {
			buttonByText('pptx.ai.exportLogsJson').click();
			await Promise.resolve();
		});
		await flush();

		expect(store.loadChat).toHaveBeenCalledWith('chat-1');
		expect(downloaded).toHaveLength(1);
		const parsed = JSON.parse(await downloaded[0].blob.text()) as {
			chats: {
				messages: { toolCalls: { toolName: string; input: unknown; output: unknown }[] }[];
			}[];
		};
		const call = parsed.chats[0].messages[0].toolCalls[0];
		expect(call.toolName).toBe('update_element_style');
		expect(call.input).toStrictEqual({ color: 'FF0000' });
		expect(call.output).toStrictEqual({ updated: true });
		expect(container.textContent).toContain('pptx.ai.exportLogsDone:1');
	});

	it('shows the empty-state message when there are no chats', async () => {
		const store = mockStore([]);
		act(() => root.render(<SettingsAiTab store={store} />));
		await flush();
		await act(async () => {
			buttonByText('pptx.ai.exportLogsJson').click();
			await Promise.resolve();
		});
		await flush();
		expect(downloaded).toHaveLength(0);
		expect(container.textContent).toContain('pptx.ai.noChatsToExport');
	});
});
