import type { PptxSlide } from 'pptx-viewer-core';
import type {
	PptxAiBridge,
	PptxAiConfig,
	VanillaChatController,
	VanillaChatSnapshot,
} from 'pptx-viewer-shared/ai';
import { createAiChangeAnimator, ProposalStore } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import { createAiPanel } from './ai-panel';
import { createAiFocusController } from './ai-panel-controller';

function slide(id: string): PptxSlide {
	return { id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

/** A minimal in-memory bridge that records applied slide updates. */
function fakeBridge(): PptxAiBridge & { applied: string[] } {
	const applied: string[] = [];
	return {
		applied,
		getDeckMeta: () => ({ slideCount: 1, activeSlideIndex: 0, width: 960, height: 540 }),
		getSlides: () => [slide('s1')],
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => undefined,
		selectElements: () => undefined,
		applySlidesUpdate: (_updater, label) => {
			applied.push(label);
		},
		updateElement: () => undefined,
		applyTheme: () => undefined,
	};
}

/** A controller with a real ProposalStore but no chat/network activity. */
function fakeController(bridge: PptxAiBridge): VanillaChatController {
	const proposals = new ProposalStore(bridge);
	proposals.stage('Add a title', (slides) => slides);
	return {
		sendMessage: async () => undefined,
		regenerate: async () => undefined,
		stop: async () => undefined,
		clearError: () => undefined,
		getSnapshot: () => ({ messages: [], status: 'ready' }),
		subscribe: () => () => undefined,
		proposals,
		changeAnimator: createAiChangeAnimator(),
	};
}

const config: PptxAiConfig = {
	connection: { kind: 'transport', transport: {} as never },
};

let host: HTMLElement | null = null;

afterEach(() => {
	host?.remove();
	host = null;
});

describe('createAiPanel', () => {
	it('renders the composer + a staged proposal card', async () => {
		host = document.createElement('div');
		document.body.appendChild(host);
		const bridge = fakeBridge();

		await createAiPanel({
			host,
			doc: document,
			t: createTranslator('en'),
			bridge,
			config,
			createChat: async () => fakeController(bridge),
		});

		expect(host.querySelector('.pptxv-ai-composer')).toBeTruthy();
		expect(host.querySelector('.pptxv-ai-input')).toBeTruthy();
		const proposals = host.querySelector<HTMLElement>('.pptxv-ai-proposals');
		expect(proposals?.hidden).toBeFalsy();
		const card = host.querySelector('.pptxv-ai-proposal');
		expect(card).toBeTruthy();
		expect(card?.querySelector('.pptxv-ai-proposal-label')?.textContent).toBe('Add a title');
	});

	it('applies the proposal through the controller store when Accept is clicked', async () => {
		host = document.createElement('div');
		document.body.appendChild(host);
		const bridge = fakeBridge();
		const controller = fakeController(bridge);
		const applySpy = vi.spyOn(controller.proposals, 'apply');

		await createAiPanel({
			host,
			doc: document,
			t: createTranslator('en'),
			bridge,
			config,
			createChat: async () => controller,
		});

		const accept = host.querySelector<HTMLButtonElement>('.pptxv-ai-proposal-btn.is-accept');
		expect(accept).toBeTruthy();
		accept?.click();

		expect(applySpy).toHaveBeenCalledOnce();
		// Applying routes through the bridge's single write choke point.
		expect(bridge.applied).toStrictEqual(['Add a title']);
		// The card is cleared and the region hidden after the last proposal applies.
		expect(host.querySelector('.pptxv-ai-proposal')).toBeNull();
		expect(host.querySelector<HTMLElement>('.pptxv-ai-proposals')?.hidden).toBeTruthy();
	});

	it('navigates + highlights the canvas as a tool call runs (live focus)', async () => {
		host = document.createElement('div');
		document.body.appendChild(host);
		const bridge = fakeBridge();
		const snapshot: VanillaChatSnapshot = {
			status: 'ready',
			messages: [
				{
					id: 'm1',
					role: 'assistant',
					parts: [
						{
							type: 'tool-update_element',
							toolCallId: 'c1',
							state: 'output-available',
							input: { slideIndex: 4, elementId: 'el-2' },
						},
					],
				} as unknown as VanillaChatSnapshot['messages'][number],
			],
		};
		const controller: VanillaChatController = {
			sendMessage: async () => undefined,
			regenerate: async () => undefined,
			stop: async () => undefined,
			clearError: () => undefined,
			getSnapshot: () => snapshot,
			subscribe: () => () => undefined,
			proposals: new ProposalStore(bridge),
			changeAnimator: createAiChangeAnimator(),
		};
		const store = createStore({ ...createInitialViewerState(), currentSlide: 4 });
		const focus = createAiFocusController({ store, requestOpen: () => undefined });
		const goToSlide = vi.fn();

		await createAiPanel({
			host,
			doc: document,
			t: createTranslator('en'),
			bridge,
			config,
			controller: focus,
			goToSlide,
			createChat: async () => controller,
		});

		// The tool's slide/element drove a navigation + an active on-canvas ring.
		expect(goToSlide).toHaveBeenCalledWith(4);
		expect(focus.getHighlights()).toStrictEqual([
			{ slideIndex: 4, elementId: 'el-2', variant: 'active' },
		]);
	});
});
