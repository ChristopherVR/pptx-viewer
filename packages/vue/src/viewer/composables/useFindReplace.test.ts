// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { findMatches, replaceInElement, useFindReplace } from './useFindReplace';

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

function segEl(id: string, segments: Array<{ text: string }>): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: segments.map((s) => s.text).join(''),
		textSegments: segments.map((s) => ({ text: s.text, style: {} })),
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, elements } as PptxSlide;
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

describe('findMatches', () => {
	it('finds text elements across slides containing the query', () => {
		const results = findMatches(makeSlides(), 'world', false);
		expect(results).toHaveLength(2);
		expect(results.map((r) => r.elementId)).toStrictEqual(['a', 'c']);
		expect(results.map((r) => r.slideIndex)).toStrictEqual([0, 1]);
	});

	it('respects case sensitivity', () => {
		const slides = [slide('s1', [textEl('a', 'World'), textEl('b', 'world')])];
		expect(findMatches(slides, 'world', true).map((r) => r.elementId)).toStrictEqual(['b']);
		expect(findMatches(slides, 'world', false).map((r) => r.elementId)).toStrictEqual(['a', 'b']);
	});

	it('returns nothing for an empty query', () => {
		expect(findMatches(makeSlides(), '', false)).toStrictEqual([]);
	});
});

describe('replaceInElement', () => {
	it('rewrites both text and every segment', () => {
		const el = segEl('a', [{ text: 'foo ' }, { text: 'bar foo' }]);
		const next = replaceInElement(
			el as Extract<PptxElement, { type: 'text' }>,
			'foo',
			'baz',
			false,
		);
		expect(next.text).toBe('baz bar baz');
		expect(next.textSegments?.map((s) => s.text)).toStrictEqual(['baz ', 'bar baz']);
	});

	it('treats the query as a literal string (escapes regex)', () => {
		const el = textEl('a', 'a.b a.b');
		const next = replaceInElement(el as Extract<PptxElement, { type: 'text' }>, 'a.b', 'X', false);
		expect(next.text).toBe('X X');
	});
});

describe('useFindReplace', () => {
	it('exposes a reactive match count over the live slides', () => {
		const slides = ref(makeSlides());
		const activeSlideIndex = ref(0);
		const fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });

		fr.query.value = 'world';
		expect(fr.matchCount.value).toBe(2);
	});

	it('next() cycles matches and moves the active slide', () => {
		const slides = ref(makeSlides());
		const activeSlideIndex = ref(0);
		const fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });
		fr.query.value = 'world';

		fr.next();
		expect(fr.currentMatch.value).toBe(1);
		expect(activeSlideIndex.value).toBe(1);
		fr.next();
		expect(fr.currentMatch.value).toBe(0);
		expect(activeSlideIndex.value).toBe(0);
	});

	it('prev() cycles backwards', () => {
		const slides = ref(makeSlides());
		const activeSlideIndex = ref(0);
		const fr = useFindReplace({ slides, activeSlideIndex, pushHistory: () => {} });
		fr.query.value = 'world';

		fr.prev();
		expect(fr.currentMatch.value).toBe(1);
		expect(activeSlideIndex.value).toBe(1);
	});

	it('replaceAll rewrites text + segments and snapshots history', () => {
		const slides = ref(makeSlides());
		const activeSlideIndex = ref(0);
		const pushHistory = vi.fn();
		const fr = useFindReplace({ slides, activeSlideIndex, pushHistory });

		fr.query.value = 'world';
		fr.replacement.value = 'earth';
		fr.replaceAll();

		expect(pushHistory).toHaveBeenCalledOnce();
		const a = slides.value[0].elements?.find((e) => e.id === 'a');
		const c = slides.value[1].elements?.find((e) => e.id === 'c');
		expect((a as Extract<PptxElement, { type: 'text' }>).text).toBe('Hello earth');
		expect((a as Extract<PptxElement, { type: 'text' }>).textSegments?.[0].text).toBe(
			'Hello earth',
		);
		expect((c as Extract<PptxElement, { type: 'text' }>).text).toBe('earth peace');
		// Query no longer matches after replacement.
		expect(fr.matchCount.value).toBe(0);
	});

	it('replaceCurrent only rewrites the focused match', () => {
		const slides = ref(makeSlides());
		const activeSlideIndex = ref(0);
		const pushHistory = vi.fn();
		const fr = useFindReplace({ slides, activeSlideIndex, pushHistory });

		fr.query.value = 'world';
		fr.replacement.value = 'earth';
		fr.replaceCurrent();

		expect(pushHistory).toHaveBeenCalledOnce();
		const a = slides.value[0].elements?.find((e) => e.id === 'a');
		const c = slides.value[1].elements?.find((e) => e.id === 'c');
		expect((a as Extract<PptxElement, { type: 'text' }>).text).toBe('Hello earth');
		// Second match untouched, so one match remains.
		expect((c as Extract<PptxElement, { type: 'text' }>).text).toBe('world peace');
		expect(fr.matchCount.value).toBe(1);
	});
});
