import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiConfig, VanillaChatController } from 'pptx-viewer-shared/ai';
import { ProposalStore } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createAiPanel } from './ai-panel';

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
});
