import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { usePresentationShowOrder } from './usePresentationShowOrder';

function deck(...hidden: boolean[]): PptxSlide[] {
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

describe('usePresentationShowOrder', () => {
	it('skips hidden slides forward and backward', () => {
		const order = usePresentationShowOrder({ slides: () => deck(false, true, false) });
		expect(order.indexes.value).toStrictEqual([0, 2]);
		expect(order.next(0)).toBe(2);
		expect(order.previous(2)).toBe(0);
	});

	it('stays put at both ends of the show', () => {
		const order = usePresentationShowOrder({ slides: () => deck(false, false) });
		expect(order.previous(0)).toBe(0);
		expect(order.hasNext(1)).toBeFalsy();
		expect(order.next(1)).toBe(1);
	});

	it('ends the show at the last visible slide when trailing slides are hidden', () => {
		const order = usePresentationShowOrder({ slides: () => deck(false, false, true, true) });
		expect(order.hasNext(1)).toBeFalsy();
	});

	it('lands Home / End on the first / last visible slide', () => {
		const order = usePresentationShowOrder({ slides: () => deck(true, false, false, true) });
		expect(order.first(0)).toBe(1);
		expect(order.last(3)).toBe(2);
	});

	it('escapes forward from a slide the show excludes', () => {
		// Reached by typing its number, which deliberately bypasses the show order.
		const order = usePresentationShowOrder({ slides: () => deck(false, true, false) });
		expect(order.next(1)).toBe(2);
		expect(order.previous(1)).toBe(0);
	});

	it('follows an active custom show membership and order', () => {
		const order = usePresentationShowOrder({
			slides: () => deck(false, false, false),
			activeCustomShow: () => ({ slideRIds: ['rId3', 'rId1'] }),
		});
		expect(order.indexes.value).toStrictEqual([2, 0]);
		expect(order.next(2)).toBe(0);
		expect(order.hasNext(0)).toBeFalsy();
	});

	it('restricts to an authored p:showPr/p:sldRg slide range', () => {
		const order = usePresentationShowOrder({
			slides: () => deck(false, false, false, false),
			authoredRange: () => ({ fromIndex: 1, toIndex: 2 }),
		});
		expect(order.indexes.value).toStrictEqual([1, 2]);
		expect(order.first(0)).toBe(1);
		expect(order.last(3)).toBe(2);
		expect(order.hasNext(2)).toBeFalsy();
	});

	it('still skips hidden slides within an authored range', () => {
		const order = usePresentationShowOrder({
			slides: () => deck(false, true, false, false),
			authoredRange: () => ({ fromIndex: 0, toIndex: 2 }),
		});
		expect(order.indexes.value).toStrictEqual([0, 2]);
	});

	it('reacts to the deck changing', () => {
		// A reactive source, as `props.slides` is in the component: hiding a slide
		// mid-show has to change what the next press resolves to.
		const slides = ref<PptxSlide[]>(deck(false, false));
		const order = usePresentationShowOrder({ slides: () => slides.value });
		expect(order.next(0)).toBe(1);
		slides.value = deck(false, true, false);
		expect(order.next(0)).toBe(2);
	});
});
