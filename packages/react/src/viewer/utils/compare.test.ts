import { describe, it, expect } from 'vitest';
import { comparePresentation } from './compare';
import type { PptxData, PptxSlide, PptxElement } from 'pptx-viewer-core';

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
	it('should return unchanged for identical single-slide presentations', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const slide = makeSlide([el]);
		const result = comparePresentation(
			makePresentation([slide]),
			makePresentation([slide]),
		);
		expect(result.unchangedCount).toBe(1);
		expect(result.changedCount).toBe(0);
		expect(result.addedCount).toBe(0);
		expect(result.removedCount).toBe(0);
		expect(result.diffs).toHaveLength(1);
		expect(result.diffs[0].status).toBe('unchanged');
	});

	it('should detect added slides', () => {
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

	it('should detect removed slides', () => {
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

	it('should detect element additions within a slide', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape' });
		const el2 = makeElement({ id: 'e2', type: 'text' });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1, el2])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.kind === 'added' && c.elementId === 'e2')).toBe(true);
	});

	it('should detect element removals within a slide', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape' });
		const el2 = makeElement({ id: 'e2', type: 'text' });
		const result = comparePresentation(
			makePresentation([makeSlide([el1, el2])]),
			makePresentation([makeSlide([el1])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.kind === 'removed' && c.elementId === 'e2')).toBe(true);
	});

	it('should detect element moved', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', x: 10, y: 20 });
		const el1Moved = makeElement({ id: 'e1', type: 'shape', x: 50, y: 60 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Moved])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.kind === 'moved')).toBe(true);
	});

	it('should not detect moved when position change is within threshold (2px)', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', x: 10, y: 20 });
		const el1Same = makeElement({ id: 'e1', type: 'shape', x: 11, y: 21 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Same])]),
		);
		expect(result.unchangedCount).toBe(1);
	});

	it('should detect element resized', () => {
		const el1 = makeElement({ id: 'e1', type: 'shape', width: 100, height: 100 });
		const el1Resized = makeElement({ id: 'e1', type: 'shape', width: 200, height: 150 });
		const result = comparePresentation(
			makePresentation([makeSlide([el1])]),
			makePresentation([makeSlide([el1Resized])]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.kind === 'resized')).toBe(true);
	});

	it('should detect background color changes', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { backgroundColor: '#FFFFFF' })]),
			makePresentation([makeSlide([el], { backgroundColor: '#000000' })]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.elementId === '__background__')).toBe(true);
	});

	it('should detect speaker notes changes', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { notes: 'Old notes' })]),
			makePresentation([makeSlide([el], { notes: 'New notes' })]),
		);
		expect(result.changedCount).toBe(1);
		const changes = result.diffs[0].changes;
		expect(changes.some(c => c.elementId === '__notes__')).toBe(true);
	});

	it('should report correct slide counts', () => {
		const s1 = makeSlide([makeElement({ id: 'e1', type: 'shape' })]);
		const s2 = makeSlide([makeElement({ id: 'e2', type: 'shape' })]);
		const result = comparePresentation(
			makePresentation([s1, s2]),
			makePresentation([s1]),
		);
		expect(result.baseSlideCount).toBe(2);
		expect(result.compareSlideCount).toBe(1);
	});

	it('should handle empty presentations', () => {
		const result = comparePresentation(
			makePresentation([]),
			makePresentation([]),
		);
		expect(result.diffs).toHaveLength(0);
		expect(result.baseSlideCount).toBe(0);
		expect(result.compareSlideCount).toBe(0);
	});

	it('should treat null/undefined notes as equal', () => {
		const el = makeElement({ id: 'e1', type: 'shape' });
		const result = comparePresentation(
			makePresentation([makeSlide([el], { notes: undefined })]),
			makePresentation([makeSlide([el], { notes: undefined })]),
		);
		expect(result.unchangedCount).toBe(1);
	});
});
