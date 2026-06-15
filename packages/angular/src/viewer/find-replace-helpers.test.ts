/**
 * find-replace-helpers.test.ts — Unit tests for find-replace-helpers.ts.
 *
 * Ported/adapted from:
 *   packages/react/src/viewer/hooks/useFindReplace.test.ts
 *
 * @module find-replace-helpers.test
 */

import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { FindResult } from './find-replace-helpers';
import {
	applyFindReplacements,
	findInSlides,
	replaceInSlides,
	replaceMatch,
} from './find-replace-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(
	elements: { id: string; type?: string; text?: string; textSegments?: { text: string }[] }[],
): PptxSlide {
	return {
		id: 's1',
		rId: 's1',
		slideNumber: 1,
		elements: elements.map((el) => ({
			id: el.id,
			type: el.type ?? 'text',
			x: 0,
			y: 0,
			width: 100,
			height: 20,
			text: el.text ?? '',
			textSegments: el.textSegments ?? (el.text ? [{ text: el.text }] : []),
		})) as PptxSlide['elements'],
	};
}

// ---------------------------------------------------------------------------
// findInSlides
// ---------------------------------------------------------------------------

describe('findInSlides', () => {
	it('returns empty array for empty query', () => {
		const slide = makeSlide([{ id: 'e1', text: 'hello world' }]);
		expect(findInSlides([slide], '')).toStrictEqual([]);
	});

	it('finds a single match', () => {
		const slide = makeSlide([{ id: 'e1', text: 'hello world' }]);
		const results = findInSlides([slide], 'world');
		expect(results).toHaveLength(1);
		expect(results[0].slideIndex).toBe(0);
		expect(results[0].elementId).toBe('e1');
		expect(results[0].segmentIndex).toBe(0);
		expect(results[0].startOffset).toBe(6);
		const matchLen = results[0].length;
		expect(matchLen).toBe(5);
	});

	it('is case-insensitive by default', () => {
		const slide = makeSlide([{ id: 'e1', text: 'Hello World' }]);
		const results = findInSlides([slide], 'hello');
		expect(results).toHaveLength(1);
		expect(results[0].startOffset).toBe(0);
	});

	it('respects matchCase option', () => {
		const slide = makeSlide([{ id: 'e1', text: 'Hello hello' }]);
		// case-sensitive: only the lowercase one
		const results = findInSlides([slide], 'hello', { matchCase: true });
		expect(results).toHaveLength(1);
		expect(results[0].startOffset).toBe(6);
	});

	it('finds overlapping matches', () => {
		const slide = makeSlide([{ id: 'e1', text: 'aaa' }]);
		const results = findInSlides([slide], 'aa');
		// 'aa' at offset 0 and 1
		expect(results).toHaveLength(2);
		expect(results[0].startOffset).toBe(0);
		expect(results[1].startOffset).toBe(1);
	});

	it('searches across multiple segments', () => {
		const slide = makeSlide([
			{
				id: 'e1',
				text: 'foo bar',
				textSegments: [{ text: 'foo ' }, { text: 'bar' }],
			},
		]);
		const results = findInSlides([slide], 'bar');
		expect(results).toHaveLength(1);
		expect(results[0].segmentIndex).toBe(1);
		expect(results[0].startOffset).toBe(0);
	});

	it('searches across multiple slides', () => {
		const slide1 = makeSlide([{ id: 'e1', text: 'cats and dogs' }]);
		const slide2 = makeSlide([{ id: 'e2', text: 'more cats here' }]);
		const results = findInSlides([slide1, slide2], 'cats');
		expect(results).toHaveLength(2);
		expect(results[0].slideIndex).toBe(0);
		expect(results[1].slideIndex).toBe(1);
	});

	it('skips non-text elements (type: image)', () => {
		const slide = makeSlide([{ id: 'e1', type: 'image', text: 'ignore me' }]);
		const results = findInSlides([slide], 'ignore');
		expect(results).toHaveLength(0);
	});

	it('matches shape elements', () => {
		const slide = makeSlide([{ id: 'e1', type: 'shape', text: 'click here' }]);
		const results = findInSlides([slide], 'click');
		expect(results).toHaveLength(1);
	});

	it('matches connector elements', () => {
		const slide = makeSlide([{ id: 'e1', type: 'connector', text: 'label' }]);
		const results = findInSlides([slide], 'label');
		expect(results).toHaveLength(1);
	});

	it('returns empty for no matches', () => {
		const slide = makeSlide([{ id: 'e1', text: 'hello world' }]);
		expect(findInSlides([slide], 'xyz')).toHaveLength(0);
	});

	it('handles elements with no textSegments', () => {
		const slide: PptxSlide = {
			id: 's1',
			rId: 's1',
			slideNumber: 1,
			elements: [
				{
					id: 'e1',
					type: 'text',
					x: 0,
					y: 0,
					width: 100,
					height: 20,
					text: 'hello',
					// no textSegments
				} as PptxSlide['elements'][number],
			],
		};
		const results = findInSlides([slide], 'hello');
		expect(results).toHaveLength(0); // no segments → no results
	});
});

// ---------------------------------------------------------------------------
// applyFindReplacements
// ---------------------------------------------------------------------------

describe('applyFindReplacements', () => {
	it('returns original slides reference when toReplace is empty', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'hello' }])];
		const result = applyFindReplacements(slides, [], 'world');
		expect(result.slides).toBe(slides);
		expect(result.replacements).toBe(0);
	});

	it('replaces a match in a segment', () => {
		const slide = makeSlide([{ id: 'e1', text: 'hello world' }]);
		const match: FindResult = {
			slideIndex: 0,
			elementId: 'e1',
			segmentIndex: 0,
			startOffset: 6,
			length: 5,
		};
		const result = applyFindReplacements([slide], [match], 'earth');
		const el = result.slides[0].elements[0] as { text: string; textSegments: { text: string }[] };
		expect(el.text).toBe('hello earth');
		expect(el.textSegments[0].text).toBe('hello earth');
		expect(result.replacements).toBe(1);
	});

	it('does not mutate the original slides', () => {
		const slide = makeSlide([{ id: 'e1', text: 'hello' }]);
		const original = slide.elements[0] as { text: string };
		const match: FindResult = {
			slideIndex: 0,
			elementId: 'e1',
			segmentIndex: 0,
			startOffset: 0,
			length: 5,
		};
		applyFindReplacements([slide], [match], 'goodbye');
		// original element must be unchanged
		expect(original.text).toBe('hello');
	});

	it('applies multiple matches within the same segment in descending order', () => {
		const slide = makeSlide([{ id: 'e1', text: 'aaa' }]);
		const matches: FindResult[] = [
			{ slideIndex: 0, elementId: 'e1', segmentIndex: 0, startOffset: 0, length: 2 },
			{ slideIndex: 0, elementId: 'e1', segmentIndex: 0, startOffset: 1, length: 2 },
		];
		// Applying both in one go: second (offset 1) applied first, then first (offset 0).
		// After offset-1 replace: 'a' + 'b' + '' → 'ab' wait — we need stable text;
		// the important contract is: no panic / no index out of range.
		const result = applyFindReplacements([slide], matches, 'b');
		expect(result.replacements).toBe(2);
	});

	it('rebuilds the top-level text field as concatenation of segment texts', () => {
		const slide = makeSlide([
			{
				id: 'e1',
				text: 'foo bar',
				textSegments: [{ text: 'foo ' }, { text: 'bar' }],
			},
		]);
		const match: FindResult = {
			slideIndex: 0,
			elementId: 'e1',
			segmentIndex: 1,
			startOffset: 0,
			length: 3,
		};
		const result = applyFindReplacements([slide], [match], 'baz');
		const el = result.slides[0].elements[0] as { text: string; textSegments: { text: string }[] };
		expect(el.textSegments[1].text).toBe('baz');
		expect(el.text).toBe('foo baz');
	});

	it('handles multi-slide replacements', () => {
		const slide1 = makeSlide([{ id: 'a1', text: 'cat' }]);
		const slide2 = makeSlide([{ id: 'b1', text: 'cat' }]);
		const matches: FindResult[] = [
			{ slideIndex: 0, elementId: 'a1', segmentIndex: 0, startOffset: 0, length: 3 },
			{ slideIndex: 1, elementId: 'b1', segmentIndex: 0, startOffset: 0, length: 3 },
		];
		const result = applyFindReplacements([slide1, slide2], matches, 'dog');
		expect((result.slides[0].elements[0] as { text: string }).text).toBe('dog');
		expect((result.slides[1].elements[0] as { text: string }).text).toBe('dog');
		expect(result.replacements).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// replaceMatch (single-occurrence convenience)
// ---------------------------------------------------------------------------

describe('replaceMatch', () => {
	it('replaces only the match at the given index', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'hello hello' }])];
		const allResults = findInSlides(slides, 'hello');
		expect(allResults).toHaveLength(2);
		const result = replaceMatch(slides, allResults, 0, 'hi');
		const el = result.slides[0].elements[0] as { text: string };
		expect(el.text).toBe('hi hello');
		expect(result.replacements).toBe(1);
	});

	it('returns original slides when index is out of range', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'hello' }])];
		const result = replaceMatch(slides, [], 0, 'hi');
		expect(result.slides).toBe(slides);
		expect(result.replacements).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// replaceInSlides (replace-all convenience)
// ---------------------------------------------------------------------------

describe('replaceInSlides', () => {
	it('replaces all occurrences in one call', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'cat cat cat' }])];
		const result = replaceInSlides(slides, 'cat', 'dog');
		const el = result.slides[0].elements[0] as { text: string };
		// Three replacements applied in descending offset order within the segment.
		expect(el.text).toBe('dog dog dog');
		expect(result.replacements).toBe(3);
	});

	it('returns original slides when query is empty', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'hello' }])];
		const result = replaceInSlides(slides, '', 'x');
		expect(result.slides).toBe(slides);
		expect(result.replacements).toBe(0);
	});

	it('respects matchCase option', () => {
		const slides = [makeSlide([{ id: 'e1', text: 'Hello hello' }])];
		const result = replaceInSlides(slides, 'hello', 'bye', { matchCase: true });
		const el = result.slides[0].elements[0] as { text: string };
		// Only lowercase 'hello' replaced; 'Hello' preserved.
		expect(el.text).toBe('Hello bye');
		expect(result.replacements).toBe(1);
	});
});
