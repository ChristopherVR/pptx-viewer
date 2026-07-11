import type { PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * `.svelte.test.ts` so the controller's `$state` transition compiles. Asserts
 * the on-click advance contract (step builds, then navigate) and that a slide
 * change resets the builds and plays the incoming slide's transition. `start()`
 * touches the DOM (keyframe injection) which happy-dom supports.
 */

function slide(id: string, extra: Partial<PptxSlide> = {}): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], ...extra };
}

const clickAnim: PptxElementAnimation = {
	elementId: 'e1',
	entrance: 'fadeIn',
	durationMs: 500,
	trigger: 'onClick',
};

/** Reactive holder for the slide array + current index. */
class Deck {
	slides = $state<PptxSlide[]>([]);
	index = $state(0);
}

describe('presentationController', () => {
	it('advance steps the current slide builds before navigating', () => {
		const deck = new Deck();
		deck.slides = [slide('s1', { animations: [clickAnim] }), slide('s2')];
		const navigate = vi.fn((i: number) => {
			deck.index = i;
		});
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});

		// First advance reveals the entrance build; the slide stays put.
		controller.advance();
		expect(navigate).not.toHaveBeenCalled();
		expect(controller.elementStyles.get('e1')?.['animation-name']).toBe('pptx-vue-fadeIn');

		// Builds exhausted: the next advance navigates to the following slide.
		controller.advance();
		expect(navigate).toHaveBeenCalledWith(1);
	});

	it('advances straight away on a slide with no animations', () => {
		const deck = new Deck();
		deck.slides = [slide('s1'), slide('s2')];
		const navigate = vi.fn();
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});

		controller.advance();
		expect(navigate).toHaveBeenCalledWith(1);
	});

	it('onSlideChange resets builds and plays the incoming transition', () => {
		const deck = new Deck();
		deck.slides = [
			slide('s1', { animations: [clickAnim] }),
			slide('s2', { transition: { type: 'fade', durationMs: 600 } }),
		];
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate: () => {},
		});

		// Reveal a build on slide 0, then move to slide 1.
		controller.advance();
		expect(controller.playback.step).toBe(1);
		deck.index = 1;
		controller.onSlideChange(0, 1);

		expect(controller.playback.step).toBe(0);
		expect(controller.transition).not.toBeNull();
		expect(controller.transition?.transition.type).toBe('fade');
		expect(controller.transition?.outgoing?.id).toBe('s1');
		expect(controller.transition?.incoming?.id).toBe('s2');
	});

	it('onSlideChange clears the overlay for a none/absent transition', () => {
		const deck = new Deck();
		deck.slides = [slide('s1', { transition: { type: 'fade', durationMs: 600 } }), slide('s2')];
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate: () => {},
		});

		controller.onSlideChange(0, 1);
		expect(controller.transition).toBeNull();
	});

	it('endTransition and stop drop the overlay', () => {
		const deck = new Deck();
		deck.slides = [slide('s1'), slide('s2', { transition: { type: 'fade', durationMs: 600 } })];
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate: () => {},
		});

		controller.onSlideChange(0, 1);
		expect(controller.transition).not.toBeNull();
		controller.endTransition();
		expect(controller.transition).toBeNull();
	});
});
