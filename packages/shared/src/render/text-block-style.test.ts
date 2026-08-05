import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTextBlockStyle } from './text-block-style';

/** A text element with the given text style (and optional segments). */
function textEl(
	textStyle: Record<string, unknown>,
	extra: Record<string, unknown> = {},
): PptxElement {
	return {
		id: 'e1',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		text: 'Hello',
		textStyle,
		...extra,
	} as unknown as PptxElement;
}

describe('buildTextBlockStyle', () => {
	it('returns only the fallback colour for an element with no text', () => {
		const el = { id: 'p', type: 'picture', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildTextBlockStyle(el, { fallbackColor: '#AABBCC' })).toStrictEqual({
			color: '#AABBCC',
		});
	});

	it('always declares a font size and family so nothing inherits the host page', () => {
		const style = buildTextBlockStyle(textEl({}));
		expect(style.fontSize).toBe(24);
		expect(style.fontFamily).toBe('"Segoe UI", "Helvetica Neue", Arial, sans-serif');
		expect(style.fontWeight).toBe(400);
		expect(style.fontStyle).toBe('normal');
		expect(style.textDecorationLine).toBe('none');
	});

	// Defect A: `a:normAutofit/@fontScale` was applied by React alone.
	it('applies the normAutofit font scale to the body font size', () => {
		const style = buildTextBlockStyle(
			textEl({ fontSize: 53.33, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 }),
		);
		expect(style.fontSize).toBe(37);
	});

	it('reduces the line height by lnSpcReduction', () => {
		const style = buildTextBlockStyle(
			textEl({
				autoFit: true,
				autoFitMode: 'normal',
				autoFitLineSpacingReduction: 0.2,
				lineSpacing: 1.5,
			}),
		);
		expect(style.lineHeight).toBeCloseTo(1.44, 10);
	});

	// Defect B: `a:bodyPr/@wrap="none"` was applied by React alone.
	it('never wraps a wrap="none" body, even with the flex body layout', () => {
		const style = buildTextBlockStyle(textEl({ textWrap: 'none' }), { bodyLayout: true });
		expect(style.whiteSpace).toBe('nowrap');
		expect(style.overflow).toBe('visible');
	});

	it('defaults a wrapping body to pre-wrap only under bodyLayout', () => {
		expect(buildTextBlockStyle(textEl({}), { bodyLayout: true }).whiteSpace).toBe('pre-wrap');
		expect(buildTextBlockStyle(textEl({})).whiteSpace).toBeUndefined();
	});

	it('maps the body anchor to justify-content under bodyLayout', () => {
		expect(
			buildTextBlockStyle(textEl({ vAlign: 'middle' }), { bodyLayout: true }).justifyContent,
		).toBe('center');
		expect(
			buildTextBlockStyle(textEl({ vAlign: 'bottom' }), { bodyLayout: true }).justifyContent,
		).toBe('flex-end');
		expect(buildTextBlockStyle(textEl({}), { bodyLayout: true }).justifyContent).toBe('flex-start');
		expect(buildTextBlockStyle(textEl({ vAlign: 'middle' })).justifyContent).toBeUndefined();
	});

	it('insets text by the body insets, nudged one px for italic runs', () => {
		const plain = buildTextBlockStyle(textEl({ bodyInsetTop: 10, bodyInsetBottom: 10 }));
		expect(plain.paddingTop).toBe(10);
		const italic = buildTextBlockStyle(
			textEl(
				{ bodyInsetTop: 10, bodyInsetBottom: 10 },
				{ textSegments: [{ text: 'a', style: { italic: true } }] },
			),
		);
		expect(italic.paddingTop).toBe(11);
		expect(italic.paddingBottom).toBe(11);
	});

	it('adds the element-level margins and indent, unless paragraphs carry their own', () => {
		const single = buildTextBlockStyle(
			textEl({ bodyInsetLeft: 5, paragraphMarginLeft: 20, paragraphIndent: -12 }),
		);
		expect(single.paddingLeft).toBe(25);
		expect(single.textIndent).toBe(-12);
		// Per-paragraph indents win; repeating the element pair double-counts it.
		const perParagraph = buildTextBlockStyle(
			textEl(
				{ bodyInsetLeft: 5, paragraphMarginLeft: 20, paragraphIndent: -12 },
				{
					paragraphIndents: [{ marginLeft: 20, indent: -12 }],
				},
			),
		);
		expect(perParagraph.paddingLeft).toBe(5);
		expect(perParagraph.textIndent).toBe(0);
	});

	it('paints hyperlinked text in the hyperlink colour and underlines it', () => {
		const style = buildTextBlockStyle(textEl({ hyperlink: 'https://example.com' }));
		expect(style.color).toBe('#0563C1');
		expect(style.textDecorationLine).toBe('underline');
	});

	it('resolves alignment, RTL direction and vertical writing modes', () => {
		expect(buildTextBlockStyle(textEl({ align: 'dist' })).textAlign).toBe('justify');
		const rtl = buildTextBlockStyle(textEl({ rtl: true }));
		expect(rtl.textAlign).toBe('right');
		expect(rtl.direction).toBe('rtl');
		expect(rtl.unicodeBidi).toBe('plaintext');
		const vertical = buildTextBlockStyle(textEl({ textDirection: 'wordArtVertRtl' }));
		expect(vertical.writingMode).toBe('vertical-rl');
		expect(vertical.textOrientation).toBe('mixed');
		expect(vertical.direction).toBe('rtl');
	});

	it('suffixes every length with px on request and leaves unitless values alone', () => {
		const style = buildTextBlockStyle(
			textEl({ fontSize: 18, bodyInsetTop: 4, paragraphIndent: -12 }),
			{ pxLengths: true },
		);
		expect(style.fontSize).toBe('18px');
		expect(style.paddingTop).toBe('4px');
		expect(style.textIndent).toBe('-12px');
		expect(style.lineHeight).toBe(1.2);
		expect(style.fontWeight).toBe(400);
	});
});
