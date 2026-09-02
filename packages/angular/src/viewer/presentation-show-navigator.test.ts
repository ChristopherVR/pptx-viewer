import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { AuthoredSlideRange } from '../internal/shared';
import type { AnimationPlaybackService } from './animation-playback.service';
import type { PresentationAnnotationsService } from './presentation-annotations.service';
import { PresentationShowNavigator } from './presentation-show-navigator';

/**
 * The show navigator's slide-selection rules, driven directly (no TestBed): the
 * class is a plain signal holder, so its dependencies are trivially faked.
 */

function slides(...hidden: boolean[]): PptxSlide[] {
	return hidden.map(
		(isHidden, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				elements: [],
				hidden: isHidden,
			}) as PptxSlide,
	);
}

interface Harness {
	navigator: PresentationShowNavigator;
	emitted: number[];
	closes: number;
}

function makeNavigator(
	deck: PptxSlide[],
	endWithBlackSlide?: boolean,
	options?: { loopContinuously?: boolean; authoredRange?: AuthoredSlideRange },
): Harness {
	const emitted: number[] = [];
	let closes = 0;
	// Only the members the navigator actually touches are implemented.
	const playback = {
		advance: () => false,
		isSeededCompleted: () => false,
		setSlide: () => undefined,
	} as unknown as AnimationPlaybackService;
	const annotations = {
		setActiveSlide: () => undefined,
	} as unknown as PresentationAnnotationsService;

	const navigator = new PresentationShowNavigator({
		slides: () => deck,
		currentSlide: () => deck[navigator.currentIndex()],
		showWithAnimation: () => true,
		playback,
		annotations,
		emitIndex: (index) => emitted.push(index),
		requestClose: () => {
			closes += 1;
		},
		...(endWithBlackSlide === undefined ? {} : { endWithBlackSlide: () => endWithBlackSlide }),
		...(options?.loopContinuously === undefined
			? {}
			: { loopContinuously: () => options.loopContinuously }),
		...(options?.authoredRange === undefined ? {} : { authoredRange: () => options.authoredRange }),
	});
	return {
		navigator,
		emitted,
		get closes() {
			return closes;
		},
	};
}

describe('presentationShowNavigator hidden slides', () => {
	it('skips a hidden slide advancing forward', () => {
		const { navigator } = makeNavigator(slides(false, true, false));
		navigator.navigate('next');
		expect(navigator.currentIndex()).toBe(2);
	});

	it('skips a hidden slide going backward', () => {
		const { navigator } = makeNavigator(slides(false, true, false));
		navigator.goToSlide(2);
		navigator.navigate('prev');
		expect(navigator.currentIndex()).toBe(0);
	});

	it('stays on the first show slide on a backward press', () => {
		const { navigator } = makeNavigator(slides(false, false));
		navigator.navigate('prev');
		expect(navigator.currentIndex()).toBe(0);
	});

	it('ends the show at the last VISIBLE slide when trailing slides are hidden', () => {
		const { navigator } = makeNavigator(slides(false, false, true, true));
		navigator.goToSlide(1);
		navigator.navigate('next');
		expect(navigator.currentIndex()).toBe(1);
		expect(navigator.endOfShow()).toBeTruthy();
	});

	it('lands Home / End on the first / last VISIBLE slide', () => {
		const { navigator } = makeNavigator(slides(true, false, false, true));
		navigator.navigate('last');
		expect(navigator.currentIndex()).toBe(2);
		navigator.navigate('first');
		expect(navigator.currentIndex()).toBe(1);
	});

	it('still reaches a hidden slide by direct jump (typed slide number)', () => {
		const { navigator, emitted } = makeNavigator(slides(false, true, false));
		navigator.goToSlide(1);
		expect(navigator.currentIndex()).toBe(1);
		expect(emitted).toStrictEqual([1]);
	});

	it('escapes forward from a hidden slide reached by number', () => {
		const { navigator } = makeNavigator(slides(false, true, false));
		navigator.goToSlide(1);
		navigator.navigate('next');
		expect(navigator.currentIndex()).toBe(2);
	});

	it('presents every slide when the whole deck is hidden', () => {
		// Deliberate: a show that opens on an inert black screen reads as broken.
		const { navigator } = makeNavigator(slides(true, true));
		navigator.navigate('next');
		expect(navigator.currentIndex()).toBe(1);
	});
});

describe('presentationShowNavigator transition direction', () => {
	function deckWithTransitions(): PptxSlide[] {
		return [
			{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] } as PptxSlide,
			{
				id: 's2',
				rId: 'rId2',
				slideNumber: 2,
				elements: [],
				transition: { type: 'morph', durationMs: 500 },
			} as PptxSlide,
		];
	}

	it('plays the incoming slide transition on a forward step', () => {
		const { navigator } = makeNavigator(deckWithTransitions());
		navigator.navigate('next');
		expect(navigator.activeTransition()?.transition.type).toBe('morph');
		expect(navigator.activeTransition()?.outgoing.id).toBe('s1');
	});

	it('replays the leaving slide transition on a backward step', () => {
		const { navigator } = makeNavigator(deckWithTransitions());
		navigator.goToSlide(1);
		navigator.navigate('prev');
		// Stepping back onto slide 1 replays slide 2's morph in reverse.
		expect(navigator.activeTransition()?.transition.type).toBe('morph');
		expect(navigator.activeTransition()?.outgoing.id).toBe('s2');
	});
});

describe('presentationShowNavigator end of show', () => {
	it('raises the black end screen by default', () => {
		const harness = makeNavigator(slides(false));
		harness.navigator.navigate('next');
		expect(harness.navigator.endOfShow()).toBeTruthy();
		expect(harness.closes).toBe(0);
	});

	it('raises the black end screen when the option is explicitly on', () => {
		const harness = makeNavigator(slides(false), true);
		harness.navigator.navigate('next');
		expect(harness.navigator.endOfShow()).toBeTruthy();
		expect(harness.closes).toBe(0);
	});

	it('exits the show outright when the option is off', () => {
		const harness = makeNavigator(slides(false), false);
		harness.navigator.navigate('next');
		expect(harness.navigator.endOfShow()).toBeFalsy();
		expect(harness.closes).toBe(1);
	});

	it('exits on a second forward press from the end screen', () => {
		const harness = makeNavigator(slides(false));
		harness.navigator.navigate('next');
		harness.navigator.navigate('next');
		expect(harness.closes).toBe(1);
	});

	it('dismisses the end screen on a backward press without exiting', () => {
		const harness = makeNavigator(slides(false));
		harness.navigator.navigate('next');
		harness.navigator.navigate('prev');
		expect(harness.navigator.endOfShow()).toBeFalsy();
		expect(harness.closes).toBe(0);
	});
});

describe('presentationShowNavigator loopContinuously', () => {
	it('wraps to the first slide instead of ending the show when set', () => {
		const harness = makeNavigator(slides(false, false, false), undefined, {
			loopContinuously: true,
		});
		harness.navigator.goToSlide(2);
		harness.navigator.navigate('next');
		expect(harness.navigator.currentIndex()).toBe(0);
		expect(harness.navigator.endOfShow()).toBeFalsy();
		expect(harness.closes).toBe(0);
	});

	it('still raises the end screen when unset (PowerPoint default)', () => {
		const harness = makeNavigator(slides(false, false, false), undefined, {
			loopContinuously: false,
		});
		harness.navigator.goToSlide(2);
		harness.navigator.navigate('next');
		expect(harness.navigator.currentIndex()).toBe(2);
		expect(harness.navigator.endOfShow()).toBeTruthy();
	});

	it('exits outright when combined with endWithBlackSlide off', () => {
		const harness = makeNavigator(slides(false, false), false, { loopContinuously: false });
		harness.navigator.goToSlide(1);
		harness.navigator.navigate('next');
		expect(harness.closes).toBe(1);
	});
});

describe('presentationShowNavigator authored slide range (p:showPr/p:sldRg)', () => {
	it('restricts forward/backward navigation to the authored range', () => {
		const harness = makeNavigator(slides(false, false, false, false), undefined, {
			authoredRange: { fromIndex: 1, toIndex: 2 },
		});
		harness.navigator.goToSlide(1);
		harness.navigator.navigate('next');
		expect(harness.navigator.currentIndex()).toBe(2);
		harness.navigator.navigate('next');
		// No slide after index 2 within the range: ends the show rather than
		// stepping onto slide index 3, which is outside p:sldRg.
		expect(harness.navigator.endOfShow()).toBeTruthy();
	});

	it('lands Home / End on the range bounds, not the whole deck', () => {
		const harness = makeNavigator(slides(false, false, false, false), undefined, {
			authoredRange: { fromIndex: 1, toIndex: 2 },
		});
		harness.navigator.navigate('last');
		expect(harness.navigator.currentIndex()).toBe(2);
		harness.navigator.navigate('first');
		expect(harness.navigator.currentIndex()).toBe(1);
	});
});
