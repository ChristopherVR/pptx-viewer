import type { PptxData } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	getSlide,
	addSlide,
	deleteSlides,
	reorderSlides,
	duplicateSlide,
	updateSlideProperties,
	setSlideTransition,
	setCanvasSize,
} from '../../tools/slide-tools.js';
import type { ToolContext } from '../../types.js';

function makeTestPresentation(slideCount = 3): PptxData {
	return {
		width: 960,
		height: 540,
		slides: Array.from({ length: slideCount }, (_, i) => ({
			id: `slide-${i}`,
			rId: `rId${i + 2}`,
			slideNumber: i + 1,
			elements: [
				{
					id: `el-${i}-0`,
					type: 'text' as const,
					x: 100,
					y: 100,
					width: 300,
					height: 60,
					text: `Slide ${i + 1} text`,
				},
			],
			notes: `Notes for slide ${i + 1}`,
			comments: [],
		})),
	} as unknown as PptxData;
}

function ctx(pptxData?: PptxData): ToolContext {
	return { pptxData: pptxData ?? makeTestPresentation() };
}

describe('getSlide', () => {
	it('returns slide info and elements', () => {
		const result = getSlide(ctx(), { slideIndex: 0 });
		expect(result.dirty).toBeFalsy();
		expect(result.result.slideNumber).toBe(1);
		expect(result.result.elements).toHaveLength(1);
		expect(result.result.notes).toBe('Notes for slide 1');
	});

	it('throws on out-of-range index', () => {
		expect(() => getSlide(ctx(), { slideIndex: 5 })).toThrow('out of range');
	});
});

describe('addSlide', () => {
	it('adds a slide at the end by default', () => {
		const result = addSlide(ctx(), {});
		expect(result.dirty).toBeTruthy();
		expect(result.result.newSlideIndex).toBe(3);
		expect(result.result.slideCount).toBe(4);
	});

	it('inserts after a specific index', () => {
		const result = addSlide(ctx(), { insertAfterIndex: 0 });
		expect(result.result.newSlideIndex).toBe(1);
		expect(result.pptxData.slides[1].elements).toHaveLength(0);
	});
});

describe('deleteSlides', () => {
	it('deletes specified slides', () => {
		const result = deleteSlides(ctx(), { slideIndexes: [1] });
		expect(result.dirty).toBeTruthy();
		expect(result.result.deletedCount).toBe(1);
		expect(result.result.slideCount).toBe(2);
	});

	it('throws when deleting all slides', () => {
		expect(() => deleteSlides(ctx(), { slideIndexes: [0, 1, 2] })).toThrow('Cannot delete all');
	});

	it('throws on invalid indexes', () => {
		expect(() => deleteSlides(ctx(), { slideIndexes: [99] })).toThrow('Invalid slide indexes');
	});
});

describe('reorderSlides', () => {
	it('reorders slides', () => {
		const c = ctx();
		const originalFirstId = c.pptxData.slides[0].id;
		const result = reorderSlides(c, { newOrder: [2, 0, 1] });
		expect(result.dirty).toBeTruthy();
		expect(result.pptxData.slides[1].id).toBe(originalFirstId);
	});

	it('throws on invalid newOrder length', () => {
		expect(() => reorderSlides(ctx(), { newOrder: [0, 1] })).toThrow('exactly 3 indexes');
	});
});

describe('duplicateSlide', () => {
	it('duplicates a slide after the original', () => {
		const result = duplicateSlide(ctx(), { slideIndex: 0 });
		expect(result.dirty).toBeTruthy();
		expect(result.result.newSlideIndex).toBe(1);
		expect(result.result.slideCount).toBe(4);
		expect(result.pptxData.slides[1].id).not.toBe(result.pptxData.slides[0].id);
	});

	it('inserts at explicit targetIndex', () => {
		const result = duplicateSlide(ctx(), { slideIndex: 0, targetIndex: 2 });
		expect(result.result.newSlideIndex).toBe(2);
		expect(result.result.slideCount).toBe(4);
	});
});

describe('updateSlideProperties', () => {
	it('updates background and notes', () => {
		const result = updateSlideProperties(ctx(), {
			slideIndex: 0,
			backgroundColor: '#ff0000',
			notes: 'Updated notes',
		});
		expect(result.dirty).toBeTruthy();
		expect(result.pptxData.slides[0].backgroundColor).toBe('#ff0000');
		expect(result.pptxData.slides[0].notes).toBe('Updated notes');
	});
});

describe('setSlideTransition', () => {
	it('sets a transition', () => {
		const result = setSlideTransition(ctx(), {
			slideIndex: 0,
			type: 'fade',
			durationMs: 500,
		});
		expect(result.dirty).toBeTruthy();
		expect(result.pptxData.slides[0].transition?.type).toBe('fade');
		expect(result.pptxData.slides[0].transition?.durationMs).toBe(500);
	});

	it('removes transition with type=none', () => {
		const c = ctx();
		setSlideTransition(c, { slideIndex: 0, type: 'fade' });
		const result = setSlideTransition(c, { slideIndex: 0, type: 'none' });
		expect(result.pptxData.slides[0].transition).toBeUndefined();
	});
});

describe('setCanvasSize', () => {
	it('updates canvas dimensions', () => {
		const result = setCanvasSize(ctx(), { width: 1920, height: 1080 });
		expect(result.dirty).toBeTruthy();
		expect(result.pptxData.width).toBe(1920);
		expect(result.pptxData.height).toBe(1080);
	});

	it('updates EMU dimensions when present', () => {
		const c = ctx();
		(c.pptxData as Record<string, unknown>).widthEmu = 960 * 12700;
		(c.pptxData as Record<string, unknown>).heightEmu = 540 * 12700;
		const result = setCanvasSize(c, { width: 1920, height: 1080 });
		expect((result.pptxData as Record<string, unknown>).widthEmu).toBe(1920 * 12700);
		expect((result.pptxData as Record<string, unknown>).heightEmu).toBe(1080 * 12700);
	});
});
