/**
 * issue #132 - a deck in an uninstalled font rendered as a serif.
 *
 * The reporter's deck is set almost entirely in `思源黑体 CN Light` (Source Han
 * Sans CN Light), which is not installed on a typical machine. PowerPoint
 * substitutes a sans; the viewer emitted `font-family: "思源黑体 CN Light"` with
 * NO fallback on the text body, so the browser fell back to its own default
 * standard family - which for CJK text is a serif. Every slide rendered in the
 * wrong typeface class.
 *
 * Runs already went through `getSubstituteFontFamily` in `segmentStyleToCss`;
 * the body did not, and the body is what unsegmented text inherits.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { buildTextBlockStyle } from './text-block-style';

function textElement(textStyle: Record<string, unknown>): PptxElement {
	return {
		id: 'ppt/slides/slide12.xml-shape-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 419,
		height: 148,
		text: '月初完成养老保险增减申报',
		textStyle,
	} as unknown as PptxElement;
}

describe('text body font fallback', () => {
	it('appends a fallback chain to an unmapped font', () => {
		const style = buildTextBlockStyle(textElement({ fontFamily: '思源黑体 CN Light' }));
		expect(String(style.fontFamily)).toContain('思源黑体 CN Light');
		expect(String(style.fontFamily)).toMatch(/sans-serif$/u);
	});

	it('uses the substitution map for a known Office font', () => {
		const style = buildTextBlockStyle(textElement({ fontFamily: 'Calibri' }));
		expect(String(style.fontFamily)).toContain('Carlito');
		expect(String(style.fontFamily)).toMatch(/sans-serif$/u);
	});

	it('picks the generic from the authored PANOSE', () => {
		// bFamilyType=2 (Latin Text), bSerifStyle=2 (Cove, a serif) -> serif.
		const serif = buildTextBlockStyle(
			textElement({ fontFamily: 'Some Unmapped Face', latinFontPanose: '02020603050405020304' }),
		);
		expect(String(serif.fontFamily)).toMatch(/serif$/u);
		expect(String(serif.fontFamily)).not.toMatch(/sans-serif$/u);

		// bSerifStyle=11 (Normal Sans) -> sans-serif, as the reporter's font is.
		const sans = buildTextBlockStyle(
			textElement({ fontFamily: 'Some Unmapped Face', latinFontPanose: '020B0300000000000000' }),
		);
		expect(String(sans.fontFamily)).toMatch(/sans-serif$/u);
	});

	it('still emits the default family when the body names no font', () => {
		const style = buildTextBlockStyle(textElement({}));
		expect(style.fontFamily).toBeTruthy();
	});
});
