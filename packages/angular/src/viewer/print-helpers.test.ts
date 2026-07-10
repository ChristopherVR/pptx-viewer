// @vitest-environment jsdom
//
// buildPrintDocument's body is sanitised through DOMPurify, which walks/
// rewrites the parsed DOM tree. happy-dom (this package's default test
// environment) has a tree-walking bug that drops/unwraps container elements
// during that rewrite; jsdom does not, and is what actually approximates the
// real browsers this code runs in (`window.open` print windows), so this
// file opts into jsdom specifically to get a faithful sanitisation result.
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
	A4_LANDSCAPE,
	A4_PORTRAIT,
	DEFAULT_PRINT_SETTINGS,
	HANDOUT_OPTIONS,
	buildHandoutsHtml,
	buildNotesHtml,
	buildOutlineHtml,
	buildPrintDocument,
	buildSlidesHtml,
	computeColorFilter,
	computeHandoutLayout,
	computePageCount,
	computeSlideIndices,
	effectiveOrientation,
	escapeHtml,
	estimatePageCount,
	generateNoteLineCount,
	getHandoutGrid,
	getPrintableArea,
	normalizeSlidesPerPage,
	safeDataImageSrc,
	slideTitle,
	validatePrintSettings,
} from './print-helpers';
import type { HandoutSlidesPerPage, PrintSettings } from './print-helpers';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

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

const PNG = 'data:image/png;base64,AAAA';

/* ------------------------------------------------------------------ */
/*  HANDOUT_OPTIONS (ported from React print-dialog-types.test.ts)     */
/* ------------------------------------------------------------------ */

describe('hANDOUT_OPTIONS', () => {
	it('is an array of 6 options', () => {
		expect(HANDOUT_OPTIONS).toHaveLength(6);
	});

	it('contains values 1, 2, 3, 4, 6, 9', () => {
		expect(HANDOUT_OPTIONS).toStrictEqual([1, 2, 3, 4, 6, 9]);
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

/* ------------------------------------------------------------------ */
/*  DEFAULT_PRINT_SETTINGS                                             */
/* ------------------------------------------------------------------ */

describe('dEFAULT_PRINT_SETTINGS', () => {
	it('defaults to landscape colour slides, all range', () => {
		expect(DEFAULT_PRINT_SETTINGS.printWhat).toBe('slides');
		expect(DEFAULT_PRINT_SETTINGS.orientation).toBe('landscape');
		expect(DEFAULT_PRINT_SETTINGS.colorMode).toBe('color');
		expect(DEFAULT_PRINT_SETTINGS.slideRange).toBe('all');
	});

	it('has a supported slides-per-page default', () => {
		expect(HANDOUT_OPTIONS).toContain(DEFAULT_PRINT_SETTINGS.slidesPerPage);
	});

	it('matches the PrintSettings shape', () => {
		expectTypeOf(DEFAULT_PRINT_SETTINGS).toMatchTypeOf<PrintSettings>();
	});
});

/* ------------------------------------------------------------------ */
/*  normalizeSlidesPerPage                                            */
/* ------------------------------------------------------------------ */

describe('normalizeSlidesPerPage', () => {
	it('passes through supported values', () => {
		for (const n of HANDOUT_OPTIONS) {
			expect(normalizeSlidesPerPage(n)).toBe(n);
		}
	});

	it('falls back to 6 for unsupported values', () => {
		expect(normalizeSlidesPerPage(5)).toBe(6);
		expect(normalizeSlidesPerPage(0)).toBe(6);
		expect(normalizeSlidesPerPage(undefined)).toBe(6);
		expect(normalizeSlidesPerPage(100)).toBe(6);
	});
});

/* ------------------------------------------------------------------ */
/*  effectiveOrientation                                              */
/* ------------------------------------------------------------------ */

describe('effectiveOrientation', () => {
	it('honours the chosen orientation for full-page slides', () => {
		expect(effectiveOrientation('slides', 'landscape')).toBe('landscape');
		expect(effectiveOrientation('slides', 'portrait')).toBe('portrait');
	});

	it('forces portrait for handouts, notes and outline', () => {
		expect(effectiveOrientation('handouts', 'landscape')).toBe('portrait');
		expect(effectiveOrientation('notes', 'landscape')).toBe('portrait');
		expect(effectiveOrientation('outline', 'landscape')).toBe('portrait');
	});
});

/* ------------------------------------------------------------------ */
/*  validatePrintSettings                                            */
/* ------------------------------------------------------------------ */

describe('validatePrintSettings', () => {
	it('fills missing fields from defaults', () => {
		const s = validatePrintSettings({}, 10);
		expect(s.printWhat).toBe('slides');
		expect(s.colorMode).toBe('color');
	});

	it('clamps custom range to slide bounds', () => {
		const s = validatePrintSettings(
			{ slideRange: 'custom', customRangeFrom: 0, customRangeTo: 100 },
			5,
		);
		expect(s.customRangeFrom).toBe(1);
		expect(s.customRangeTo).toBe(5);
	});

	it('swaps reversed custom ranges', () => {
		const s = validatePrintSettings(
			{ slideRange: 'custom', customRangeFrom: 8, customRangeTo: 3 },
			10,
		);
		expect(s.customRangeFrom).toBe(3);
		expect(s.customRangeTo).toBe(8);
	});

	it('normalises unsupported slides-per-page', () => {
		const s = validatePrintSettings({ slidesPerPage: 5 as HandoutSlidesPerPage }, 10);
		expect(s.slidesPerPage).toBe(6);
	});

	it('forces portrait for non-slide modes', () => {
		const s = validatePrintSettings({ printWhat: 'handouts', orientation: 'landscape' }, 10);
		expect(s.orientation).toBe('portrait');
	});

	it('keeps landscape for full-page slides', () => {
		const s = validatePrintSettings({ printWhat: 'slides', orientation: 'landscape' }, 10);
		expect(s.orientation).toBe('landscape');
	});
});

/* ------------------------------------------------------------------ */
/*  computeSlideIndices (ported)                                      */
/* ------------------------------------------------------------------ */

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
});

/* ------------------------------------------------------------------ */
/*  computeColorFilter (ported)                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  getHandoutGrid (ported)                                           */
/* ------------------------------------------------------------------ */

describe('getHandoutGrid', () => {
	it('returns 1x1 for 1 slide per page', () => {
		expect(getHandoutGrid(1)).toStrictEqual({ rows: 1, columns: 1 });
	});

	it('returns 2x1 for 2 slides per page', () => {
		expect(getHandoutGrid(2)).toStrictEqual({ rows: 2, columns: 1 });
	});

	it('returns 3x1 for 3 slides per page', () => {
		expect(getHandoutGrid(3)).toStrictEqual({ rows: 3, columns: 1 });
	});

	it('returns 2x2 for 4 slides per page', () => {
		expect(getHandoutGrid(4)).toStrictEqual({ rows: 2, columns: 2 });
	});

	it('returns 3x2 for 6 slides per page', () => {
		expect(getHandoutGrid(6)).toStrictEqual({ rows: 3, columns: 2 });
	});

	it('returns 3x3 for 9 slides per page', () => {
		expect(getHandoutGrid(9)).toStrictEqual({ rows: 3, columns: 3 });
	});

	it('returns fallback 3x2 for unsupported values', () => {
		expect(getHandoutGrid(5)).toStrictEqual({ rows: 3, columns: 2 });
		expect(getHandoutGrid(8)).toStrictEqual({ rows: 3, columns: 2 });
		expect(getHandoutGrid(0)).toStrictEqual({ rows: 3, columns: 2 });
	});
});

/* ------------------------------------------------------------------ */
/*  computePageCount / estimatePageCount (ported + extended)          */
/* ------------------------------------------------------------------ */

describe('computePageCount', () => {
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

describe('estimatePageCount', () => {
	it('one page per slide for slides and notes', () => {
		expect(estimatePageCount('slides', 7, 6)).toBe(7);
		expect(estimatePageCount('notes', 4, 6)).toBe(4);
	});

	it('single page for non-empty outline', () => {
		expect(estimatePageCount('outline', 12, 6)).toBe(1);
		expect(estimatePageCount('outline', 0, 6)).toBe(0);
	});

	it('paginates handouts', () => {
		expect(estimatePageCount('handouts', 7, 3)).toBe(3);
		expect(estimatePageCount('handouts', 12, 6)).toBe(2);
	});
});

/* ------------------------------------------------------------------ */
/*  getPrintableArea + page constants                                 */
/* ------------------------------------------------------------------ */

describe('page dimensions', () => {
	it('portrait A4 is 210x297mm', () => {
		expect(A4_PORTRAIT.width).toBe(210);
		expect(A4_PORTRAIT.height).toBe(297);
	});

	it('landscape A4 is 297x210mm', () => {
		expect(A4_LANDSCAPE.width).toBe(297);
		expect(A4_LANDSCAPE.height).toBe(210);
	});

	it('printable area subtracts margins', () => {
		const portrait = getPrintableArea('portrait');
		expect(portrait.width).toBe(210 - 24);
		expect(portrait.height).toBe(297 - 24);

		const landscape = getPrintableArea('landscape');
		expect(landscape.width).toBe(297 - 24);
		expect(landscape.height).toBe(210 - 24);
	});
});

describe('generateNoteLineCount', () => {
	it('returns 8', () => {
		expect(generateNoteLineCount()).toBe(8);
	});
});

/* ------------------------------------------------------------------ */
/*  computeHandoutLayout                                              */
/* ------------------------------------------------------------------ */

describe('computeHandoutLayout', () => {
	it('returns no pages for empty input', () => {
		expect(computeHandoutLayout([], 6)).toStrictEqual([]);
	});

	it('paginates and produces grid-sized cells per page', () => {
		const indices = [0, 1, 2, 3, 4, 5, 6];
		const pages = computeHandoutLayout(indices, 6);
		expect(pages).toHaveLength(2);
		// Each 6-up page has rows*cols = 6 cells.
		expect(pages[0].cells).toHaveLength(6);
		expect(pages[1].cells).toHaveLength(6);
	});

	it('remaps cell slideIndex to the actual source indices', () => {
		const pages = computeHandoutLayout([4, 9], 2);
		const filled = pages[0].cells.filter((c) => c.slideIndex >= 0).map((c) => c.slideIndex);
		expect(filled).toStrictEqual([4, 9]);
	});

	it('fills trailing cells with -1 when slides run out', () => {
		const pages = computeHandoutLayout([0], 4);
		expect(pages).toHaveLength(1);
		const empties = pages[0].cells.filter((c) => c.slideIndex < 0);
		expect(empties).toHaveLength(3);
	});

	it('flags note lines only for 3-per-page', () => {
		expect(computeHandoutLayout([0, 1, 2], 3)[0].hasNoteLines).toBeTruthy();
		expect(computeHandoutLayout([0, 1, 2], 6)[0].hasNoteLines).toBeFalsy();
	});

	it('produces positive cell dimensions within the printable area', () => {
		const pages = computeHandoutLayout([0, 1, 2, 3], 4);
		const area = getPrintableArea('portrait');
		for (const cell of pages[0].cells) {
			expect(cell.width).toBeGreaterThan(0);
			expect(cell.height).toBeGreaterThan(0);
			expect(cell.x + cell.width).toBeLessThanOrEqual(area.width + 0.001);
			expect(cell.y + cell.height).toBeLessThanOrEqual(area.height + 0.001);
		}
	});
});

/* ------------------------------------------------------------------ */
/*  escapeHtml                                                         */
/* ------------------------------------------------------------------ */

describe('escapeHtml', () => {
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

/* ------------------------------------------------------------------ */
/*  safeDataImageSrc                                                  */
/* ------------------------------------------------------------------ */

describe('safeDataImageSrc', () => {
	it('passes through escaped data:image URLs', () => {
		expect(safeDataImageSrc(PNG)).toBe(PNG);
	});

	it('collapses non-data sources to a transparent PNG sentinel', () => {
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		const out = safeDataImageSrc('javascript:alert(1)');
		expect(out.startsWith('data:image/png;base64,')).toBeTruthy();
		expect(out).not.toContain('javascript');
	});

	it('rejects http URLs', () => {
		const out = safeDataImageSrc('https://evil.test/x.png');
		expect(out.startsWith('data:image/png;base64,')).toBeTruthy();
	});
});

/* ------------------------------------------------------------------ */
/*  slideTitle                                                        */
/* ------------------------------------------------------------------ */

describe('slideTitle', () => {
	it('uses the first text element', () => {
		expect(slideTitle(makeSlideWithText('s1', 'Hello'), 0)).toBe('Hello');
	});

	it('falls back to "Slide N" (1-based) when no text', () => {
		const slide = { id: 's', rId: 'r', slideNumber: 1, elements: [] } as unknown as PptxSlide;
		expect(slideTitle(slide, 2)).toBe('Slide 3');
	});

	it('falls back for undefined slide', () => {
		expect(slideTitle(undefined, 0)).toBe('Slide 1');
	});
});

/* ------------------------------------------------------------------ */
/*  buildOutlineHtml (ported)                                         */
/* ------------------------------------------------------------------ */

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

	it('uses fallback title when no text element found', () => {
		const slide = { id: 's1', rId: 'rId-s1', slideNumber: 1, elements: [] } as unknown as PptxSlide;
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

/* ------------------------------------------------------------------ */
/*  buildSlidesHtml / buildNotesHtml / buildHandoutsHtml              */
/* ------------------------------------------------------------------ */

describe('buildSlidesHtml', () => {
	it('emits one section per image with a 1-based alt', () => {
		const html = buildSlidesHtml([PNG, PNG], [0, 4]);
		expect(html.split('<section').length - 1).toBe(2);
		expect(html).toContain('alt="Slide 1"');
		expect(html).toContain('alt="Slide 5"');
		expect(html).toContain(`src="${PNG}"`);
	});

	it('sanitises non-data image sources', () => {
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is stripped.
		const html = buildSlidesHtml(['javascript:alert(1)'], [0]);
		expect(html).not.toContain('javascript');
		expect(html).toContain('data:image/png;base64,');
	});
});

describe('buildNotesHtml', () => {
	it('renders slide image plus escaped notes', () => {
		const slides = [makeSlideWithText('s1', 'T', 'My <notes> & stuff')];
		const html = buildNotesHtml([PNG], [0], slides);
		expect(html).toContain('notes-slide');
		expect(html).toContain('My &lt;notes&gt; &amp; stuff');
	});
});

describe('buildHandoutsHtml', () => {
	it('produces one page section for 6-up with 6 slides', () => {
		const imgs = Array.from({ length: 6 }, () => PNG);
		const html = buildHandoutsHtml(imgs, [0, 1, 2, 3, 4, 5], 6);
		expect(html.split('<section').length - 1).toBe(1);
		expect(html).toContain('handout-grid');
		expect(html).toContain('repeat(2, minmax(0, 1fr))'); // columns for 6-up
	});

	it('paginates when slides exceed per-page', () => {
		const imgs = Array.from({ length: 7 }, () => PNG);
		const html = buildHandoutsHtml(imgs, [0, 1, 2, 3, 4, 5, 6], 6);
		expect(html.split('<section').length - 1).toBe(2);
	});

	it('uses the 3-per-page note-line layout', () => {
		const imgs = Array.from({ length: 3 }, () => PNG);
		const html = buildHandoutsHtml(imgs, [0, 1, 2], 3);
		expect(html).toContain('handout-grid-3');
		expect(html).toContain('handout-note-line');
	});
});

/* ------------------------------------------------------------------ */
/*  buildPrintDocument                                                */
/* ------------------------------------------------------------------ */

describe('buildPrintDocument', () => {
	it('wraps the body in a full HTML document', () => {
		const doc = buildPrintDocument({
			title: 'Slides',
			bodyHtml: '<p>hi</p>',
			orientation: 'landscape',
			colorFilter: '',
			frameSlides: false,
		});
		expect(doc.startsWith('<!doctype html>')).toBeTruthy();
		expect(doc).toContain('<title>Slides</title>');
		expect(doc).toContain('<body><p>hi</p></body>');
		expect(doc).toContain('@page { size: landscape;');
	});

	it('escapes the title', () => {
		const doc = buildPrintDocument({
			title: '<x> & "y"',
			bodyHtml: '',
			orientation: 'portrait',
			colorFilter: '',
			frameSlides: false,
		});
		expect(doc).toContain('<title>&lt;x&gt; &amp; &quot;y&quot;</title>');
	});

	it('injects the colour filter into the body style', () => {
		const doc = buildPrintDocument({
			title: 'T',
			bodyHtml: '',
			orientation: 'portrait',
			colorFilter: 'filter: grayscale(1);',
			frameSlides: false,
		});
		expect(doc).toContain('filter: grayscale(1);');
	});

	it('adds frame styling only when frameSlides is true', () => {
		const framed = buildPrintDocument({
			title: 'T',
			bodyHtml: '',
			orientation: 'portrait',
			colorFilter: '',
			frameSlides: true,
		});
		const unframed = buildPrintDocument({
			title: 'T',
			bodyHtml: '',
			orientation: 'portrait',
			colorFilter: '',
			frameSlides: false,
		});
		expect(framed).toContain('border: 2px solid #000');
		expect(unframed).not.toContain('border: 2px solid #000');
	});
});

/* ------------------------------------------------------------------ */
/*  ng-packagr lib-target guards                                      */
/* ------------------------------------------------------------------ */

describe('lib-target safety', () => {
	it('does not produce script-executable markup from untrusted input', () => {
		const slides = [makeSlideWithText('s1', '<img src=x onerror=alert(1)>')];
		const html = buildOutlineHtml([0], slides);
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
	});
});
