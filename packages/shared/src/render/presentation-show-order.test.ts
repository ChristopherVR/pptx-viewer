import { describe, expect, it } from 'vitest';

import {
	firstShowSlideIndex,
	hasShowSlideAfter,
	lastShowSlideIndex,
	nextPresentedSlide,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveAuthoredCustomShowId,
	resolveAuthoredSlideRange,
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

describe('nextPresentedSlide with a running custom show', () => {
	it('previews the slide the show visits next, not the next deck slide', () => {
		const slides = deck(false, false, false);
		// "Reverse": 3, 2, 1. From slide 3 the next press lands on slide 2.
		expect(nextPresentedSlide(slides, 2, { slideRIds: ['rId3', 'rId2', 'rId1'] })?.id).toBe(
			'slide-2',
		);
	});

	it('previews nothing at the end of the show even when the deck continues', () => {
		const slides = deck(false, false, false);
		expect(nextPresentedSlide(slides, 2, { slideRIds: ['rId1', 'rId3'] })).toBeUndefined();
	});

	it('still walks the deck when no show is passed', () => {
		expect(nextPresentedSlide(deck(false, false, false), 0)?.id).toBe('slide-2');
	});
});

describe('resolveAuthoredCustomShowId', () => {
	const shows = [{ id: '0' }, { id: '1' }];

	it('returns the id a deck is authored to open into', () => {
		expect(
			resolveAuthoredCustomShowId(
				{ showSlidesMode: 'customShow', showSlidesCustomShowId: '1' },
				shows,
			),
		).toBe('1');
	});

	it('ignores the id when the mode is not customShow', () => {
		expect(
			resolveAuthoredCustomShowId({ showSlidesMode: 'all', showSlidesCustomShowId: '1' }, shows),
		).toBeUndefined();
	});

	it('falls back to the whole deck when the named show no longer exists', () => {
		expect(
			resolveAuthoredCustomShowId(
				{ showSlidesMode: 'customShow', showSlidesCustomShowId: '7' },
				shows,
			),
		).toBeUndefined();
	});

	it('tolerates a deck with no showPr at all', () => {
		expect(resolveAuthoredCustomShowId(undefined, shows)).toBeUndefined();
	});
});

describe('resolveAuthoredSlideRange', () => {
	it('resolves a 1-based range to 0-based inclusive indexes', () => {
		expect(
			resolveAuthoredSlideRange({ showSlidesMode: 'range', showSlidesFrom: 2, showSlidesTo: 5 }, 8),
		).toStrictEqual({ fromIndex: 1, toIndex: 4 });
	});

	it('clamps a range that overruns the deck', () => {
		expect(
			resolveAuthoredSlideRange(
				{ showSlidesMode: 'range', showSlidesFrom: 3, showSlidesTo: 99 },
				5,
			),
		).toStrictEqual({ fromIndex: 2, toIndex: 4 });
	});

	it('normalises a reversed range', () => {
		expect(
			resolveAuthoredSlideRange({ showSlidesMode: 'range', showSlidesFrom: 6, showSlidesTo: 2 }, 8),
		).toStrictEqual({ fromIndex: 1, toIndex: 5 });
	});

	it('ignores the range when the mode is not range', () => {
		expect(
			resolveAuthoredSlideRange({ showSlidesMode: 'all', showSlidesFrom: 2, showSlidesTo: 5 }, 8),
		).toBeUndefined();
	});

	it('returns undefined for missing or non-finite bounds', () => {
		expect(resolveAuthoredSlideRange({ showSlidesMode: 'range' }, 8)).toBeUndefined();
		expect(
			resolveAuthoredSlideRange(
				{ showSlidesMode: 'range', showSlidesFrom: Number.NaN, showSlidesTo: 5 },
				8,
			),
		).toBeUndefined();
	});

	it('tolerates an empty deck', () => {
		expect(
			resolveAuthoredSlideRange({ showSlidesMode: 'range', showSlidesFrom: 1, showSlidesTo: 2 }, 0),
		).toBeUndefined();
	});
});

describe('resolveShowSlideIndexes with an authored range', () => {
	it('restricts the show to the range', () => {
		const slides = deck(false, false, false, false, false, false);
		const range = resolveAuthoredSlideRange(
			{ showSlidesMode: 'range', showSlidesFrom: 2, showSlidesTo: 4 },
			slides.length,
		);
		expect(resolveShowSlideIndexes(slides, undefined, range)).toStrictEqual([1, 2, 3]);
	});

	it('still drops hidden slides inside the range', () => {
		const slides = deck(false, true, false, false, false, false);
		const range = resolveAuthoredSlideRange(
			{ showSlidesMode: 'range', showSlidesFrom: 1, showSlidesTo: 3 },
			slides.length,
		);
		expect(resolveShowSlideIndexes(slides, undefined, range)).toStrictEqual([0, 2]);
	});

	it('falls back to the unfiltered base when the range is empty after clamping', () => {
		const slides = deck(false, false, false);
		// Impossible via resolveAuthoredSlideRange's own clamping, but the
		// filtering step must still be defensive against a hand-built range.
		expect(
			resolveShowSlideIndexes(slides, undefined, { fromIndex: 10, toIndex: 20 }),
		).toStrictEqual([0, 1, 2]);
	});

	it('is unaffected when no range is passed (backward compatible)', () => {
		const slides = deck(false, false, false);
		expect(resolveShowSlideIndexes(slides)).toStrictEqual([0, 1, 2]);
	});
});
