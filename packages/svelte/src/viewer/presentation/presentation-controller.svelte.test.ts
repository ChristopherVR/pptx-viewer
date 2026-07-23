import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { PresentationController } from './presentation-controller.svelte';

/**
 * `.svelte.test.ts` so the controller's `$state` transition compiles. Asserts
 * the on-click advance contract (step native-timeline builds, then navigate) and
 * that a slide change resets the builds and plays the incoming slide's
 * transition. `start()` touches the DOM (keyframe injection) which happy-dom
 * supports.
 */

function shapeElement(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 100, height: 100 } as unknown as PptxElement;
}

function entranceAnim(targetId: string): PptxNativeAnimation {
	return { targetId, presetClass: 'entr', trigger: 'onClick' } as unknown as PptxNativeAnimation;
}

function slide(id: string, extra: Partial<PptxSlide> = {}): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], ...extra } as PptxSlide;
}

/** Reactive holder for the slide array + current index. */
class Deck {
	slides = $state<PptxSlide[]>([]);
	index = $state(0);
}

describe('presentationController (native-timing)', () => {
	it('advance steps the current slide builds before navigating', () => {
		const deck = new Deck();
		deck.slides = [
			slide('s1', {
				elements: [shapeElement('e1')],
				nativeAnimations: [entranceAnim('e1')],
			}),
			slide('s2'),
		];
		const navigate = vi.fn((i: number) => {
			deck.index = i;
		});
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});
		controller.start();

		// e1 starts hidden (pending entrance).
		expect(controller.elementStates.get('e1')?.visible).toBeFalsy();

		// First advance reveals the entrance build; the slide stays put.
		controller.advance();
		expect(navigate).not.toHaveBeenCalled();
		expect(controller.elementStates.get('e1')?.visible).toBeTruthy();

		// Builds exhausted: the next advance navigates to the following slide.
		controller.advance();
		expect(navigate).toHaveBeenCalledWith(1);
	});

	it('blocks a click/tap advance when the slide sets advanceOnClick=false', () => {
		const deck = new Deck();
		deck.slides = [
			slide('s1', { transition: { type: 'fade', advanceOnClick: false } }),
			slide('s2'),
		];
		const navigate = vi.fn();
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});
		controller.start();

		// A click/tap/swipe (fromClick) must not advance this slide.
		controller.advance(true);
		expect(navigate).not.toHaveBeenCalled();

		// Explicit navigation (keyboard, next button) is never gated.
		controller.advance();
		expect(navigate).toHaveBeenCalledWith(1);
	});

	it('allows a click advance when advanceOnClick is true or undefined', () => {
		const deck = new Deck();
		deck.slides = [
			slide('s1', { transition: { type: 'fade', advanceOnClick: true } }),
			slide('s2'),
		];
		const navigate = vi.fn();
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate,
		});
		controller.start();

		controller.advance(true);
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
		controller.start();

		controller.advance();
		expect(navigate).toHaveBeenCalledWith(1);
	});

	it('onSlideChange resets builds and plays the incoming transition', () => {
		const deck = new Deck();
		deck.slides = [
			slide('s1', {
				elements: [shapeElement('e1')],
				nativeAnimations: [entranceAnim('e1')],
			}),
			slide('s2', { transition: { type: 'fade', durationMs: 600 } }),
		];
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate: () => {},
		});
		controller.start();

		// Reveal a build on slide 0, then move to slide 1.
		controller.advance();
		expect(controller.playback.isComplete).toBeTruthy();
		deck.index = 1;
		controller.onSlideChange(0, 1);

		// Slide 2 has no animations: nothing pending, overlay carries the transition.
		expect(controller.elementStates.has('e1')).toBeFalsy();
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
