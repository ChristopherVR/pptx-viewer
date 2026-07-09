import { describe, it, expect } from 'vitest';

import { buildPrintHtmlDocument } from './print-document';
import type { PrintHtmlDocumentOptions } from './print-document';

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
	it('wraps well-formed input into a full HTML document unchanged', () => {
		const doc = buildPrintHtmlDocument(baseOptions());
		expect(doc.startsWith('<!doctype html>')).toBeTruthy();
		expect(doc).toContain('<body><section class="page slide-page">hi</section></body>');
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

	it('still embeds ordinary markup produced by the build*Html helpers', () => {
		const bodyHtml =
			'<section class="page slide-page"><img class="slide-img" src="data:image/png;base64,AAAA" alt="Slide 1" /></section>';
		const doc = buildPrintHtmlDocument(baseOptions({ bodyHtml }));
		expect(doc).toContain(bodyHtml);
	});

	it('escapes the title', () => {
		const doc = buildPrintHtmlDocument(baseOptions({ title: '<x> & "y"' }));
		expect(doc).toContain('<title>&lt;x&gt; &amp; &quot;y&quot;</title>');
	});
});
