import { describe, expect, it } from 'vitest';

import { presentationEntrySlideIndex } from './presentation-entry-slide';

describe('presentationEntrySlideIndex', () => {
	it('opens on the active slide when the show includes it', () => {
		expect(presentationEntrySlideIndex(2, [1, 2, 3])).toBe(2);
		expect(presentationEntrySlideIndex(0, [0, 1, 2])).toBe(0);
	});

	it('opens on the first show slide after an active slide the show skips', () => {
		// `p:sldRg st="2" end="3"` with the editor parked on slide 1.
		expect(presentationEntrySlideIndex(0, [1, 2])).toBe(1);
		// A hidden slide in the middle of the deck.
		expect(presentationEntrySlideIndex(2, [0, 1, 3, 4])).toBe(3);
	});

	it('wraps to the start of the show from an active slide past its end', () => {
		expect(presentationEntrySlideIndex(5, [1, 2])).toBe(1);
	});

	it('honours a custom show order rather than deck order', () => {
		// "Reverse" custom show: the show starts at deck index 3.
		expect(presentationEntrySlideIndex(4, [3, 2, 1])).toBe(3);
		expect(presentationEntrySlideIndex(2, [3, 2, 1])).toBe(2);
	});

	it('leaves the active slide alone when the show is empty', () => {
		expect(presentationEntrySlideIndex(4, [])).toBe(4);
	});
});
