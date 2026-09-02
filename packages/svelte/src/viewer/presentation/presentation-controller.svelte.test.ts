import type { PptxElement, PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import { hasPersistentAudio, registerPersistentAudio } from 'pptx-viewer-shared';
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

	it('stop() ends cross-slide persistent audio; onSlideChange leaves it playing', () => {
		const deck = new Deck();
		deck.slides = [slide('s1'), slide('s2')];
		const controller = new PresentationController({
			getSlides: () => deck.slides,
			getCurrentIndex: () => deck.index,
			navigate: () => {},
		});
		controller.start();

		registerPersistentAudio('bg-track', 'data:audio/mpeg;base64,AAAA', 'audio/mpeg', true, 1, 0);
		expect(hasPersistentAudio('bg-track')).toBeTruthy();

		// A slide change must NOT kill the track: that is the whole feature.
		controller.onSlideChange(0, 1);
		expect(hasPersistentAudio('bg-track')).toBeTruthy();

		// Leaving the show ends it.
		controller.stop();
		expect(hasPersistentAudio('bg-track')).toBeFalsy();
		expect(document.querySelectorAll('[data-pptx-persistent-audio]')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Hidden slides ("Hide Slide") and the end of the show
// ---------------------------------------------------------------------------

/** A deck of `hidden` flags plus the controller driving it. */
function showHarness(hidden: boolean[], endWithBlackSlide?: boolean, loopContinuously?: boolean) {
	const deck = new Deck();
	deck.slides = hidden.map((isHidden, index) =>
		slide(`s${index + 1}`, { slideNumber: index + 1, hidden: isHidden }),
	);
	const exit = vi.fn();
	const controller = new PresentationController({
		getSlides: () => deck.slides,
		getCurrentIndex: () => deck.index,
		navigate: (i: number) => {
			deck.index = i;
		},
		exit,
		...(endWithBlackSlide === undefined ? {} : { getEndWithBlackSlide: () => endWithBlackSlide }),
		...(loopContinuously === undefined ? {} : { getLoopContinuously: () => loopContinuously }),
	});
	controller.start();
	return { deck, controller, exit };
}

describe('presentationController hidden slides', () => {
	it('skips a hidden slide advancing forward', () => {
		const { deck, controller } = showHarness([false, true, false]);
		controller.advance();
		expect(deck.index).toBe(2);
	});

	it('skips a hidden slide going backward', () => {
		const { deck, controller } = showHarness([false, true, false]);
		deck.index = 2;
		controller.previousSlide();
		expect(deck.index).toBe(0);
	});

	it('stays on the first show slide on a backward press', () => {
		const { deck, controller } = showHarness([false, false]);
		controller.previousSlide();
		expect(deck.index).toBe(0);
	});

	it('ends the show at the last VISIBLE slide when trailing slides are hidden', () => {
		const { deck, controller } = showHarness([false, false, true, true]);
		deck.index = 1;
		controller.advance();
		expect(deck.index).toBe(1);
		expect(controller.endOfShowVisible).toBeTruthy();
	});

	it('lands Home / End on the first / last VISIBLE slide', () => {
		const { deck, controller } = showHarness([true, false, false, true]);
		controller.lastSlide();
		expect(deck.index).toBe(2);
		controller.firstSlide();
		expect(deck.index).toBe(1);
	});

	it('escapes forward from a hidden slide reached by a typed number', () => {
		// `viewer.goTo` (the typed-number jump) is deliberately unfiltered, so the
		// show can be sitting on a hidden slide when the next advance arrives.
		const { deck, controller } = showHarness([false, true, false]);
		deck.index = 1;
		controller.advance();
		expect(deck.index).toBe(2);
	});

	it('presents every slide when the whole deck is hidden', () => {
		const { deck, controller } = showHarness([true, true]);
		controller.advance();
		expect(deck.index).toBe(1);
	});
});

describe('presentationController end of show', () => {
	it('raises the black end screen by default', () => {
		const { controller, exit } = showHarness([false]);
		controller.advance();
		expect(controller.endOfShowVisible).toBeTruthy();
		expect(exit).not.toHaveBeenCalled();
	});

	it('exits the show outright when the option is off', () => {
		const { controller, exit } = showHarness([false], false);
		controller.advance();
		expect(controller.endOfShowVisible).toBeFalsy();
		expect(exit).toHaveBeenCalledOnce();
	});

	it('exits on a second forward press from the end screen', () => {
		const { controller, exit } = showHarness([false]);
		controller.advance();
		controller.advance();
		expect(exit).toHaveBeenCalledOnce();
	});

	it('dismisses the end screen on a backward press without exiting', () => {
		const { controller, exit } = showHarness([false]);
		controller.advance();
		expect(controller.retreat()).toBeTruthy();
		expect(controller.endOfShowVisible).toBeFalsy();
		expect(exit).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Slide Show > Set Up Show > "Loop continuously until 'Esc'"
// ---------------------------------------------------------------------------

describe('presentationController loop continuously', () => {
	it('wraps to the first show slide instead of raising the end screen', () => {
		const { deck, controller, exit } = showHarness([false, false, false], undefined, true);
		deck.index = 2;
		controller.advance();
		expect(deck.index).toBe(0);
		expect(controller.endOfShowVisible).toBeFalsy();
		expect(exit).not.toHaveBeenCalled();
	});

	it('wraps to the first VISIBLE slide when the first is hidden', () => {
		const { deck, controller } = showHarness([true, false, false], undefined, true);
		deck.index = 2;
		controller.advance();
		expect(deck.index).toBe(1);
	});

	it('does not loop when the option is off', () => {
		const { deck, controller } = showHarness([false, false], undefined, false);
		deck.index = 1;
		controller.advance();
		expect(deck.index).toBe(1);
		expect(controller.endOfShowVisible).toBeTruthy();
	});
});
