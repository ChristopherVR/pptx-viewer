// @vitest-environment happy-dom
import type { ChatTransport } from 'ai';
import type { PptxSlide } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiChatSession,
	PptxAiConfig,
	PptxAiUIMessage,
	ToolCanvasTarget,
} from 'pptx-viewer-shared/ai';
import { createAiChatSession } from 'pptx-viewer-shared/ai';
/**
 * Live "AI as a collaborator" focus: as each tool call streams in, the canvas
 * must navigate to the slide it targets AND flash the highlight, driven from the
 * MESSAGE STREAM (not `onToolCall`), the moment the tool input is available and
 * WITHOUT waiting for the tool output or a staged proposal to be applied.
 *
 * The regression this guards: `create_chart` targeting slide 2 left the canvas
 * on slide 1 because navigation was wired only through the client `onToolCall`,
 * which never fires in in-process `model` mode. A scripted `kind: 'transport'`
 * stub replays the tool-call stream so the assertion is deterministic. A tiny
 * harness drives {@link useAiConversation} directly (no heavy panel subtree),
 * mirroring the exact `onToolTarget -> bridge.goToSlide` wiring AiConversation
 * uses in production.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAiConversation } from './useAiConversation';

function makeDeck(): PptxSlide[] {
	return [0, 1, 2].map(
		(i) => ({ id: `s${i}`, slideNumber: i + 1, elements: [] }) as unknown as PptxSlide,
	);
}

function makeBridge(goToSlide: (index: number) => void): PptxAiBridge {
	const slides = makeDeck();
	return {
		getDeckMeta: () => ({
			slideCount: slides.length,
			activeSlideIndex: 0,
			width: 960,
			height: 540,
		}),
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide,
		selectElements: () => {},
		applySlidesUpdate: () => {},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
}

type StreamChunk = Record<string, unknown>;

function toolInput(toolCallId: string, toolName: string, input: unknown): StreamChunk[] {
	return [
		{ type: 'tool-input-start', toolCallId, toolName },
		{ type: 'tool-input-available', toolCallId, toolName, input },
	];
}

function scriptedTransport(steps: StreamChunk[]): ChatTransport<PptxAiUIMessage> {
	return {
		async sendMessages() {
			return new ReadableStream({
				start(controller) {
					controller.enqueue({ type: 'start' });
					controller.enqueue({ type: 'start-step' });
					for (const chunk of steps) {
						controller.enqueue(chunk);
					}
					controller.enqueue({ type: 'finish-step' });
					controller.enqueue({ type: 'finish' });
					controller.close();
				},
			});
		},
		async reconnectToStream() {
			return null;
		},
	} as unknown as ChatTransport<PptxAiUIMessage>;
}

function config(steps: StreamChunk[]): PptxAiConfig {
	return { connection: { kind: 'transport', transport: scriptedTransport(steps) } };
}

/** Harness that mirrors AiConversation's onToolTarget -> goToSlide wiring. */
function Harness(props: {
	session: PptxAiChatSession;
	config: PptxAiConfig;
	bridge: PptxAiBridge;
	onFlash: (target: ToolCanvasTarget | null) => void;
	sendRef: { current: ((text: string) => void) | null };
}) {
	const chat = useAiConversation(props.session, props.config, props.bridge, {
		onToolTarget: (target) => {
			if (target && target.slideIndex !== undefined) {
				props.bridge.goToSlide(target.slideIndex);
			}
			props.onFlash(target);
		},
	});
	props.sendRef.current = chat.send;
	return null;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	host?.remove();
	host = null;
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function flush(times = 4): Promise<void> {
	for (let i = 0; i < times; i += 1) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: predicate not satisfied before deadline');
		}
		await flush(2);
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

async function run(steps: StreamChunk[]): Promise<{
	goToSlide: ReturnType<typeof vi.fn>;
	flash: ReturnType<typeof vi.fn>;
}> {
	const goToSlide = vi.fn();
	const flash = vi.fn();
	const cfg = config(steps);
	const bridge = makeBridge(goToSlide);
	const session = await createAiChatSession(bridge, cfg);
	const sendRef: { current: ((text: string) => void) | null } = { current: null };

	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => {
		root?.render(
			React.createElement(Harness, { session, config: cfg, bridge, onFlash: flash, sendRef }),
		);
	});
	await flush();
	act(() => sendRef.current?.('go'));
	return { goToSlide, flash };
}

describe('useAiConversation live focus', () => {
	it('navigates + highlights from the tool input, not gated on apply', async () => {
		// create_chart on slide index 1 (== slide 2); a staged write, never applied.
		const { goToSlide, flash } = await run(toolInput('c1', 'create_chart', { slideIndex: 1 }));
		await waitFor(() => goToSlide.mock.calls.length > 0);
		expect(goToSlide).toHaveBeenCalledWith(1);
		expect(flash).toHaveBeenCalledWith({ slideIndex: 1, elementIds: [] });
	});

	it('lets the latest tool target win across a burst of calls', async () => {
		const { goToSlide } = await run([
			...toolInput('c1', 'get_slide', { slideIndex: 0 }),
			...toolInput('c2', 'create_chart', { slideIndex: 2 }),
		]);
		await waitFor(() => goToSlide.mock.calls.some((c) => c[0] === 2));
		// The latest target (slide index 2) is the final navigation and sticks.
		expect(goToSlide.mock.calls.at(-1)?.[0]).toBe(2);
	});
});
