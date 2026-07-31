import { describe, expect, it } from 'vitest';

import {
	firstShowSlideIndex,
	hasShowSlideAfter,
	lastShowSlideIndex,
	nextPresentedSlide,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveShowSlideIndexes,
} from './presentation-show-order';
import type { ShowOrderSlide } from './presentation-show-order';

function deck(...hidden: boolean[]): ShowOrderSlide[] {
	return hidden.map((isHidden, index) => ({
		id: `slide-${index + 1}`,
		rId: `rId${index + 1}`,
		hidden: isHidden,
	}));
}

describe('resolveShowSlideIndexes', () => {
	it('drops hidden slides from the show order', () => {
		expect(resolveShowSlideIndexes(deck(false, true, false, false))).toStrictEqual([0, 2, 3]);
	});

	it('keeps every slide when none is hidden', () => {
		expect(resolveShowSlideIndexes(deck(false, false, false))).toStrictEqual([0, 1, 2]);
	});

	it('returns an empty order for an empty deck', () => {
		expect(resolveShowSlideIndexes([])).toStrictEqual([]);
	});

	it('falls back to the whole deck when every slide is hidden', () => {
		// Deliberate deviation: an inert black rectangle reads as a broken viewer.
		expect(resolveShowSlideIndexes(deck(true, true, true))).toStrictEqual([0, 1, 2]);
	});

	it('follows a custom show membership and order', () => {
		const slides = deck(false, false, false, false);
		expect(resolveShowSlideIndexes(slides, { slideRIds: ['rId3', 'rId1'] })).toStrictEqual([2, 0]);
	});

	it('skips hidden slides inside a custom show', () => {
		const slides = deck(false, true, false);
		expect(resolveShowSlideIndexes(slides, { slideRIds: ['rId1', 'rId2', 'rId3'] })).toStrictEqual([
			0, 2,
		]);
	});

	it('keeps a custom show whose every member is hidden', () => {
		const slides = deck(false, true, true);
		expect(resolveShowSlideIndexes(slides, { slideRIds: ['rId2', 'rId3'] })).toStrictEqual([1, 2]);
	});

	it('ignores custom show entries naming slides that are gone', () => {
		const slides = deck(false, false);
		expect(resolveShowSlideIndexes(slides, { slideRIds: ['rId2', 'rId9'] })).toStrictEqual([1]);
	});

	it('accepts slideIds as the membership key', () => {
		const slides = deck(false, false, false);
		expect(resolveShowSlideIndexes(slides, { slideIds: ['slide-3', 'slide-2'] })).toStrictEqual([
			2, 1,
		]);
	});

	it('falls back to the deck when the custom show resolves to nothing', () => {
		const slides = deck(false, false);
		expect(resolveShowSlideIndexes(slides, { slideRIds: ['nope'] })).toStrictEqual([0, 1]);
	});
});

describe('nextShowSlideIndex', () => {
	const order = [0, 2, 3];

	it('skips a hidden slide', () => {
		expect(nextShowSlideIndex(0, order)).toBe(2);
	});

	it('returns undefined past the last show slide', () => {
		expect(nextShowSlideIndex(3, order)).toBeUndefined();
	});

	it('returns undefined when trailing slides are hidden', () => {
		// Deck of 4 with slides 3 and 4 hidden: advancing off slide 2 ends the show.
		const trailing = resolveShowSlideIndexes(deck(false, false, true, true));
		expect(trailing).toStrictEqual([0, 1]);
		expect(nextShowSlideIndex(1, trailing)).toBeUndefined();
	});

	it('wraps to the first show slide when looping', () => {
		expect(nextShowSlideIndex(3, order, { loop: true })).toBe(0);
	});

	it('steps forward out of a slide the show excludes', () => {
		// Landed on hidden slide 1 by typing "2" + Enter; forward escapes to 2.
		expect(nextShowSlideIndex(1, order)).toBe(2);
	});

	it('returns undefined from an excluded slide past the end', () => {
		expect(nextShowSlideIndex(9, order)).toBeUndefined();
	});

	it('returns undefined for an empty show', () => {
		expect(nextShowSlideIndex(0, [])).toBeUndefined();
		expect(nextShowSlideIndex(0, [], { loop: true })).toBeUndefined();
	});
});

describe('previousShowSlideIndex', () => {
	const order = [0, 2, 3];

	it('skips a hidden slide going back', () => {
		expect(previousShowSlideIndex(3, order)).toBe(2);
		expect(previousShowSlideIndex(2, order)).toBe(0);
	});

	it('never wraps at the start of the show', () => {
		expect(previousShowSlideIndex(0, order)).toBeUndefined();
	});

	it('steps back out of a slide the show excludes', () => {
		expect(previousShowSlideIndex(1, order)).toBe(0);
	});

	it('returns undefined for an empty show', () => {
		expect(previousShowSlideIndex(2, [])).toBeUndefined();
	});
});

describe('hasShowSlideAfter', () => {
	it('is false on the last visible slide of a deck with trailing hidden slides', () => {
		const order = resolveShowSlideIndexes(deck(false, false, true));
		expect(hasShowSlideAfter(1, order)).toBeFalsy();
	});

	it('is true before a later visible slide', () => {
		const order = resolveShowSlideIndexes(deck(false, true, false));
		expect(hasShowSlideAfter(0, order)).toBeTruthy();
	});

	it('ignores looping', () => {
		expect(hasShowSlideAfter(3, [0, 2, 3])).toBeFalsy();
	});
});

describe('first / last show slide', () => {
	it('honours a hidden first slide', () => {
		const order = resolveShowSlideIndexes(deck(true, false, false));
		expect(firstShowSlideIndex(order)).toBe(1);
	});

	it('honours a hidden last slide', () => {
		const order = resolveShowSlideIndexes(deck(false, false, true));
		expect(lastShowSlideIndex(order)).toBe(1);
	});

	it('returns undefined for an empty show', () => {
		expect(firstShowSlideIndex([])).toBeUndefined();
		expect(lastShowSlideIndex([])).toBeUndefined();
	});
});

describe('nextPresentedSlide', () => {
	it('previews the slide the next advance really lands on', () => {
		const slides = deck(false, true, false);
		expect(nextPresentedSlide(slides, 0)?.id).toBe('slide-3');
	});

	it('previews nothing when only hidden slides remain', () => {
		const slides = deck(false, true, true);
		expect(nextPresentedSlide(slides, 0)).toBeUndefined();
	});

	it('previews nothing on the last slide', () => {
		expect(nextPresentedSlide(deck(false, false), 1)).toBeUndefined();
	});
});
