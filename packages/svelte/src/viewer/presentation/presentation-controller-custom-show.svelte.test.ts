import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * Custom-show playback in the Svelte binding.
 *
 * Custom shows were definable and persisted here, but the controller resolved
 * its show order from the deck alone, so selecting a show changed nothing about
 * what presented. These pin the wiring (the controller consults the selected
 * show's membership) rather than the rule itself, which is unit-tested once in
 * `pptx-viewer-shared/render/presentation-show-order`.
 *
 * `.svelte.test.ts` so the controller's `$state` fields compile.
 */

function slide(index: number, hidden = false): PptxSlide {
	return {
		id: `s${index + 1}`,
		rId: `rId${index + 1}`,
		slideNumber: index + 1,
		elements: [],
		hidden,
	} as PptxSlide;
}

class Deck {
	slides = $state<PptxSlide[]>([]);
	index = $state(0);
}

function controllerFor(options: {
	hidden?: readonly number[];
	activeCustomShow?: { slideRIds: string[] } | null;
	startIndex?: number;
}) {
	const deck = new Deck();
	deck.slides = Array.from({ length: 5 }, (_unused, index) =>
		slide(index, options.hidden?.includes(index) ?? false),
	);
	deck.index = options.startIndex ?? 0;
	const navigate = vi.fn((index: number) => {
		deck.index = index;
	});
	const exit = vi.fn();
	const controller = new PresentationController({
		getSlides: () => deck.slides,
		getCurrentIndex: () => deck.index,
		navigate,
		exit,
		getActiveCustomShow: () => options.activeCustomShow ?? null,
	});
	controller.start();
	return { controller, deck, navigate, exit };
}

const SHOW = { slideRIds: ['rId1', 'rId3', 'rId5'] };

describe('presentationController custom shows', () => {
	it('walks the whole deck when no show is selected', () => {
		const { controller, deck } = controllerFor({});
		controller.advance();
		expect(deck.index).toBe(1);
	});

	it('advances only through the selected show members', () => {
		const { controller, deck } = controllerFor({ activeCustomShow: SHOW });
		controller.advance();
		expect(deck.index).toBe(2);
		controller.advance();
		expect(deck.index).toBe(4);
	});

	it('goes back only through the selected show members', () => {
		const { controller, deck } = controllerFor({ activeCustomShow: SHOW, startIndex: 4 });
		controller.previousSlide();
		expect(deck.index).toBe(2);
	});

	it('home and End land on the show first / last member', () => {
		const { controller, deck } = controllerFor({ activeCustomShow: SHOW, startIndex: 2 });
		controller.lastSlide();
		expect(deck.index).toBe(4);
		controller.firstSlide();
		expect(deck.index).toBe(0);
	});

	it('raises the end screen after the last member, not the last deck slide', () => {
		const { controller, deck } = controllerFor({
			activeCustomShow: { slideRIds: ['rId1', 'rId2'] },
			startIndex: 1,
		});
		controller.advance();
		expect(controller.endOfShowVisible).toBeTruthy();
		expect(deck.index).toBe(1);
	});

	it('still skips a HIDDEN member: hiding wins over membership', () => {
		const { controller, deck } = controllerFor({ hidden: [2], activeCustomShow: SHOW });
		controller.advance();
		expect(deck.index).toBe(4);
	});

	it('falls back to the whole deck when the selected show resolves to nothing', () => {
		const { controller, deck } = controllerFor({ activeCustomShow: { slideRIds: [] } });
		controller.advance();
		expect(deck.index).toBe(1);
	});
});
