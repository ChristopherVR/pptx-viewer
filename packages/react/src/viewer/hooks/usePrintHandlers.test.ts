import type { PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import { escapeHtml } from '../utils/dom-helpers';
import type { PrintHandlersResult } from './usePrintHandlers';

// ---------------------------------------------------------------------------
// usePrintHandlers is a complex hook with DOM-heavy logic (window.open,
// html2canvas, etc.). We test the pure logic that can be extracted:
//   1. Slide index range computation from PrintSettings.
//   2. Color filter generation.
//   3. Outline HTML generation.
//   4. Handout layout grid computation.
//   5. escapeHtml (used in print output).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Slide index computation (extracted from handlePrintWithSettings)
// ---------------------------------------------------------------------------

type SlideRange = 'all' | 'current' | 'custom';

function computeSlideIndices(
	slideRange: SlideRange,
	activeSlideIndex: number,
	slideCount: number,
	customRangeFrom: number,
	customRangeTo: number,
): number[] {
	if (slideRange === 'current') {
		return [activeSlideIndex];
	}
	if (slideRange === 'custom') {
		const from = Math.max(0, customRangeFrom - 1);
		const to = Math.min(slideCount - 1, customRangeTo - 1);
		return Array.from({ length: to - from + 1 }, (_, i) => from + i);
	}
	return Array.from({ length: slideCount }, (_, i) => i);
}

describe('computeSlideIndices', () => {
	it('returns all indices for "all" range', () => {
		const result = computeSlideIndices('all', 2, 5, 1, 5);
		expect(result).toStrictEqual([0, 1, 2, 3, 4]);
	});

	it('returns only active index for "current" range', () => {
		const result = computeSlideIndices('current', 3, 10, 1, 10);
		expect(result).toStrictEqual([3]);
	});

	it('returns custom range (1-based input)', () => {
		const result = computeSlideIndices('custom', 0, 10, 3, 7);
		expect(result).toStrictEqual([2, 3, 4, 5, 6]);
	});

	it('clamps custom range to valid bounds', () => {
		const result = computeSlideIndices('custom', 0, 5, 0, 100);
		// from = max(0, 0-1) = 0 (clamped because -1 < 0), to = min(4, 99) = 4
		expect(result[0]).toBe(0);
		expect(result[result.length - 1]).toBe(4);
	});

	it('handles single-slide custom range', () => {
		const result = computeSlideIndices('custom', 0, 10, 5, 5);
		expect(result).toStrictEqual([4]);
	});

	it('returns empty for empty presentation with all range', () => {
		const result = computeSlideIndices('all', 0, 0, 1, 1);
		expect(result).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Color filter generation (extracted from handlePrintWithSettings)
// ---------------------------------------------------------------------------

type ColorMode = 'color' | 'grayscale' | 'blackAndWhite';

function computeColorFilter(colorMode: ColorMode): string {
	if (colorMode === 'grayscale') {
		return 'filter: grayscale(1);';
	}
	if (colorMode === 'blackAndWhite') {
		return 'filter: grayscale(1) contrast(2);';
	}
	return '';
}

describe('computeColorFilter', () => {
	it('returns empty string for "color" mode', () => {
		expect(computeColorFilter('color')).toBe('');
	});

	it('returns grayscale filter for "grayscale" mode', () => {
		expect(computeColorFilter('grayscale')).toBe('filter: grayscale(1);');
	});

	it('returns grayscale+contrast filter for "blackAndWhite" mode', () => {
		expect(computeColorFilter('blackAndWhite')).toBe('filter: grayscale(1) contrast(2);');
	});
});

// ---------------------------------------------------------------------------
// Outline HTML generation (extracted from handlePrintWithSettings)
// ---------------------------------------------------------------------------

function buildOutlineHtml(slideIndices: number[], slides: PptxSlide[]): string {
	return slideIndices
		.map((idx) => {
			const slide = slides[idx];
			if (!slide) {
				return '';
			}
			const title = slide.elements?.find((el) => 'text' in el && (el as { text?: unknown }).text);
			const titleText =
				title && 'text' in title ? String((title as { text?: unknown }).text) : `Slide ${idx + 1}`;
			const notes = slide.notes?.trim() || '';
			return `<h2>${escapeHtml(titleText)}</h2>${notes ? `<p>${escapeHtml(notes)}</p>` : ''}`;
		})
		.join('');
}

function makeSlideWithText(id: string, text: string, notes?: string): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements: [
			{
				id: 'el1',
				type: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				text,
			} as unknown as PptxSlide['elements'][number],
		],
		notes,
	} as PptxSlide;
}

describe('buildOutlineHtml', () => {
	it('builds HTML with slide titles', () => {
		const slides = [
			makeSlideWithText('s1', 'Introduction'),
			makeSlideWithText('s2', 'Main Content'),
		];
		const html = buildOutlineHtml([0, 1], slides);
		expect(html).toContain('<h2>Introduction</h2>');
		expect(html).toContain('<h2>Main Content</h2>');
	});

	it('includes notes when present', () => {
		const slides = [makeSlideWithText('s1', 'Title', 'Speaker notes here')];
		const html = buildOutlineHtml([0], slides);
		expect(html).toContain('<p>Speaker notes here</p>');
	});

	it('omits notes when empty', () => {
		const slides = [makeSlideWithText('s1', 'Title')];
		const html = buildOutlineHtml([0], slides);
		expect(html).not.toContain('<p>');
	});

	it('uses fallback title when no text element found', () => {
		const slide: PptxSlide = {
			id: 's1',
			rId: 'rId-s1',
			slideNumber: 1,
			elements: [],
		} as PptxSlide;
		const html = buildOutlineHtml([0], [slide]);
		expect(html).toContain('<h2>Slide 1</h2>');
	});

	it('escapes HTML entities in titles', () => {
		const slides = [makeSlideWithText('s1', 'Q&A <Session>')];
		const html = buildOutlineHtml([0], slides);
		expect(html).toContain('Q&amp;A &lt;Session&gt;');
		expect(html).not.toContain('<Session>');
	});

	it('returns empty string for out-of-bounds indices', () => {
		const slides = [makeSlideWithText('s1', 'Only slide')];
		const html = buildOutlineHtml([5], slides);
		expect(html).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Handout layout grid computation (extracted from handlePrintWithSettings)
// ---------------------------------------------------------------------------

function computeHandoutGrid(slidesPerPage: number): { rows: number; columns: number } {
	const layoutMap: Record<number, { rows: number; columns: number }> = {
		1: { rows: 1, columns: 1 },
		2: { rows: 2, columns: 1 },
		3: { rows: 3, columns: 1 },
		4: { rows: 2, columns: 2 },
		6: { rows: 3, columns: 2 },
		9: { rows: 3, columns: 3 },
	};
	return layoutMap[slidesPerPage] ?? { rows: 3, columns: 2 };
}

describe('computeHandoutGrid', () => {
	it('returns 1x1 for 1 slide per page', () => {
		expect(computeHandoutGrid(1)).toStrictEqual({ rows: 1, columns: 1 });
	});

	it('returns 2x1 for 2 slides per page', () => {
		expect(computeHandoutGrid(2)).toStrictEqual({ rows: 2, columns: 1 });
	});

	it('returns 3x1 for 3 slides per page', () => {
		expect(computeHandoutGrid(3)).toStrictEqual({ rows: 3, columns: 1 });
	});

	it('returns 2x2 for 4 slides per page', () => {
		expect(computeHandoutGrid(4)).toStrictEqual({ rows: 2, columns: 2 });
	});

	it('returns 3x2 for 6 slides per page', () => {
		expect(computeHandoutGrid(6)).toStrictEqual({ rows: 3, columns: 2 });
	});

	it('returns 3x3 for 9 slides per page', () => {
		expect(computeHandoutGrid(9)).toStrictEqual({ rows: 3, columns: 3 });
	});

	it('returns fallback 3x2 for unsupported values', () => {
		expect(computeHandoutGrid(5)).toStrictEqual({ rows: 3, columns: 2 });
		expect(computeHandoutGrid(8)).toStrictEqual({ rows: 3, columns: 2 });
		expect(computeHandoutGrid(0)).toStrictEqual({ rows: 3, columns: 2 });
	});
});

// ---------------------------------------------------------------------------
// escapeHtml (used in print HTML generation)
// ---------------------------------------------------------------------------

describe('escapeHtml in print context', () => {
	it('escapes ampersands', () => {
		expect(escapeHtml('A & B')).toBe('A &amp; B');
	});

	it('escapes angle brackets', () => {
		expect(escapeHtml("<script>alert('xss')</script>")).toBe(
			'&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;',
		);
	});

	it('escapes double quotes', () => {
		expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
	});

	it('escapes single quotes', () => {
		expect(escapeHtml("it's")).toBe('it&#39;s');
	});

	it('handles empty string', () => {
		expect(escapeHtml('')).toBe('');
	});

	it('does not double-escape', () => {
		expect(escapeHtml('&amp;')).toBe('&amp;amp;');
	});
});

// ---------------------------------------------------------------------------
// PrintHandlersResult type shape
// ---------------------------------------------------------------------------

describe('printHandlersResult type', () => {
	it('has all expected properties', () => {
		const result: PrintHandlersResult = {
			handlePrint: vi.fn<() => void>(),
			handlePrintWithSettings: vi.fn<() => void>(),
			handlePrintSvg: vi.fn<() => void>(),
			isPrintDialogOpen: false,
			setIsPrintDialogOpen: vi.fn<() => void>(),
		};
		expect(result.isPrintDialogOpen).toBeFalsy();
		expectTypeOf(result.handlePrint).toBeFunction();
		expectTypeOf(result.handlePrintWithSettings).toBeFunction();
		expectTypeOf(result.handlePrintSvg).toBeFunction();
		expectTypeOf(result.setIsPrintDialogOpen).toBeFunction();
	});
});

// ---------------------------------------------------------------------------
// Handout pagination logic
// ---------------------------------------------------------------------------

describe('handout pagination', () => {
	function computePageCount(slideCount: number, slidesPerPage: number): number {
		return Math.ceil(slideCount / slidesPerPage);
	}

	it('divides slides evenly', () => {
		expect(computePageCount(6, 3)).toBe(2);
		expect(computePageCount(9, 3)).toBe(3);
	});

	it('rounds up for partial pages', () => {
		expect(computePageCount(7, 3)).toBe(3);
		expect(computePageCount(5, 4)).toBe(2);
	});

	it('handles single slide', () => {
		expect(computePageCount(1, 6)).toBe(1);
	});

	it('handles zero slides', () => {
		expect(computePageCount(0, 6)).toBe(0);
	});
});
