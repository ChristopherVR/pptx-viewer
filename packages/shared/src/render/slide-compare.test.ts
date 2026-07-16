import type { PptxData, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	applyAcceptAllSlides,
	applyAcceptSlide,
	comparePresentation,
	compareSlide,
	compareSlides,
} from './slide-compare';

function makeElement(overrides: Partial<PptxElement> & { id: string; type: string }): PptxElement {
	return {
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

function makeSlide(elements: PptxElement[], overrides?: Partial<PptxSlide>): PptxSlide {
	return {
		elements,
		...overrides,
	} as PptxSlide;
}

function makePresentation(slides: PptxSlide[]): PptxData {
	return { slides } as PptxData;
}

describe('comparePresentation', () => {
	it('returns unchanged for identical single-slide presentations', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const slide = makeSlide([el]);
		const result = comparePresentation(makePresentation([slide]), makePresentation([slide]));
		expect(result.unchangedCount).toBe(1);
		expect(result.changedCount).toBe(0);
		expect(result.addedCount).toBe(0);
		expect(result.removedCount).toBe(0);
		expect(result.diffs).toHaveLength(1);
		expect(result.diffs[0].status).toBe('unchanged');
	});

	it('detects added slides', () => {
		const slide1 = makeSlide([makeElement({ id: 'e1', type: 'shape' })]);
		const slide2 = makeSlide([makeElement({ id: 'e2', type: 'shape' })]);
		const result = comparePresentation(
			makePresentation([slide1]),
			makePresentation([slide1, slide2]),
		);
		expect(result.addedCount).toBe(1);
		expect(result.diffs[1].status).toBe('added');
		expect(result.diffs[1].baseIndex).toBe(-1);
		expect(result.diffs[1].compareIndex).toBe(1);
	});

	it('detects removed slides', () => {
		const slide1 = makeSlide([makeElement({ id: 'e1', type: 'shape' })]);
		const slide2 = makeSlide([makeElement({ id: 'e2', type: 'shape' })]);
		const result = comparePresentation(
			makePresentation([slide1, slide2]),
			makePresentation([slide1]),
		);
		expect(result.removedCount).toBe(1);
		expect(result.diffs[1].status).toBe('removed');
		expect(result.diffs[1].compareIndex).toBe(-1);
	});

	it('detects element additions within a slide', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape' });
		const el2 = makeElement({ id: 'e2', type: 'text' });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1, el2])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.kind === 'added' && c.elementId === 'e2')).toBeTruthy();
	});

	it('detects element removals within a slide', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape' });
		const el2 = makeElement({ id: 'e2', type: 'text' });
		const result = comparePresentation(
			makePresentation([makeSlide([el1, el2])]),
			makePresentation([makeSlide([el1])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.kind === 'removed' && c.elementId === 'e2')).toBeTruthy();
	});

	it('detects element moved', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', x: 10, y: 20 });
		const el1Moved = makeElement({ id: 'e1', type: 'shape', x: 50, y: 60 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Moved])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.kind === 'moved')).toBeTruthy();
	});

	it('does not detect moved when position change is within threshold (2px)', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', x: 10, y: 20 });
		const el1Same = makeElement({ id: 'e1', type: 'shape', x: 11, y: 21 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Same])]),
		);
		expect(result.unchangedCount).toBe(1);
	});

	it('detects element resized', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', width: 100, height: 100 });
		const el1Resized = makeElement({ id: 'e1', type: 'shape', width: 200, height: 150 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Resized])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.kind === 'resized')).toBeTruthy();
	});

	it('detects background color changes', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { backgroundColor: '#FFFFFF' })]),
			makePresentation([makeSlide([el], { backgroundColor: '#000000' })]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.elementId === '__background__')).toBeTruthy();
	});

	it('detects speaker notes changes', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { notes: 'Old notes' })]),
			makePresentation([makeSlide([el], { notes: 'New notes' })]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some((c) => c.elementId === '__notes__')).toBeTruthy();
	});

	it('reports correct slide counts', () => {
		const s1 = makeSlide([makeElement({ id: 'e1', type: 'shape' })]);
		const s2 = makeSlide([makeElement({ id: 'e2', type: 'shape' })]);
		const result = comparePresentation(makePresentation([s1, s2]), makePresentation([s1]));
		expect(result.baseSlideCount).toBe(2);
		expect(result.compareSlideCount).toBe(1);
	});

	it('handles empty presentations', () => {
		const result = comparePresentation(makePresentation([]), makePresentation([]));
		expect(result.diffs).toHaveLength(0);
		expect(result.baseSlideCount).toBe(0);
		expect(result.compareSlideCount).toBe(0);
	});

	it('treats null/undefined notes as equal', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { notes: undefined })]),
			makePresentation([makeSlide([el], { notes: undefined })]),
		);
		expect(result.unchangedCount).toBe(1);
	});
});

describe('compareSlides / compareSlide (slide-array surface)', () => {
	it('compareSlides diffs two slide arrays directly', () => {
		const a = makeSlide([makeElement({ id: 'e1', type: 'shape' })]);
		const b = makeSlide([makeElement({ id: 'e1', type: 'shape', x: 80 })]);
		const result = compareSlides([a], [b]);
		expect(result.changedCount).toBe(1);
		expect(result.diffs[0].changes.some((c) => c.kind === 'moved')).toBeTruthy();
	});

	it('compareSlide returns element + background changes for a single pair', () => {
		const a = makeSlide([makeElement({ id: 'e1', type: 'shape' })], { backgroundColor: '#fff' });
		const b = makeSlide([makeElement({ id: 'e2', type: 'shape' })], { backgroundColor: '#000' });
		const changes = compareSlide(a, b);
		expect(changes.some((c) => c.kind === 'added' && c.elementId === 'e2')).toBeTruthy();
		expect(changes.some((c) => c.kind === 'removed' && c.elementId === 'e1')).toBeTruthy();
		expect(changes.some((c) => c.elementId === '__background__')).toBeTruthy();
	});
});

describe('accept comparison changes', () => {
	it('accepts a single changed slide immutably', () => {
		const base = makeSlide([], { id: 'base' });
		const compare = makeSlide([], { id: 'compare' });
		const slides = [base];
		const result = applyAcceptSlide(slides, {
			status: 'changed',
			baseIndex: 0,
			compareIndex: 0,
			compareSlide: compare,
			changes: [],
		});
		expect(result[0].id).toBe('compare');
		expect(result).not.toBe(slides);
	});

	it('accepts removals, changes, and additions in stable order', () => {
		const base = [makeSlide([], { id: 'remove' }), makeSlide([], { id: 'change' })];
		const changed = makeSlide([], { id: 'changed' });
		const added = makeSlide([], { id: 'added' });
		const result = applyAcceptAllSlides(base, {
			diffs: [
				{ status: 'removed', baseIndex: 0, compareIndex: -1, changes: [] },
				{
					status: 'changed',
					baseIndex: 1,
					compareIndex: 0,
					compareSlide: changed,
					changes: [],
				},
				{
					status: 'added',
					baseIndex: -1,
					compareIndex: 1,
					compareSlide: added,
					changes: [],
				},
			],
			baseSlideCount: 2,
			compareSlideCount: 2,
			addedCount: 1,
			removedCount: 1,
			changedCount: 1,
			unchangedCount: 0,
		});
		expect(result.map(({ id }) => id)).toStrictEqual(['changed', 'added']);
	});
});
