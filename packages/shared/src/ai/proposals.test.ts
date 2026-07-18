import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PptxAiSlidesUpdater } from './bridge';
import { makeMockBridge, makeSlide, textElement } from './mock-bridge';
import { ProposalStore } from './proposals';

const addSlideUpdater: PptxAiSlidesUpdater = (slides: PptxSlide[]) => {
	slides.push(makeSlide(slides.length, [textElement('new-el', 'New slide')]));
	return slides;
};

describe('proposal store', () => {
	it('stages a change with a diff summary without applying it', () => {
		const bridge = makeMockBridge();
		const store = new ProposalStore(bridge);
		const proposal = store.stage('Add slide', addSlideUpdater);

		expect(store.size).toBe(1);
		expect(bridge.edits).toHaveLength(0);
		expect(proposal.summary.join(' ')).toContain('Add 1 slide');
		expect(store.get(proposal.id)?.label).toBe('Add slide');
	});

	it('applies a staged proposal as one history entry', () => {
		const bridge = makeMockBridge();
		const store = new ProposalStore(bridge);
		const before = bridge.getSlides().length;
		const proposal = store.stage('Add slide', addSlideUpdater);

		expect(store.apply(proposal.id)).toBeTruthy();
		expect(bridge.edits).toHaveLength(1);
		expect(bridge.getSlides()).toHaveLength(before + 1);
		expect(store.size).toBe(0);
	});

	it('reverts a staged proposal without touching the deck', () => {
		const bridge = makeMockBridge();
		const store = new ProposalStore(bridge);
		const proposal = store.stage('Add slide', addSlideUpdater);

		expect(store.revert(proposal.id)).toBeTruthy();
		expect(store.size).toBe(0);
		expect(bridge.edits).toHaveLength(0);
	});

	it('applies every staged proposal with acceptAll', () => {
		const bridge = makeMockBridge();
		const store = new ProposalStore(bridge);
		store.stage('Add slide A', addSlideUpdater);
		store.stage('Add slide B', addSlideUpdater);

		expect(store.acceptAll()).toBe(2);
		expect(bridge.edits).toHaveLength(2);
		expect(store.size).toBe(0);
	});

	it('returns false when applying or reverting an unknown id', () => {
		const store = new ProposalStore(makeMockBridge());
		expect(store.apply('nope')).toBeFalsy();
		expect(store.revert('nope')).toBeFalsy();
	});
});
