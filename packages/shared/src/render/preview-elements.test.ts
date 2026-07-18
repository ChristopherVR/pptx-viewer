import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildPreviewElements, DEFAULT_PREVIEW_ELEMENT_CAP } from './preview-elements';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(id: string): PptxElement {
	return { id, type: 'text', x: 0, y: 0, width: 10, height: 10 } as unknown as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
	return { id: 'slide-1', elements } as unknown as PptxSlide;
}

// ===========================================================================
// buildPreviewElements
// ===========================================================================

describe('buildPreviewElements', () => {
	it('puts template elements first, then slide-owned elements', () => {
		const slide = makeSlide([makeElement('s1'), makeElement('s2')]);
		const template = [makeElement('t1'), makeElement('t2')];
		const result = buildPreviewElements(slide, template);
		expect(result.map((e) => e.id)).toStrictEqual(['t1', 't2', 's1', 's2']);
	});

	it('handles a missing template list (defaults to none)', () => {
		const slide = makeSlide([makeElement('s1')]);
		expect(buildPreviewElements(slide).map((e) => e.id)).toStrictEqual(['s1']);
	});

	it('does not mutate the slide element array', () => {
		const owned = [makeElement('s1')];
		const slide = makeSlide(owned);
		buildPreviewElements(slide, [makeElement('t1')]);
		expect(slide.elements).toStrictEqual(owned);
		expect(slide.elements).toHaveLength(1);
	});

	it('caps the merged list at the default cap', () => {
		const owned = Array.from({ length: DEFAULT_PREVIEW_ELEMENT_CAP + 50 }, (_, i) =>
			makeElement(`s${i}`),
		);
		const result = buildPreviewElements(makeSlide(owned));
		expect(result).toHaveLength(DEFAULT_PREVIEW_ELEMENT_CAP);
		expect(result[0]?.id).toBe('s0');
	});

	it('counts template elements against the cap (template first)', () => {
		const template = Array.from({ length: 5 }, (_, i) => makeElement(`t${i}`));
		const owned = Array.from({ length: 10 }, (_, i) => makeElement(`s${i}`));
		const result = buildPreviewElements(makeSlide(owned), template, { cap: 6 });
		expect(result.map((e) => e.id)).toStrictEqual(['t0', 't1', 't2', 't3', 't4', 's0']);
	});

	it('respects a custom cap', () => {
		const owned = Array.from({ length: 20 }, (_, i) => makeElement(`s${i}`));
		expect(buildPreviewElements(makeSlide(owned), [], { cap: 3 })).toHaveLength(3);
	});

	it('treats cap <= 0 as unlimited', () => {
		const owned = Array.from({ length: 700 }, (_, i) => makeElement(`s${i}`));
		expect(buildPreviewElements(makeSlide(owned), [], { cap: 0 })).toHaveLength(700);
	});
});
