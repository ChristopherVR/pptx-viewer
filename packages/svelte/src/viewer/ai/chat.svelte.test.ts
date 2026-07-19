import type {
	PptxAiBridge,
	PptxAiChatSession,
	PptxAiConfig,
	ToolCanvasTarget,
} from 'pptx-viewer-shared/ai';
import { describe, expect, it, vi } from 'vitest';

import { SvelteAiChat } from './chat.svelte';

/** Captures the options the panel passes to `@ai-sdk/svelte`'s `Chat`. */
interface CapturedChat {
	onToolCall?: (arg: { toolCall: unknown }) => Promise<void> | void;
	addToolOutput: ReturnType<typeof vi.fn>;
}
let captured: CapturedChat | undefined;

vi.mock(import('@ai-sdk/svelte'), () => ({
	Chat: class {
		messages: unknown[] = [];
		status = 'ready';
		error: undefined;
		addToolOutput = vi.fn();
		constructor(options: { onToolCall?: CapturedChat['onToolCall'] }) {
			captured = { onToolCall: options.onToolCall, addToolOutput: this.addToolOutput };
		}
		sendMessage = vi.fn();
		stop = vi.fn();
		clearError = vi.fn();
	},
}));

function fakeBridge(): PptxAiBridge {
	return {
		getDeckMeta: () => ({ slideCount: 1, activeSlideIndex: 0, width: 960, height: 540 }),
		getSlides: () => [],
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => undefined,
		selectElements: () => undefined,
		applySlidesUpdate: () => undefined,
		updateElement: () => undefined,
		applyTheme: () => undefined,
	};
}

function fakeSession(): PptxAiChatSession {
	return {
		transport: {} as never,
		sendAutomaticallyWhen: () => false,
		clientExecutesTools: true,
		executeToolCall: vi.fn().mockResolvedValue({ ok: true }),
		proposals: {
			list: () => [],
			apply: vi.fn(),
			revert: vi.fn(),
			acceptAll: vi.fn(),
			clear: vi.fn(),
		},
	} as unknown as PptxAiChatSession;
}

const config: PptxAiConfig = { connection: { kind: 'transport', transport: {} as never } };

describe('svelteAiChat live canvas focus', () => {
	it('reports the tool canvas target on each tool call', async () => {
		captured = undefined;
		const targets: (ToolCanvasTarget | null)[] = [];
		const chat = new SvelteAiChat({
			bridge: fakeBridge(),
			config,
			checkAvailable: () => Promise.resolve(true),
			createSession: () => Promise.resolve(fakeSession()),
			onToolTarget: (target) => targets.push(target),
		});
		await chat.init();
		expect(captured?.onToolCall).toBeTypeOf('function');

		await captured?.onToolCall?.({
			toolCall: {
				toolName: 'update_text',
				toolCallId: 'c1',
				input: { slideIndex: 4, elementId: 'shape-9', text: 'Hi' },
			},
		});

		// The tool referencing slide 5 / shape-9 yields a concrete canvas target.
		expect(targets).toStrictEqual([{ slideIndex: 4, elementIds: ['shape-9'] }]);
		// The tool output was still handed back to the SDK.
		expect(captured?.addToolOutput).toHaveBeenCalledWith(
			expect.objectContaining({ tool: 'update_text', toolCallId: 'c1' }),
		);
	});

	it('reports null for a deck-wide tool with no single slide/element', async () => {
		captured = undefined;
		const targets: (ToolCanvasTarget | null)[] = [];
		const chat = new SvelteAiChat({
			bridge: fakeBridge(),
			config,
			checkAvailable: () => Promise.resolve(true),
			createSession: () => Promise.resolve(fakeSession()),
			onToolTarget: (target) => targets.push(target),
		});
		await chat.init();

		await captured?.onToolCall?.({
			toolCall: { toolName: 'get_deck_overview', toolCallId: 'c2', input: {} },
		});
		expect(targets).toStrictEqual([null]);
	});
});
