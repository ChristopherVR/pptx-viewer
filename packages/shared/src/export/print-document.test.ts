import type { PptxHandoutMaster, PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildHandoutsHtml, buildPrintHtmlDocument } from './print-document';
import type { PrintHtmlDocumentOptions } from './print-document';

function makeChromeElement(
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

function baseOptions(overrides: Partial<PrintHtmlDocumentOptions> = {}): PrintHtmlDocumentOptions {
	return {
		title: 'Slides',
		bodyHtml: '<section class="page slide-page">hi</section>',
		orientation: 'landscape',
		colorFilter: '',
		frameSlides: false,
		...overrides,
	};
}

describe('buildPrintHtmlDocument', () => {
	// In the node/vitest environment DOMPurify has no `sanitize` until handed
	// a window, so `sanitizeMarkupOrEmpty` fails closed here (empty body)
	// rather than passing raw bodyHtml through unsanitised. The browser-only
	// path (real DOMPurify sanitisation via happy-dom) is covered by the Vue
	// print composable tests, which call this same shared function.
	it('wraps well-formed input into a full HTML document shell', () => {
		const doc = buildPrintHtmlDocument(baseOptions());
		expect(doc.startsWith('<!doctype html>')).toBeTruthy();
		expect(doc).toContain('@page { size: landscape;');
	});

	it('rejects an orientation value that is not the literal union, even though the type only allows it at compile time', () => {
		const doc = buildPrintHtmlDocument(
			baseOptions({
				orientation:
					'landscape; } </style><script>alert(1)</script><style>' as PrintHtmlDocumentOptions['orientation'],
			}),
		);
		expect(doc).not.toContain('<script>alert(1)</script>');
		expect(doc).toContain('@page { size: landscape; margin: 8mm; }');
	});

	it('drops bodyHtml containing a <script> tag instead of embedding it', () => {
		const doc = buildPrintHtmlDocument(
			baseOptions({ bodyHtml: '<section>hi</section><script>alert(1)</script>' }),
		);
		expect(doc).not.toContain('<script>');
		expect(doc).toContain('<body></body>');
	});

	it('drops bodyHtml containing an inline event-handler attribute', () => {
		const doc = buildPrintHtmlDocument(
			baseOptions({ bodyHtml: '<img src="x" onerror="alert(1)" />' }),
		);
		expect(doc).not.toContain('onerror');
		expect(doc).toContain('<body></body>');
	});

	it('drops bodyHtml containing a javascript: URI', () => {
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		const payload = '<a href="javascript:alert(1)">click</a>';
		const doc = buildPrintHtmlDocument(baseOptions({ bodyHtml: payload }));
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		expect(doc).not.toContain('javascript:');
		expect(doc).toContain('<body></body>');
	});

	it('drops bodyHtml containing an <iframe>', () => {
		const doc = buildPrintHtmlDocument(baseOptions({ bodyHtml: '<iframe src="//evil"></iframe>' }));
		expect(doc).not.toContain('<iframe');
		expect(doc).toContain('<body></body>');
	});

	it('passes ordinary markup produced by the build*Html helpers through the deny-list guard', () => {
		// Passes the deny-list guard (no unsafe substrings), so it reaches
		// DOMPurify rather than being dropped outright; the node/vitest
		// environment then fails closed to an empty body (see the note above).
		const bodyHtml =
			'<section class="page slide-page"><img class="slide-img" src="data:image/png;base64,AAAA" alt="Slide 1" /></section>';
		const doc = buildPrintHtmlDocument(baseOptions({ bodyHtml }));
		expect(doc).toContain('<body></body>');
	});

	it('escapes the title', () => {
		const doc = buildPrintHtmlDocument(baseOptions({ title: '<x> & "y"' }));
		expect(doc).toContain('<title>&lt;x&gt; &amp; &quot;y&quot;</title>');
	});
});

describe('buildHandoutsHtml', () => {
	const IMAGES = ['data:image/png;base64,AAAA', 'data:image/png;base64,BBBB'];
	const INDICES = [0, 1];

	it('renders byte-identical output when no handout master is passed (back-compat)', () => {
		const withoutArg = buildHandoutsHtml(IMAGES, INDICES, 4);
		const withUndefined = buildHandoutsHtml(IMAGES, INDICES, 4, undefined);
		expect(withUndefined).toBe(withoutArg);
		expect(withoutArg).toContain('class="handout-grid"');
		expect(withoutArg).not.toContain('handout-chrome-frame');
	});

	it('renders byte-identical output for the 3-per-page layout with no handout master', () => {
		const withoutArg = buildHandoutsHtml(IMAGES, INDICES, 3);
		const withUndefined = buildHandoutsHtml(IMAGES, INDICES, 3, undefined);
		expect(withUndefined).toBe(withoutArg);
		expect(withoutArg).toContain('class="handout-grid-3"');
	});

	it('paints the master background, header, footer, date, and page number', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'ppt/handoutMasters/handoutMaster1.xml',
			backgroundColor: '#DDEEFF',
			slidesPerPage: 4,
			headerFooter: { hasHeader: true, hasFooter: true, hasDateTime: true, hasSlideNumber: true },
			elements: [
				makeChromeElement('hdr', 'Quarterly Review'),
				makeChromeElement('ftr', 'Confidential - Acme Corp'),
				makeChromeElement('dt', '', 'datetime'),
				makeChromeElement('sldnum', '<#>', 'slidenum'),
			],
		};
		const html = buildHandoutsHtml(IMAGES, INDICES, 4, handoutMaster);
		expect(html).toContain('handout-chrome-frame');
		expect(html).toContain('background-color: #DDEEFF;');
		expect(html).toContain('Quarterly Review');
		expect(html).toContain('Confidential - Acme Corp');
		// Auto date field resolves to a formatted date, not the empty stored text.
		expect(html).toContain('handout-chrome-box--date');
		// Page number field always renders the actual 1-based page index.
		expect(html).toMatch(/handout-chrome-box--page-number"[^>]*>1</u);
	});

	it('omits a chrome box whose <p:hf> flag is explicitly false, even with a placeholder shape', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'ppt/handoutMasters/handoutMaster1.xml',
			slidesPerPage: 4,
			headerFooter: { hasFooter: false },
			elements: [makeChromeElement('ftr', 'Should not print')],
		};
		const html = buildHandoutsHtml(IMAGES, INDICES, 4, handoutMaster);
		expect(html).not.toContain('Should not print');
	});

	it('sizes slide cells from the master placeholder rects when it defines positioned sldImg placeholders', () => {
		const handoutMaster: PptxHandoutMaster = {
			path: 'ppt/handoutMasters/handoutMaster1.xml',
			slidesPerPage: 2,
			placeholders: [
				{ type: 'sldImg', idx: '1', x: 36, y: 96, width: 300, height: 225 },
				{ type: 'sldImg', idx: '2', x: 384, y: 96, width: 300, height: 225 },
			],
		};
		const html = buildHandoutsHtml(IMAGES, INDICES, 2, handoutMaster);
		expect(html).toContain('handout-grid--positioned');
		expect(html).toContain('handout-cell--positioned');
	});
});
