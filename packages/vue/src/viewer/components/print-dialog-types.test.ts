import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildOutlineHtml,
	computeColorFilter,
	computePageCount,
	computeSlideCount,
	computeSlideIndices,
	effectiveOrientation,
	escapeHtml,
	getHandoutGrid,
	HANDOUT_OPTIONS,
	isHandoutSlidesPerPage,
	resolveSlidesPerPage,
	safeDataImageSrc,
} from './print-dialog-types';

// ---------------------------------------------------------------------------
// HANDOUT_OPTIONS (ported from React print-dialog-types.test.ts)
// ---------------------------------------------------------------------------

describe('hANDOUT_OPTIONS', () => {
	it('is an array of 6 options', () => {
		expect(HANDOUT_OPTIONS).toHaveLength(6);
	});

	it('contains values 1, 2, 3, 4, 6, 9', () => {
		expect([...HANDOUT_OPTIONS]).toStrictEqual([1, 2, 3, 4, 6, 9]);
	});

	it('contains only positive integers', () => {
		for (const opt of HANDOUT_OPTIONS) {
			expect(Number.isInteger(opt)).toBeTruthy();
			expect(opt).toBeGreaterThan(0);
		}
	});

	it('is sorted in ascending order', () => {
		for (let i = 1; i < HANDOUT_OPTIONS.length; i++) {
			expect(HANDOUT_OPTIONS[i]).toBeGreaterThan(HANDOUT_OPTIONS[i - 1]);
		}
	});
});

// ---------------------------------------------------------------------------
// isHandoutSlidesPerPage / resolveSlidesPerPage
// ---------------------------------------------------------------------------

describe('isHandoutSlidesPerPage', () => {
	it('accepts supported values', () => {
		for (const n of [1, 2, 3, 4, 6, 9]) {
			expect(isHandoutSlidesPerPage(n)).toBeTruthy();
		}
	});

	it('rejects unsupported values', () => {
		for (const n of [0, 5, 7, 8, 10, -1]) {
			expect(isHandoutSlidesPerPage(n)).toBeFalsy();
		}
	});
});

describe('resolveSlidesPerPage', () => {
	it('returns the value when supported', () => {
		expect(resolveSlidesPerPage(4)).toBe(4);
		expect(resolveSlidesPerPage(9)).toBe(9);
	});

	it('falls back to 6 when undefined', () => {
		expect(resolveSlidesPerPage(undefined)).toBe(6);
	});

	it('falls back to 6 when unsupported', () => {
		expect(resolveSlidesPerPage(5)).toBe(6);
		expect(resolveSlidesPerPage(0)).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// computeSlideIndices (ported from usePrintHandlers.test.ts)
// ---------------------------------------------------------------------------

describe('computeSlideIndices', () => {
	it('returns all indices for "all" range', () => {
		expect(computeSlideIndices('all', 2, 5, 1, 5)).toStrictEqual([0, 1, 2, 3, 4]);
	});

	it('returns only active index for "current" range', () => {
		expect(computeSlideIndices('current', 3, 10, 1, 10)).toStrictEqual([3]);
	});

	it('returns custom range (1-based input)', () => {
		expect(computeSlideIndices('custom', 0, 10, 3, 7)).toStrictEqual([2, 3, 4, 5, 6]);
	});

	it('clamps custom range to valid bounds', () => {
		const result = computeSlideIndices('custom', 0, 5, 0, 100);
		expect(result[0]).toBe(0);
		expect(result[result.length - 1]).toBe(4);
	});

	it('handles single-slide custom range', () => {
		expect(computeSlideIndices('custom', 0, 10, 5, 5)).toStrictEqual([4]);
	});

	it('returns empty for empty presentation with all range', () => {
		expect(computeSlideIndices('all', 0, 0, 1, 1)).toStrictEqual([]);
	});

	it('returns empty for an inverted custom range', () => {
		expect(computeSlideIndices('custom', 0, 10, 8, 3)).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// effectiveOrientation
// ---------------------------------------------------------------------------

describe('effectiveOrientation', () => {
	it('honours the chosen orientation for full-page slides', () => {
		expect(effectiveOrientation('slides', 'landscape')).toBe('landscape');
		expect(effectiveOrientation('slides', 'portrait')).toBe('portrait');
	});

	it('forces portrait for handouts / notes / outline', () => {
		expect(effectiveOrientation('handouts', 'landscape')).toBe('portrait');
		expect(effectiveOrientation('notes', 'landscape')).toBe('portrait');
		expect(effectiveOrientation('outline', 'landscape')).toBe('portrait');
	});
});

// ---------------------------------------------------------------------------
// computeSlideCount
// ---------------------------------------------------------------------------

describe('computeSlideCount', () => {
	it('returns the total for "all"', () => {
		expect(computeSlideCount('all', 12, 1, 12)).toBe(12);
	});

	it('returns 1 for "current"', () => {
		expect(computeSlideCount('current', 12, 1, 12)).toBe(1);
	});

	it('returns the clamped custom span', () => {
		expect(computeSlideCount('custom', 10, 3, 7)).toBe(5);
	});

	it('clamps an over-range custom span', () => {
		expect(computeSlideCount('custom', 5, 1, 100)).toBe(5);
	});

	it('handles an inverted custom range as a single slide', () => {
		expect(computeSlideCount('custom', 10, 8, 3)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// computePageCount
// ---------------------------------------------------------------------------

describe('computePageCount', () => {
	it('equals slide count for slides and notes', () => {
		expect(computePageCount('slides', 7, 6)).toBe(7);
		expect(computePageCount('notes', 7, 6)).toBe(7);
	});

	it('is 1 for outline', () => {
		expect(computePageCount('outline', 7, 6)).toBe(1);
	});

	it('divides slides per page for handouts (rounding up)', () => {
		expect(computePageCount('handouts', 6, 3)).toBe(2);
		expect(computePageCount('handouts', 7, 3)).toBe(3);
		expect(computePageCount('handouts', 9, 9)).toBe(1);
	});

	it('handles zero slides', () => {
		expect(computePageCount('handouts', 0, 6)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// getHandoutGrid
// ---------------------------------------------------------------------------

describe('getHandoutGrid', () => {
	it('maps each supported value to its grid', () => {
		expect(getHandoutGrid(1)).toStrictEqual({ rows: 1, columns: 1 });
		expect(getHandoutGrid(2)).toStrictEqual({ rows: 2, columns: 1 });
		expect(getHandoutGrid(3)).toStrictEqual({ rows: 3, columns: 1 });
		expect(getHandoutGrid(4)).toStrictEqual({ rows: 2, columns: 2 });
		expect(getHandoutGrid(6)).toStrictEqual({ rows: 3, columns: 2 });
		expect(getHandoutGrid(9)).toStrictEqual({ rows: 3, columns: 3 });
	});

	it('falls back to 3x2 for unsupported values', () => {
		expect(getHandoutGrid(5)).toStrictEqual({ rows: 3, columns: 2 });
		expect(getHandoutGrid(0)).toStrictEqual({ rows: 3, columns: 2 });
	});
});

// ---------------------------------------------------------------------------
// computeColorFilter
// ---------------------------------------------------------------------------

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
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
	it('escapes ampersands', () => {
		expect(escapeHtml('A & B')).toBe('A &amp; B');
	});

	it('escapes angle brackets', () => {
		expect(escapeHtml("<script>alert('xss')</script>")).toBe(
			'&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;',
		);
	});

	it('escapes quotes', () => {
		expect(escapeHtml('He said "hi"')).toBe('He said &quot;hi&quot;');
		expect(escapeHtml("it's")).toBe('it&#39;s');
	});

	it('handles empty string', () => {
		expect(escapeHtml('')).toBe('');
	});
});

// ---------------------------------------------------------------------------
// safeDataImageSrc
// ---------------------------------------------------------------------------

describe('safeDataImageSrc', () => {
	it('passes a data:image URL through (escaped)', () => {
		expect(safeDataImageSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
	});

	it('returns a transparent PNG sentinel for a non-image URL', () => {
		// oxlint-disable-next-line no-script-url
		const out = safeDataImageSrc('javascript:alert(1)');
		expect(out.startsWith('data:image/png;base64,')).toBeTruthy();
		expect(out).not.toContain('javascript');
	});

	it('returns the sentinel for a non-data URL', () => {
		expect(safeDataImageSrc('https://evil.test/x.png').startsWith('data:image/png')).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// buildOutlineHtml (ported from usePrintHandlers.test.ts)
// ---------------------------------------------------------------------------

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
		expect(buildOutlineHtml([0], slides)).toContain('<p>Speaker notes here</p>');
	});

	it('omits notes when empty', () => {
		const slides = [makeSlideWithText('s1', 'Title')];
		expect(buildOutlineHtml([0], slides)).not.toContain('<p>');
	});

	it('uses a fallback title when no text element is found', () => {
		const slide = {
			id: 's1',
			rId: 'rId-s1',
			slideNumber: 1,
			elements: [],
		} as unknown as PptxSlide;
		expect(buildOutlineHtml([0], [slide])).toContain('<h2>Slide 1</h2>');
	});

	it('escapes HTML entities in titles', () => {
		const slides = [makeSlideWithText('s1', 'Q&A <Session>')];
		const html = buildOutlineHtml([0], slides);
		expect(html).toContain('Q&amp;A &lt;Session&gt;');
		expect(html).not.toContain('<Session>');
	});

	it('returns empty string for out-of-bounds indices', () => {
		const slides = [makeSlideWithText('s1', 'Only slide')];
		expect(buildOutlineHtml([5], slides)).toBe('');
	});
});
