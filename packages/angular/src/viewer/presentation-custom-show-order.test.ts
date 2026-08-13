/**
 * presentation-custom-show-order.test.ts: the show-order helpers, the show
 * navigator and the presenter console's "next slide" preview must all resolve
 * a RUNNING CUSTOM SHOW through the shared rule.
 *
 * Angular used to pre-filter the slide array to the show's membership and then
 * ask `resolveShowSlideIndexes` about the filtered array, which is a Rule 2
 * violation with two visible consequences: a slide hidden with "Hide Slide"
 * still got presented inside a custom show, and the presenter console previewed
 * `index + 1` rather than the slide the next press actually lands on.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { ShowOrderCustomShow } from '../internal/shared';
import {
	firstVisibleIndex,
	hasVisibleSlideAfter,
	lastVisibleIndex,
	nextVisibleIndex,
	prevVisibleIndex,
} from './presentation-overlay-helpers';
import { PresentationShowNavigator } from './presentation-show-navigator';
import type { ShowNavigatorDeps } from './presentation-show-navigator';
import { nextSlideAfter } from './presenter-view-helpers';

function slide(n: number, hidden = false): PptxSlide {
	return {
		id: `ppt/slides/slide${n}.xml`,
		rId: `rId${n + 1}`,
		slideNumber: n,
		hidden,
		elements: [],
	} as PptxSlide;
}

/** Four slides; the show "Reverse" visits 4, 3, 2 in that order. */
const DECK: PptxSlide[] = [slide(1), slide(2), slide(3), slide(4)];
const REVERSE: ShowOrderCustomShow = { slideRIds: ['rId5', 'rId4', 'rId3'] };

describe('show-order helpers with an active custom show', () => {
	it('navigates the show order, not the deck order', () => {
		expect(nextVisibleIndex(3, DECK, REVERSE)).toBe(2);
		expect(nextVisibleIndex(2, DECK, REVERSE)).toBe(1);
		expect(prevVisibleIndex(1, DECK, REVERSE)).toBe(2);
		expect(firstVisibleIndex(DECK, REVERSE)).toBe(3);
		expect(lastVisibleIndex(DECK, REVERSE)).toBe(1);
		expect(hasVisibleSlideAfter(1, DECK, REVERSE)).toBeFalsy();
	});

	it('still skips a hidden slide inside the show', () => {
		const withHidden = [slide(1), slide(2), slide(3, true), slide(4)];
		expect(nextVisibleIndex(3, withHidden, REVERSE)).toBe(1);
	});

	it('presents the whole deck when no show is active', () => {
		expect(nextVisibleIndex(0, DECK)).toBe(1);
		expect(lastVisibleIndex(DECK)).toBe(3);
	});
});

describe('presentationShowNavigator with an active custom show', () => {
	function navigator(activeShow: ShowOrderCustomShow | null): {
		nav: PresentationShowNavigator;
		emitted: number[];
	} {
		const emitted: number[] = [];
		const playback = {
			advance: () => false,
			isSeededCompleted: () => false,
			setSlide: () => undefined,
		} as unknown as ShowNavigatorDeps['playback'];
		const annotations = {
			setActiveSlide: () => undefined,
		} as unknown as ShowNavigatorDeps['annotations'];
		const nav: PresentationShowNavigator = new PresentationShowNavigator({
			slides: () => DECK,
			activeCustomShow: () => activeShow,
			currentSlide: () => DECK[nav.currentIndex()],
			showWithAnimation: () => false,
			playback,
			annotations,
			emitIndex: (index) => emitted.push(index),
			requestClose: () => undefined,
		});
		return { nav, emitted };
	}

	it('steps through the show, and emits DECK indexes', () => {
		const { nav, emitted } = navigator(REVERSE);
		nav.currentIndex.set(3);
		nav.navigate('next');
		expect(nav.currentIndex()).toBe(2);
		nav.navigate('next');
		expect(nav.currentIndex()).toBe(1);
		expect(emitted).toStrictEqual([2, 1]);
	});

	it('ends the show after the custom show last slide', () => {
		const { nav } = navigator(REVERSE);
		nav.currentIndex.set(1);
		nav.navigate('next');
		expect(nav.endOfShow()).toBeTruthy();
	});

	it('runs the full deck when no show is active', () => {
		const { nav } = navigator(null);
		nav.currentIndex.set(0);
		nav.navigate('next');
		expect(nav.currentIndex()).toBe(1);
	});
});

describe('nextSlideAfter', () => {
	it('previews the next slide of the show, not of the deck', () => {
		expect(nextSlideAfter(DECK, 3, REVERSE)?.id).toBe('ppt/slides/slide3.xml');
		expect(nextSlideAfter(DECK, 3)?.id).toBeUndefined();
		expect(nextSlideAfter(DECK, 0)?.id).toBe('ppt/slides/slide2.xml');
	});
});
