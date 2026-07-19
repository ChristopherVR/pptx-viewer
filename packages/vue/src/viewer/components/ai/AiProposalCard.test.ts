import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { ProposalStore } from 'pptx-viewer-shared/ai';
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import AiProposalCard from './AiProposalCard.vue';

/**
 * AiProposalCard tests: a staged proposal renders its diff summary, and Accept /
 * Reject route through the real {@link ProposalStore}. Accept must reach the
 * bridge's `applySlidesUpdate` choke point (so the edit lands as one undoable
 * entry); Reject must drop the proposal without touching the deck.
 */
function makeSlides(): PptxSlide[] {
	return [
		{
			id: 's1',
			slideNumber: 1,
			elements: [{ id: 'e1', type: 'text', text: 'Title', x: 0, y: 0, width: 100, height: 20 }],
		},
	] as unknown as PptxSlide[];
}

function makeBridge(slides: PptxSlide[]): { bridge: PptxAiBridge; applied: { label: string }[] } {
	const applied: { label: string }[] = [];
	let current = slides;
	const bridge = {
		getDeckMeta: () => ({
			slideCount: current.length,
			activeSlideIndex: 0,
			width: 960,
			height: 540,
		}),
		getSlides: () => current,
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: (updater: (s: PptxSlide[]) => PptxSlide[], label: string) => {
			current = updater(structuredClone(current));
			applied.push({ label });
		},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
	return { bridge, applied };
}

describe('aiProposalCard', () => {
	it('renders the proposal label and diff summary', () => {
		const store = new ProposalStore(makeBridge(makeSlides()).bridge);
		store.stage('Recolor title', (slides) => {
			slides[0].elements[0].x = 42;
			return slides;
		});
		const view = store.list()[0];
		const wrapper = mount(AiProposalCard, { props: { proposal: view } });
		expect(wrapper.text()).toContain('Recolor title');
		expect(wrapper.text()).toContain('Suggested change');
		expect(view.summary.length).toBeGreaterThan(0);
	});

	it('routes Accept through the bridge and clears the proposal', async () => {
		const { bridge, applied } = makeBridge(makeSlides());
		const store = new ProposalStore(bridge);
		store.stage('Move title', (slides) => {
			slides[0].elements[0].x = 99;
			return slides;
		});
		const view = store.list()[0];
		const wrapper = mount(AiProposalCard, {
			props: { proposal: view, onAccept: (id: string) => store.apply(id) },
		});
		const accept = wrapper.findAll('button').find((b) => b.text().includes('Apply'));
		await accept?.trigger('click');
		expect(applied).toHaveLength(1);
		expect(applied[0].label).toBe('Move title');
		expect(store.size).toBe(0);
	});

	it('reject drops the proposal without touching the deck', async () => {
		const { bridge, applied } = makeBridge(makeSlides());
		const store = new ProposalStore(bridge);
		store.stage('Delete title', (slides) => {
			slides[0].elements = [];
			return slides;
		});
		const view = store.list()[0];
		const wrapper = mount(AiProposalCard, {
			props: { proposal: view, onReject: (id: string) => store.revert(id) },
		});
		const reject = wrapper.findAll('button').find((b) => b.text().includes('Discard'));
		await reject?.trigger('click');
		expect(applied).toHaveLength(0);
		expect(store.size).toBe(0);
	});
});
