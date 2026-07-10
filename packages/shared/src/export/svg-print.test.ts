import { describe, expect, it } from 'vitest';

import {
	buildPrintDocument,
	escapeXml,
	isSafeSvgMarkup,
	sanitizeCssDeclaration,
	sanitizeOrientation,
} from './svg-print';

const SCRIPT_PAYLOAD = '<script>alert(1)</script>';
const ATTR_BREAKOUT_PAYLOAD = '"><img src=x onerror=alert(1)>';

describe('escapeXml', () => {
	it('escapes all five reserved XML characters', () => {
		expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
	});

	it('leaves ordinary text untouched', () => {
		expect(escapeXml('Quarterly Results 2026')).toBe('Quarterly Results 2026');
	});
});

describe('sanitizeCssDeclaration', () => {
	it('passes through a known-safe filter declaration', () => {
		expect(sanitizeCssDeclaration('filter: grayscale(1) contrast(2);')).toBe(
			'filter: grayscale(1) contrast(2);',
		);
	});

	it('drops a declaration that attempts to close the surrounding <style> tag', () => {
		expect(sanitizeCssDeclaration(`</style>${SCRIPT_PAYLOAD}`)).toBe('');
	});

	it('drops a declaration containing quotes or braces', () => {
		expect(sanitizeCssDeclaration('filter: url("javascript:alert(1)");')).toBe('');
		expect(sanitizeCssDeclaration('} body { background: red')).toBe('');
	});
});

describe('sanitizeOrientation', () => {
	it('passes through the two literal values', () => {
		expect(sanitizeOrientation('portrait')).toBe('portrait');
		expect(sanitizeOrientation('landscape')).toBe('landscape');
	});

	it('coerces any other runtime value to the landscape fallback', () => {
		const tampered = `landscape; } body { background: url(x) </style>${SCRIPT_PAYLOAD}` as
			| 'landscape'
			| 'portrait';
		expect(sanitizeOrientation(tampered)).toBe('landscape');
	});
});

describe('isSafeSvgMarkup', () => {
	it('accepts ordinary SVG markup', () => {
		expect(
			isSafeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><text>Hi</text></svg>'),
		).toBeTruthy();
	});

	it('rejects markup that closes the wrapping <section>', () => {
		expect(isSafeSvgMarkup(`</section>${SCRIPT_PAYLOAD}`)).toBeFalsy();
	});

	it('rejects markup containing a <script> tag', () => {
		expect(isSafeSvgMarkup(`<svg>${SCRIPT_PAYLOAD}</svg>`)).toBeFalsy();
	});
});

describe('buildPrintDocument', () => {
	it('escapes a <script> payload in the title so it never appears as a live tag', () => {
		const html = buildPrintDocument(['<svg></svg>'], 800, 600, { title: SCRIPT_PAYLOAD });

		expect(html).not.toContain(SCRIPT_PAYLOAD);
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('escapes an attribute-breakout payload in the title', () => {
		const html = buildPrintDocument(['<svg></svg>'], 800, 600, {
			title: ATTR_BREAKOUT_PAYLOAD,
		});

		expect(html).not.toContain('<img src=x onerror=alert(1)>');
		expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
	});

	it('strips a colorFilter payload that attempts to break out of the <style> tag', () => {
		const html = buildPrintDocument(['<svg></svg>'], 800, 600, {
			colorFilter: `</style>${SCRIPT_PAYLOAD}<style>`,
		});

		expect(html).not.toContain(SCRIPT_PAYLOAD);
	});

	it('coerces a tampered orientation value to a known-safe literal', () => {
		const tampered = `landscape</style>${SCRIPT_PAYLOAD}<style>` as 'landscape' | 'portrait';
		const html = buildPrintDocument(['<svg></svg>'], 800, 600, { orientation: tampered });

		expect(html).not.toContain(SCRIPT_PAYLOAD);
		expect(html).toContain('size: landscape;');
	});

	it('drops a per-slide SVG string that attempts to escape its <section> wrapper', () => {
		const html = buildPrintDocument([`</section>${SCRIPT_PAYLOAD}<section>`], 800, 600);

		expect(html).not.toContain(SCRIPT_PAYLOAD);
	});

	it('runs legitimate SVG markup through the DOMPurify sanitizer before embedding', () => {
		// In the node/vitest environment DOMPurify has no `sanitize` until
		// handed a window, so the print-document sanitizer fails closed (see
		// `sanitizeMarkupOrEmpty`) rather than passing the raw markup through
		// unsanitised. The browser-only path is covered by the Vue print
		// composable tests (real DOM via happy-dom).
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Q1 Results</text></svg>';
		const html = buildPrintDocument([svg], 800, 600);

		expect(html).toContain('<section class="print-slide-page" aria-label="Slide 1">');
		expect(html).not.toContain(svg);
	});
});
