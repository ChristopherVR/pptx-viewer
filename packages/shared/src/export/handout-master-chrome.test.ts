import type { PptxHandoutMaster, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { handoutMasterChrome } from './handout-master-chrome';

function makeElement(
	placeholderType: string,
	text: string,
	fieldType?: string,
): PptxSlide['elements'][number] {
	return {
		id: `${placeholderType}-el`,
		type: 'text',
		placeholderType,
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text,
		textSegments: fieldType ? [{ text, style: {}, fieldType }] : undefined,
	} as unknown as PptxSlide['elements'][number];
}

describe('handoutMasterChrome', () => {
	it('returns an empty descriptor when there is no handout master', () => {
		expect(handoutMasterChrome(undefined, { pageIndex: 0, pageCount: 1 })).toStrictEqual({});
	});

	it('returns an empty descriptor for a handout master with no background/hf/elements', () => {
		const handoutMaster: PptxHandoutMaster = { path: 'x.xml', slidesPerPage: 6 };
		expect(handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 })).toStrictEqual({});
	});

	it('resolves the background colour and image', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			backgroundColor: '#112233',
			backgroundImage: 'data:image/png;base64,AAAA',
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.background).toStrictEqual({
			color: '#112233',
			imageDataUrl: 'data:image/png;base64,AAAA',
		});
	});

	it('resolves header/footer text from the placeholder elements', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('hdr', 'Header text'), makeElement('ftr', 'Footer text')],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.header?.text).toBe('Header text');
		expect(chrome.footer?.text).toBe('Footer text');
	});

	it('omits a part when its <p:hf> flag is explicitly false', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			headerFooter: { hasHeader: false },
			elements: [makeElement('hdr', 'Header text')],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.header).toBeUndefined();
	});

	it('omits a part when the flag is enabled but no placeholder shape exists', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			headerFooter: { hasHeader: true },
			elements: [],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.header).toBeUndefined();
	});

	it('treats an unset <p:hf> flag as enabled (spec default)', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('ftr', 'Footer text')],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.footer?.text).toBe('Footer text');
	});

	it('renders a fixed date literally when the field is not an auto datetime', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('dt', '1/1/2026')],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.date?.text).toBe('1/1/2026');
	});

	it('renders the printed date for an auto (datetime field) date placeholder', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('dt', '', 'datetime')],
		};
		const printedAt = new Date(Date.UTC(2026, 0, 15));
		const chrome = handoutMasterChrome(handoutMaster, {
			pageIndex: 0,
			pageCount: 1,
			printedAt,
			locale: 'en-US',
		});
		expect(chrome.date?.text).toContain('2026');
	});

	it('renders the printed date for an empty date placeholder even without an explicit field type', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('dt', '')],
		};
		const printedAt = new Date(Date.UTC(2026, 0, 15));
		const chrome = handoutMasterChrome(handoutMaster, {
			pageIndex: 0,
			pageCount: 1,
			printedAt,
			locale: 'en-US',
		});
		expect(chrome.date?.text).toContain('2026');
	});

	it('renders the actual 1-based page index for the page-number placeholder, ignoring its stored text', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			elements: [makeElement('sldnum', '<#>', 'slidenum')],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 2, pageCount: 5 });
		expect(chrome.pageNumber?.text).toBe('3');
	});

	it('leaves slideRects undefined when the master defines no positioned sldImg placeholders', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			slidesPerPage: 6,
			placeholders: [{ type: 'hdr' }, { type: 'ftr' }],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.slideRects).toBeUndefined();
	});

	it('resolves slideRects from positioned sldImg placeholders, sorted by idx, as page fractions', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			slidesPerPage: 2,
			placeholders: [
				{ type: 'sldImg', idx: '2', x: 360, y: 96, width: 300, height: 225 },
				{ type: 'sldImg', idx: '1', x: 36, y: 96, width: 300, height: 225 },
			],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.slideRects).toHaveLength(2);
		// Sorted by idx: idx=1 (x=36) first, idx=2 (x=360) second.
		expect(chrome.slideRects?.[0].x).toBeCloseTo(36 / 720);
		expect(chrome.slideRects?.[1].x).toBeCloseTo(360 / 720);
	});

	it('ignores sldImg placeholders that inherit their frame (no explicit xfrm)', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'x.xml',
			slidesPerPage: 2,
			placeholders: [{ type: 'sldImg', idx: '1' }],
		};
		const chrome = handoutMasterChrome(handoutMaster, { pageIndex: 0, pageCount: 1 });
		expect(chrome.slideRects).toBeUndefined();
	});
});
