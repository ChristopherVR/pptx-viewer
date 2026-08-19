// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useFindReplace } from './useFindReplace';

function textEl(id: string, text: string): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text,
		textSegments: [{ text, style: {} }],
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, elements } as PptxSlide;
}

/** Look up a text element by id and narrow it, for asserting on `.text` / `.textSegments`. */
function findTextElement(
	slides: PptxSlide[],
	slideIndex: number,
	elementId: string,
): Extract<PptxElement, { type: 'text' }> {
	return slides[slideIndex].elements?.find((e) => e.id === elementId) as Extract<
		PptxElement,
		{ type: 'text' }
	>;
}

function makeSlides(): PptxSlide[] {
	return [
		slide('s1', [textEl('a', 'Hello world'), textEl('b', 'nothing here')]),
		slide('s2', [
			textEl('c', 'world peace'),
			{ type: 'image', id: 'img', x: 0, y: 0, width: 1, height: 1 } as PptxElement,
		]),
	];
}

describe('useFindReplace', () => {
	it('exposes a reactive match count over the live slides, at per-occurrence precision', () => {
		const slides = ref(makeSlides()),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });

		fr.query.value = 'world';
		expect(fr.matchCount.value).toBe(2);
	});

	it('counts every occurrence within a single element, not one match per element', () => {
		const slides = ref([slide('s1', [textEl('a', 'world world world')])]),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });

		fr.query.value = 'world';
		// Per-occurrence: 3 matches inside one element, not 1.
		expect(fr.matchCount.value).toBe(3);
	});

	it('next() cycles matches and moves the active slide', () => {
		const slides = ref(makeSlides()),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });
		fr.query.value = 'world';

		fr.next();
		expect(fr.currentMatch.value).toBe(1);
		expect(activeSlideIndex.value).toBe(1);
		fr.next();
		expect(fr.currentMatch.value).toBe(0);
		expect(activeSlideIndex.value).toBe(0);
	});

	it('prev() cycles backwards', () => {
		const slides = ref(makeSlides()),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });
		fr.query.value = 'world';

		fr.prev();
		expect(fr.currentMatch.value).toBe(1);
		expect(activeSlideIndex.value).toBe(1);
	});

	it('respects case sensitivity', () => {
		const slides = ref([slide('s1', [textEl('a', 'World'), textEl('b', 'world')])]),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });

		fr.matchCase.value = true;
		fr.query.value = 'world';
		expect(fr.matchCount.value).toBe(1);

		fr.matchCase.value = false;
		expect(fr.matchCount.value).toBe(2);
	});

	it('replaceAll rewrites text + segments and snapshots history', () => {
		const slides = ref(makeSlides()),
			activeSlideIndex = ref(0),
			pushHistory = vi.fn(),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory });

		fr.query.value = 'world';
		fr.replacement.value = 'earth';
		fr.replaceAll();

		expect(pushHistory).toHaveBeenCalledOnce();
		expect(findTextElement(slides.value, 0, 'a').text).toBe('Hello earth');
		expect(findTextElement(slides.value, 0, 'a').textSegments?.[0].text).toBe('Hello earth');
		expect(findTextElement(slides.value, 1, 'c').text).toBe('earth peace');
		// Query no longer matches after replacement.
		expect(fr.matchCount.value).toBe(0);
	});

	it('replaceAll replaces every occurrence within a single element, not just the first', () => {
		const slides = ref([slide('s1', [textEl('a', 'world world world')])]),
			activeSlideIndex = ref(0),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });

		fr.query.value = 'world';
		fr.replacement.value = 'earth';
		fr.replaceAll();

		expect(findTextElement(slides.value, 0, 'a').text).toBe('earth earth earth');
	});

	it('replaceCurrent only rewrites the focused occurrence', () => {
		const slides = ref(makeSlides()),
			activeSlideIndex = ref(0),
			pushHistory = vi.fn(),
			fr = useFindReplace({ slides, activeSlideIndex, pushHistory });

		fr.query.value = 'world';
		fr.replacement.value = 'earth';
		fr.replaceCurrent();

		expect(pushHistory).toHaveBeenCalledOnce();
		expect(findTextElement(slides.value, 0, 'a').text).toBe('Hello earth');
		// Second match untouched, so one match remains.
		expect(findTextElement(slides.value, 1, 'c').text).toBe('world peace');
		expect(fr.matchCount.value).toBe(1);
	});
});
