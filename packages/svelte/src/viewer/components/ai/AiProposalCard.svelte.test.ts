import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';
import { ProposalStore } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AiProposalCard from './AiProposalCard.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function slide(id: string): PptxSlide {
	return { id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

/** A minimal in-memory bridge that records the labels it was asked to apply. */
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

describe('aiProposalCard', () => {
	it('renders the proposal label and summary', () => {
		const bridge = fakeBridge();
		const store = new ProposalStore(bridge);
		store.stage('Add a title', (slides) => slides);
		const target = document.createElement('div');
		const instance = mount(AiProposalCard, {
			target,
			props: { proposal: store.list()[0], onaccept: vi.fn(), onreject: vi.fn() },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('.pptx-svelte-ai-proposal-label')?.textContent).toBe('Add a title');
		expect(target.querySelector('.pptx-svelte-ai-proposal-btn.is-accept')).not.toBeNull();
	});

	it('routes Accept through the proposal store to the bridge write choke point', () => {
		const bridge = fakeBridge();
		const store = new ProposalStore(bridge);
		store.stage('Add a title', (slides) => slides);
		const applySpy = vi.spyOn(store, 'apply');
		const proposal = store.list()[0];

		const target = document.createElement('div');
		const instance = mount(AiProposalCard, {
			target,
			props: {
				proposal,
				onaccept: (id: string) => store.apply(id),
				onreject: (id: string) => store.revert(id),
			},
		});
		cleanup = () => unmount(instance);

		target.querySelector<HTMLButtonElement>('.pptx-svelte-ai-proposal-btn.is-accept')?.click();

		expect(applySpy).toHaveBeenCalledWith(proposal.id);
		// Applying routes through the bridge's single write choke point.
		expect(bridge.applied).toStrictEqual(['Add a title']);
	});

	it('routes Reject through the store without touching the bridge', () => {
		const bridge = fakeBridge();
		const store = new ProposalStore(bridge);
		store.stage('Delete slide 2', (slides) => slides);
		const proposal = store.list()[0];

		const target = document.createElement('div');
		const instance = mount(AiProposalCard, {
			target,
			props: {
				proposal,
				onaccept: (id: string) => store.apply(id),
				onreject: (id: string) => store.revert(id),
			},
		});
		cleanup = () => unmount(instance);

		target.querySelector<HTMLButtonElement>('.pptx-svelte-ai-proposal-btn.is-reject')?.click();

		expect(store.size).toBe(0);
		expect(bridge.applied).toStrictEqual([]);
	});
});
