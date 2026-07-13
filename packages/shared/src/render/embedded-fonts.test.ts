import { describe, expect, it } from 'vitest';

import { buildEmbeddedFontStyles, buildUserFontFaceStyles } from './embedded-fonts';

describe('buildEmbeddedFontStyles', () => {
	it('creates rules for all embedded regular, bold, and italic variants', () => {
		const result = buildEmbeddedFontStyles(
			[
				{ name: 'Old Standard TT', dataUrl: 'data:font/ttf;base64,AAEAAA==', format: 'truetype' },
				{
					name: 'Old Standard TT',
					dataUrl: 'data:font/ttf;base64,AAEAAA==',
					format: 'truetype',
					bold: true,
				},
				{
					name: 'Old Standard TT',
					dataUrl: 'data:font/ttf;base64,AAEAAA==',
					format: 'truetype',
					italic: true,
				},
			],
			() => null,
		);

		expect(result.fontFaceCss.match(/@font-face/g)).toHaveLength(3);
		expect(result.fontFaceCss).toContain('font-weight: 700');
		expect(result.fontFaceCss).toContain('font-style: italic');
	});
});

describe('buildUserFontFaceStyles', () => {
	it('creates a rule for a host-provided WOFF2 URL', () => {
		const css = buildUserFontFaceStyles([
			{
				family: 'Customer Font',
				src: 'https://cdn.example.com/fonts/customer.woff2',
				format: 'woff2',
			},
		]);

		expect(css).toContain('font-family: "Customer Font"');
		expect(css).toContain('format("woff2")');
	});

	it('rejects unsafe font source values', () => {
		const css = buildUserFontFaceStyles([
			{ family: 'Safe', src: `java${'script'}:alert(1)` },
			{ family: 'Bad"; color:red', src: 'https://cdn.example.com/font.woff2' },
		]);

		expect(css).toBe('');
	});
});
