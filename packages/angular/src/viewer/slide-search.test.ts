/**
 * slide-search.test.ts: Unit tests for the pure search helpers.
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { collectElementText, collectSlideText, searchSlides } from './slide-search';

// ---------------------------------------------------------------------------
// Helpers to build minimal fixture objects without importing real parsers
// ---------------------------------------------------------------------------

function textEl(text: string): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text,
	} satisfies PptxElement;
}

function shapeEl(text: string, segments?: string[]): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text,
		textSegments: segments ? segments.map((t) => ({ text: t, style: {} })) : undefined,
	} satisfies PptxElement;
}

function tableEl(rows: string[][]): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		tableData: {
			rows: rows.map((cells) => ({
				cells: cells.map((text) => ({ text })),
			})),
		},
	} satisfies PptxElement;
}

function smartArtEl(texts: string[]): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa1',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		smartArtData: {
			nodes: texts.map((text, i) => ({ id: String(i), text })),
		},
	} satisfies PptxElement;
}

function groupEl(children: PptxElement[]): PptxElement {
	return {
		type: 'group',
		id: 'g1',
		x: 0,
		y: 0,
		width: 500,
		height: 300,
		children,
	} satisfies PptxElement;
}

function slide(elements: PptxElement[], notes?: string): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId1',
		slideNumber: 1,
		elements,
		notes,
	} satisfies PptxSlide;
}

// ---------------------------------------------------------------------------
// collectElementText
// ---------------------------------------------------------------------------

describe('collectElementText', () => {
	it('returns text from a text element', () => {
		const result = collectElementText(textEl('Hello world'));
		expect(result).toContain('Hello world');
	});

	it('returns text and segment text from a shape element', () => {
		const result = collectElementText(shapeEl('Main text', ['seg one', 'seg two']));
		expect(result).toContain('Main text');
		expect(result).toContain('seg one');
		expect(result).toContain('seg two');
	});

	it('collects all cell text from a table element', () => {
		const result = collectElementText(
			tableEl([
				['Alpha', 'Beta'],
				['Gamma', 'Delta'],
			]),
		);
		expect(result).toContain('Alpha');
		expect(result).toContain('Beta');
		expect(result).toContain('Gamma');
		expect(result).toContain('Delta');
	});

	it('collects text from smartArt nodes', () => {
		const result = collectElementText(smartArtEl(['CEO', 'VP Engineering', 'VP Marketing']));
		expect(result).toContain('CEO');
		expect(result).toContain('VP Engineering');
		expect(result).toContain('VP Marketing');
	});

	it('recurses into group children', () => {
		const group = groupEl([textEl('outer text'), shapeEl('inner shape', ['inner seg'])]);
		const result = collectElementText(group);
		expect(result).toContain('outer text');
		expect(result).toContain('inner shape');
		expect(result).toContain('inner seg');
	});

	it('recurses into nested groups', () => {
		const inner = groupEl([textEl('deep text')]);
		const outer = groupEl([inner]);
		const result = collectElementText(outer);
		expect(result).toContain('deep text');
	});

	it('returns empty string for element types with no text (e.g. image)', () => {
		const imageEl: PptxElement = {
			type: 'image',
			id: 'img1',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		expect(collectElementText(imageEl)).toBe('');
	});

	it('handles missing tableData gracefully', () => {
		const el: PptxElement = {
			type: 'table',
			id: 't1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		};
		expect(collectElementText(el)).toBe('');
	});

	it('handles missing smartArtData gracefully', () => {
		const el: PptxElement = {
			type: 'smartArt',
			id: 'sa1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		};
		expect(collectElementText(el)).toBe('');
	});
});

// ---------------------------------------------------------------------------
// collectSlideText
// ---------------------------------------------------------------------------

describe('collectSlideText', () => {
	it('includes element text and notes', () => {
		const s = slide([textEl('slide content')], 'speaker note');
		const result = collectSlideText(s);
		expect(result).toContain('slide content');
		expect(result).toContain('speaker note');
	});

	it('works when there are no notes', () => {
		const s = slide([textEl('only content')]);
		const result = collectSlideText(s);
		expect(result).toContain('only content');
	});

	it('returns empty string for a slide with no elements or notes', () => {
		const s = slide([]);
		expect(collectSlideText(s).trim()).toBe('');
	});
});

// ---------------------------------------------------------------------------
// searchSlides
// ---------------------------------------------------------------------------

describe('searchSlides', () => {
	const slides: PptxSlide[] = [
		slide([textEl('Introduction to Angular')], 'First slide notes'),
		slide([textEl('React vs Angular comparison')]),
		slide([
			tableEl([
				['Angular', 'Vue'],
				['React', 'Svelte'],
			]),
		]),
		slide([textEl('Conclusion and next steps')]),
	];

	it('returns empty array for empty query', () => {
		expect(searchSlides(slides, '')).toStrictEqual([]);
	});

	it('returns empty array for whitespace-only query', () => {
		expect(searchSlides(slides, '   ')).toStrictEqual([]);
	});

	it('finds matches case-insensitively', () => {
		const results = searchSlides(slides, 'angular');
		// Slides 0 (title), 1 (comparison), 2 (table cell) all contain "Angular"
		const indices = results.map((r) => r.slideIndex);
		expect(indices).toContain(0);
		expect(indices).toContain(1);
		expect(indices).toContain(2);
	});

	it('returns correct slideIndex values', () => {
		const results = searchSlides(slides, 'conclusion');
		expect(results).toHaveLength(1);
		expect(results[0].slideIndex).toBe(3);
	});

	it('counts multiple occurrences on the same slide', () => {
		// Slide 2 table: "Angular" appears once, and "Vue" once
		// Slide 1 text: "Angular" once; just check matchCount >= 1
		const results = searchSlides(slides, 'angular');
		for (const r of results) {
			expect(r.matchCount).toBeGreaterThanOrEqual(1);
		}
	});

	it('matchCount reflects actual occurrence count', () => {
		const multiSlides: PptxSlide[] = [slide([textEl('foo bar foo baz foo')])];
		const results = searchSlides(multiSlides, 'foo');
		expect(results).toHaveLength(1);
		expect(results[0].matchCount).toBe(3);
	});

	it('snippet contains the query term', () => {
		const results = searchSlides(slides, 'React');
		for (const r of results) {
			expect(r.snippet.toLowerCase()).toContain('react');
		}
	});

	it('returns empty array when no slides match', () => {
		expect(searchSlides(slides, 'zxqwerty123')).toStrictEqual([]);
	});

	it('searches notes text', () => {
		const results = searchSlides(slides, 'First slide notes');
		expect(results).toHaveLength(1);
		expect(results[0].slideIndex).toBe(0);
	});

	it('is case-insensitive for mixed case query', () => {
		const lower = searchSlides(slides, 'introduction');
		const upper = searchSlides(slides, 'INTRODUCTION');
		const mixed = searchSlides(slides, 'IntRoDuCtIoN');
		expect(lower.map((r) => r.slideIndex)).toStrictEqual(upper.map((r) => r.slideIndex));
		expect(lower.map((r) => r.slideIndex)).toStrictEqual(mixed.map((r) => r.slideIndex));
	});

	it('snippet is non-empty for a match', () => {
		const results = searchSlides(slides, 'Angular');
		for (const r of results) {
			expect(r.snippet.length).toBeGreaterThan(0);
		}
	});
});
