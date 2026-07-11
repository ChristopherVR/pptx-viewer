import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { FindReplaceState } from './editor-find-replace.svelte';

/**
 * FindReplaceState is a runes class (`.svelte.ts`); this suite is named
 * `.svelte.test.ts` so the module is compiled with the runes runtime.
 */

function textEl(id: string, text: string): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		text,
		textSegments: [{ text, style: {} }],
		textStyle: {},
	} as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId-s', slideNumber: 1, elements };
}

describe('findReplaceState', () => {
	it('searches on toggle-open and reports match count', () => {
		let slides: PptxSlide[] = [slide([textEl('a', 'hello world'), textEl('b', 'hello again')])];
		const state = new FindReplaceState({
			getSlides: () => slides,
			commitSlides: (next) => {
				slides = next;
			},
		});
		state.query = 'hello';
		state.toggle();
		expect(state.open).toBeTruthy();
		expect(state.matchCount).toBe(2);
		expect(state.hasResults).toBeTruthy();
	});

	it('navigates next/prev with wraparound', () => {
		let slides: PptxSlide[] = [slide([textEl('a', 'aa aa aa')])];
		const onNavigate = vi.fn();
		const state = new FindReplaceState({
			getSlides: () => slides,
			commitSlides: (next) => {
				slides = next;
			},
			onNavigate,
		});
		state.query = 'aa';
		state.search();
		expect(state.results.length).toBeGreaterThan(1);
		state.next();
		expect(state.index).toBe(1);
		state.prev();
		state.prev();
		expect(state.index).toBe(state.results.length - 1);
	});

	it('replaceCurrent replaces one match and re-searches', () => {
		let slides: PptxSlide[] = [slide([textEl('a', 'hello world')])];
		const state = new FindReplaceState({
			getSlides: () => slides,
			commitSlides: (next) => {
				slides = next;
			},
		});
		state.query = 'hello';
		state.replacement = 'hi';
		state.search();
		state.replaceCurrent();
		expect((slides[0].elements[0] as PptxElement & { text: string }).text).toBe('hi world');
		expect(state.matchCount).toBe(0);
	});

	it('replaceAll replaces every match', () => {
		let slides: PptxSlide[] = [slide([textEl('a', 'cat cat cat')])];
		const state = new FindReplaceState({
			getSlides: () => slides,
			commitSlides: (next) => {
				slides = next;
			},
		});
		state.query = 'cat';
		state.replacement = 'dog';
		state.replaceAll();
		expect((slides[0].elements[0] as PptxElement & { text: string }).text).toBe('dog dog dog');
	});

	it('does nothing on replace when there are no results', () => {
		const commitSlides = vi.fn();
		const state = new FindReplaceState({ getSlides: () => [], commitSlides });
		state.replaceCurrent();
		expect(commitSlides).not.toHaveBeenCalled();
	});
});
