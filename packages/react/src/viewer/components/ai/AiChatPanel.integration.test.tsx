import type { ChatTransport } from 'ai';
import type { PptxSlide } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiSlidesUpdater,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
/**
 * AiChatPanel end-to-end integration: the REAL panel, wired to a scripted
 * `kind: 'transport'` stub (no live model, no network) over a small in-memory
 * deck. The stub emits one `update_element` tool call, which stages a proposal;
 * the panel renders an {@link AiProposalCard}; clicking Accept routes through
 * the session's ProposalStore to the bridge's `applySlidesUpdate` choke point,
 * mutating the deck as exactly one undoable history entry.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { default: AiChatPanel } = await import('./AiChatPanel');

/** A recorded write through the bridge's single history choke point. */
interface AppliedEdit {
	label: string;
}

function makeDeck(): PptxSlide[] {
	return [
		{
			id: 's1',
			slideNumber: 1,
			elements: [
				{ id: 'el-1', type: 'text', text: 'Original Title', x: 0, y: 0, width: 200, height: 40 },
			],
		},
	] as unknown as PptxSlide[];
}

function makeBridge(): {
	bridge: PptxAiBridge;
	applied: AppliedEdit[];
	current: () => PptxSlide[];
} {
	const applied: AppliedEdit[] = [];
	let slides = makeDeck();
	const bridge = {
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
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: (updater: PptxAiSlidesUpdater, label: string) => {
			slides = updater(structuredClone(slides));
			applied.push({ label });
		},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
	return { bridge, applied, current: () => slides };
}

type StreamChunk = Record<string, unknown>;

/** One assistant step emitting a single client-executed tool call. */
function toolCallStep(toolCallId: string, toolName: string, input: unknown): StreamChunk[] {
	return [
		{ type: 'start' },
		{ type: 'start-step' },
		{ type: 'tool-input-start', toolCallId, toolName },
		{ type: 'tool-input-available', toolCallId, toolName, input },
		{ type: 'finish-step' },
		{ type: 'finish' },
	];
}

/** One assistant step streaming a plain text reply. */
function textStep(text: string): StreamChunk[] {
	return [
		{ type: 'start' },
		{ type: 'start-step' },
		{ type: 'text-start', id: 't' },
		{ type: 'text-delta', id: 't', delta: text },
		{ type: 'text-end', id: 't' },
		{ type: 'finish-step' },
		{ type: 'finish' },
	];
}

/** A transport replaying one prescripted stream per `sendMessages` call. */
function scriptedTransport(steps: StreamChunk[][]): ChatTransport<PptxAiUIMessage> {
	let call = 0;
	return {
		async sendMessages() {
			const chunks = steps[call] ?? textStep('');
			call += 1;
			return new ReadableStream({
				start(controller) {
					for (const chunk of chunks) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
		},
		async reconnectToStream() {
			return null;
		},
	} as unknown as ChatTransport<PptxAiUIMessage>;
}

function stagingConfig(): PptxAiConfig {
	return {
		connection: {
			kind: 'transport',
			transport: scriptedTransport([
				toolCallStep('call-1', 'update_element', {
					slideIndex: 0,
					elementId: 'el-1',
					text: 'AI Edited Title',
				}),
				textStep('I staged a title edit for your review.'),
			]),
		},
	};
}

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	host?.remove();
	host = null;
});

async function flush(times = 8): Promise<void> {
	for (let i = 0; i < times; i += 1) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

async function waitForDom(container: HTMLElement, needle: string, timeoutMs = 3000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!(container.textContent ?? '').includes(needle)) {
		if (Date.now() > deadline) {
			throw new Error(`waitForDom: "${needle}" not found before deadline`);
		}
		await flush(2);
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
	const btn = [...container.querySelectorAll('button')].find((b) =>
		(b.textContent ?? '').includes(label),
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	return btn as HTMLButtonElement;
}

function findByAria(container: HTMLElement, label: string): HTMLButtonElement {
	const btn = [...container.querySelectorAll('button')].find(
		(b) => b.getAttribute('aria-label') === label,
	);
	if (!btn) {
		throw new Error(`button [aria-label="${label}"] not found`);
	}
	return btn as HTMLButtonElement;
}

describe('aiChatPanel integration', () => {
	it('stages a tool-call proposal, then Accept mutates the deck as one undo', async () => {
		const { bridge, applied, current } = makeBridge();

		host = document.createElement('div');
		document.body.appendChild(host);
		root = createRoot(host);
		await act(async () => {
			root?.render(
				React.createElement(AiChatPanel, {
					bridge,
					config: stagingConfig(),
					aiPanel: {
						isOpen: true,
						open: () => {},
						close: () => {},
						toggle: () => {},
						liveFocusTargets: [{ kind: 'slide', slideIndex: 0 }],
						pinnedFocus: null,
						pinFocus: () => {},
						clearPinnedFocus: () => {},
						prefill: { text: '', nonce: 0 },
						askAboutSelection: () => {},
						fixSelection: () => {},
						pickMode: false,
						startPicking: () => {},
						stopPicking: () => {},
						pickTargets: [],
						addPick: () => {},
						clearPicks: () => {},
						canvasHighlights: [],
						canvasAnimating: false,
						flashToolTarget: () => {},
						changeBatch: null,
						showChangeBatch: () => {},
					},
					onClose: () => {},
				}),
			);
		});
		await flush();

		// Panel is live: type a request and send it.
		const textarea = host.querySelector('textarea');
		expect(textarea).toBeTruthy();
		const nativeSetter = Object.getOwnPropertyDescriptor(
			globalThis.HTMLTextAreaElement.prototype,
			'value',
		)?.set;
		act(() => {
			nativeSetter?.call(textarea, 'Rename the title');
			textarea?.dispatchEvent(new Event('input', { bubbles: true }));
		});
		act(() => {
			findByAria(host as HTMLElement, 'Send').dispatchEvent(
				new MouseEvent('click', { bubbles: true }),
			);
		});

		// The scripted tool call stages a proposal; the review card renders.
		await waitForDom(host, 'Suggested change');
		expect(host.textContent).toContain('AI Edited Title');
		// Not applied yet: the deck is untouched.
		expect(applied).toHaveLength(0);
		expect((current()[0].elements[0] as { text: string }).text).toBe('Original Title');

		// Accept routes through the ProposalStore to the bridge choke point.
		act(() => {
			findButton(host as HTMLElement, 'Apply').dispatchEvent(
				new MouseEvent('click', { bubbles: true }),
			);
		});
		await flush();

		expect(applied).toHaveLength(1);
		expect((current()[0].elements[0] as { text: string }).text).toBe('AI Edited Title');
		// The review strip clears once the proposal is applied.
		expect(host.textContent).not.toContain('Suggested change');
	});
});
