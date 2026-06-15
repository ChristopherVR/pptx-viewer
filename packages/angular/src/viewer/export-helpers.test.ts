import { describe, expect, it } from 'vitest';

import { pdfOrientation, pdfPageSize, sanitizeFileName, slideFileName } from './export-helpers';

/* ------------------------------------------------------------------ */
/*  pdfOrientation                                                      */
/* ------------------------------------------------------------------ */

describe('pdfOrientation', () => {
	it('returns landscape when width > height', () => {
		expect(pdfOrientation(1280, 720)).toBe('landscape');
	});

	it('returns portrait when height > width', () => {
		expect(pdfOrientation(720, 1280)).toBe('portrait');
	});

	it('returns portrait when width === height (square)', () => {
		expect(pdfOrientation(1000, 1000)).toBe('portrait');
	});

	it('handles typical 16:9 slide (9144000 × 5143500 EMUs expressed as pixels)', () => {
		// 960px × 540px is a common CSS pixel representation
		expect(pdfOrientation(960, 540)).toBe('landscape');
	});

	it('handles 4:3 slide', () => {
		expect(pdfOrientation(800, 600)).toBe('landscape');
	});
});

/* ------------------------------------------------------------------ */
/*  pdfPageSize                                                         */
/* ------------------------------------------------------------------ */

describe('pdfPageSize', () => {
	const A4_LONG = 841.89;
	const A4_SHORT = 595.28;

	it('returns landscape A4 for landscape slides', () => {
		const size = pdfPageSize(1280, 720);
		expect(size.orientation).toBe('landscape');
		expect(size.width).toBeCloseTo(A4_LONG, 1);
		expect(size.height).toBeCloseTo(A4_SHORT, 1);
	});

	it('returns portrait A4 for portrait slides', () => {
		const size = pdfPageSize(720, 1280);
		expect(size.orientation).toBe('portrait');
		expect(size.width).toBeCloseTo(A4_SHORT, 1);
		expect(size.height).toBeCloseTo(A4_LONG, 1);
	});

	it('returns portrait A4 for square slides', () => {
		const size = pdfPageSize(500, 500);
		expect(size.orientation).toBe('portrait');
		expect(size.width).toBeCloseTo(A4_SHORT, 1);
		expect(size.height).toBeCloseTo(A4_LONG, 1);
	});

	it('landscape width is always greater than landscape height', () => {
		const size = pdfPageSize(1920, 1080);
		expect(size.width).toBeGreaterThan(size.height);
	});

	it('portrait height is always greater than portrait width', () => {
		const size = pdfPageSize(768, 1024);
		expect(size.height).toBeGreaterThan(size.width);
	});
});

/* ------------------------------------------------------------------ */
/*  slideFileName                                                       */
/* ------------------------------------------------------------------ */

describe('slideFileName', () => {
	it('composes base, 1-based index, and extension', () => {
		expect(slideFileName('deck', 3, 'png')).toBe('deck-3.png');
	});

	it('works for index 1', () => {
		expect(slideFileName('presentation', 1, 'pdf')).toBe('presentation-1.pdf');
	});

	it('works for large slide numbers', () => {
		expect(slideFileName('deck', 100, 'png')).toBe('deck-100.png');
	});

	it('preserves base name characters (sanitization is the caller responsibility)', () => {
		expect(slideFileName('my deck', 2, 'png')).toBe('my deck-2.png');
	});
});

/* ------------------------------------------------------------------ */
/*  sanitizeFileName                                                    */
/* ------------------------------------------------------------------ */

describe('sanitizeFileName', () => {
	it('replaces backslash with underscore', () => {
		expect(sanitizeFileName('path\\file')).toBe('path_file');
	});

	it('replaces forward slash with underscore', () => {
		expect(sanitizeFileName('path/file')).toBe('path_file');
	});

	it('replaces colon with underscore', () => {
		expect(sanitizeFileName('C:file')).toBe('C_file');
	});

	it('replaces asterisk with underscore', () => {
		expect(sanitizeFileName('file*name')).toBe('file_name');
	});

	it('replaces question mark with underscore', () => {
		expect(sanitizeFileName('file?name')).toBe('file_name');
	});

	it('replaces double-quote with underscore', () => {
		expect(sanitizeFileName('file"name')).toBe('file_name');
	});

	it('replaces < and > with underscores', () => {
		expect(sanitizeFileName('file<>name')).toBe('file__name');
	});

	it('replaces pipe with underscore', () => {
		expect(sanitizeFileName('file|name')).toBe('file_name');
	});

	it('replaces ASCII control characters (NUL) with underscore', () => {
		expect(sanitizeFileName('file\x00name')).toBe('file_name');
	});

	it('replaces ASCII control characters (unit sep) with underscore', () => {
		expect(sanitizeFileName('file\x1Fname')).toBe('file_name');
	});

	it('leaves safe characters untouched', () => {
		const safe = 'My Presentation - Final (v2).pptx';
		expect(sanitizeFileName(safe)).toBe(safe);
	});

	it('replaces multiple unsafe chars in one pass', () => {
		expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
	});

	it('returns empty string unchanged', () => {
		expect(sanitizeFileName('')).toBe('');
	});
});
