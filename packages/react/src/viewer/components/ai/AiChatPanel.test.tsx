import { useChat } from '@ai-sdk/react';
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
/**
 * AiChatPanel tests: with a no-op `kind: 'transport'` connection (so no network
 * and no model), the panel bootstraps a real session, reaches the ready state,
 * and renders its title, empty-state hint, and composer. This proves the panel
 * "opens" end to end without a live model.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiPanelController } from '../../hooks/ai/useAiPanelController';

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

function makeBridge(): PptxAiBridge {
	const slides = [{ id: 's1', slideNumber: 1, elements: [] }] as unknown as PptxSlide[];
	return {
		getDeckMeta: () => ({ slideCount: 1, activeSlideIndex: 0, width: 960, height: 540 }),
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: () => {},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
}

/** A minimal AI panel controller (no focus / prefill) for the panel tests. */
function stubPanel(): AiPanelController {
	return {
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
	};
}

/** A transport that never emits: enough to construct a session, never called. */
function stubConfig(): PptxAiConfig {
	const transport = {
		sendMessages: async () => new ReadableStream(),
		reconnectToStream: async () => null,
	};
	return { connection: { kind: 'transport', transport: transport as never } };
}

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	host?.remove();
	host = null;
});

/**
 * Drain micro- and macro-task ticks until the panel reaches its ready state
 * (its composer is rendered): the async availability check, the session build
 * and the useChat mount all have to settle. A fixed tick count was enough
 * locally but raced on a slow CI runner in the Vue twin of this test (CI run
 * 36225299787), so this waits for the composer, up to a generous deadline.
 */
async function flush(): Promise<void> {
	const deadline = Date.now() + 10_000;
	do {
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		});
	} while (!host?.querySelector('textarea') && Date.now() < deadline);
}

describe('aiChatPanel', () => {
	it('renders the panel title and a working close button', async () => {
		let closed = false;
		host = document.createElement('div');
		document.body.appendChild(host);
		root = createRoot(host);
		await act(async () => {
			root?.render(
				React.createElement(AiChatPanel, {
					useChat,
					bridge: makeBridge(),
					config: stubConfig(),
					aiPanel: stubPanel(),
					onClose: () => {
						closed = true;
					},
				}),
			);
		});
		await flush();

		expect(host.textContent).toContain('AI Assistant');
		const closeBtn = [...host.querySelectorAll('button')].find(
			(b) => b.getAttribute('aria-label') === 'Close AI assistant',
		);
		expect(closeBtn).toBeTruthy();
		act(() => {
			closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(closed).toBeTruthy();
	});

	it('reaches the ready state and shows the composer + empty hint', async () => {
		host = document.createElement('div');
		document.body.appendChild(host);
		root = createRoot(host);
		await act(async () => {
			root?.render(
				React.createElement(AiChatPanel, {
					useChat,
					bridge: makeBridge(),
					config: stubConfig(),
					aiPanel: stubPanel(),
					onClose: () => {},
				}),
			);
		});
		await flush();

		const textarea = host.querySelector('textarea');
		expect(textarea).toBeTruthy();
		expect(textarea?.getAttribute('placeholder')).toBe('Ask about this deck…');
		expect(host.textContent).toContain('Ask the assistant');
	});
});
