import type { PptxSlide } from 'pptx-viewer-core';
import type { AuthoredSlideRange } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * Authored `p:showPr/p:sldRg` slide-range playback (wave 4 #6).
 *
 * A deck authored to open into slides 2..3 (`<p:showPr><p:sldRg st="2"
 * end="3"/></p:showPr>`) must present only that range when no custom show is
 * active. The controller resolved its show order from hiding + the active
 * custom show alone, so an authored range was silently ignored and the whole
 * deck played. `.svelte.test.ts` so the controller's `$state` fields compile.
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
	authoredRange?: AuthoredSlideRange | null;
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
		getAuthoredRange: () => options.authoredRange ?? null,
	});
	controller.start();
	return { controller, deck, navigate, exit };
}

// 0-based slides 1..2 (deck slides 2..3, 1-based, matching a `<p:sldRg st="2" end="3"/>`).
const RANGE: AuthoredSlideRange = { fromIndex: 1, toIndex: 2 };

describe('presentationController authored slide range', () => {
	it('walks the whole deck when no authored range is present', () => {
		const { controller, deck } = controllerFor({});
		controller.advance();
		expect(deck.index).toBe(1);
	});

	it('starting inside the range, advances only through the range', () => {
		const { controller, deck } = controllerFor({ authoredRange: RANGE, startIndex: 1 });
		controller.advance();
		expect(deck.index).toBe(2);
	});

	it('raises the end screen after the range end, not the last deck slide', () => {
		const { controller, deck } = controllerFor({ authoredRange: RANGE, startIndex: 2 });
		controller.advance();
		expect(controller.endOfShowVisible).toBeTruthy();
		expect(deck.index).toBe(2);
	});

	it('home and End land on the range bounds', () => {
		const { controller, deck } = controllerFor({ authoredRange: RANGE, startIndex: 1 });
		controller.lastSlide();
		expect(deck.index).toBe(2);
		controller.firstSlide();
		expect(deck.index).toBe(1);
	});

	it('still skips a HIDDEN slide inside the range', () => {
		const { controller, deck } = controllerFor({
			hidden: [2],
			authoredRange: { fromIndex: 1, toIndex: 3 },
			startIndex: 1,
		});
		controller.advance();
		expect(deck.index).toBe(3);
	});
});
