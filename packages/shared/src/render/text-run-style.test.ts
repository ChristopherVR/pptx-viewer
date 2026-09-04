import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyUnderlineVariant, nestedTextDecorationStyle } from './text-run-decoration';
import { hollowTextFillStyle } from './text-run-hollow';
import { segmentStyleToCss } from './text-run-style';

function seg(style: NonNullable<TextSegment['style']>): TextSegment {
	return { text: 'x', style };
}

describe('segmentStyleToCss run properties', () => {
	it('maps character spacing to letter-spacing px (hundredths of a point)', () => {
		// 100 (=1pt) -> 1 * 96/72 px. The PowerPoint metric compensation layers on
		// top of this, but it needs a canvas to measure with and there is none
		// here, so what is left is the authored spacing alone.
		expect(segmentStyleToCss(seg({ characterSpacing: 100 })).letterSpacing).toBe(`${96 / 72}px`);
		// A run with neither authored spacing nor a measurable font declares no
		// letter-spacing at all, rather than a no-op `0px`.
		expect(segmentStyleToCss(seg({ characterSpacing: 0 })).letterSpacing).toBeUndefined();
	});

	it('scales an authored run size by the body autofit font scale', () => {
		// A run's own `sz` overrides the (scaled) body font-size, so the scale has
		// to reach the run or a shrink-to-fit title paints at full size.
		expect(segmentStyleToCss(seg({ fontSize: 53.33 }), 0.7).fontSize).toBe(`${53.33 * 0.7}px`);
		// Composed with the super/subscript reduction, not replaced by it.
		expect(segmentStyleToCss(seg({ fontSize: 20, baseline: 30000 }), 0.5).fontSize).toBe(
			`${20 * 0.5 * 0.65}px`,
		);
		// Default scale of 1 leaves every existing caller unchanged.
		expect(segmentStyleToCss(seg({ fontSize: 20 })).fontSize).toBe('20px');
	});

	it('maps kerning to font-kerning', () => {
		expect(segmentStyleToCss(seg({ kerning: 0 })).fontKerning).toBe('none');
		// A run whose own size clears the threshold (18pt run, 12pt threshold).
		expect(segmentStyleToCss(seg({ kerning: 1200, fontSize: 18 })).fontKerning).toBe('normal');
	});

	it('treats @kern as a minimum-size THRESHOLD, not a boolean', () => {
		// TextStyle.fontSize is already CSS px (see the comment in
		// `segmentStyleToCss`), so a 12pt threshold (`kern="1200"`) is 16px.
		const PT_TO_PX = 96 / 72;
		// An 18pt run: at/above threshold -> kerning applies.
		expect(segmentStyleToCss(seg({ kerning: 1200, fontSize: 18 * PT_TO_PX })).fontKerning).toBe(
			'normal',
		);
		// The same threshold on a 10pt run: below threshold -> kerning does NOT
		// apply, even though `kerning` is a non-zero value (the old boolean
		// reading would have said 'normal' here).
		expect(segmentStyleToCss(seg({ kerning: 1200, fontSize: 10 * PT_TO_PX })).fontKerning).toBe(
			'none',
		);
		// Exactly at the threshold applies (>=).
		expect(segmentStyleToCss(seg({ kerning: 1200, fontSize: 12 * PT_TO_PX })).fontKerning).toBe(
			'normal',
		);
		// `0` always disables kerning outright, regardless of size.
		expect(segmentStyleToCss(seg({ kerning: 0, fontSize: 40 })).fontKerning).toBe('none');
	});

	it('maps super/subscript baseline to vertical-align and scales font size', () => {
		const sup = segmentStyleToCss(seg({ baseline: 30000, fontSize: 20 }));
		expect(sup.verticalAlign).toBe('super');
		expect(sup.fontSize).toBe(`${20 * 0.65}px`);
		const sub = segmentStyleToCss(seg({ baseline: -25000, fontSize: 20 }));
		expect(sub.verticalAlign).toBe('sub');
		expect(sub.fontSize).toBe(`${20 * 0.65}px`);
		// Zero baseline leaves size unscaled and no vertical-align.
		const none = segmentStyleToCss(seg({ baseline: 0, fontSize: 20 }));
		expect(none.verticalAlign).toBeUndefined();
		expect(none.fontSize).toBe('20px');
	});

	it('maps highlight, underline colour and text outline', () => {
		const css = segmentStyleToCss(
			seg({
				highlightColor: '#FFFF00',
				underlineColor: '#FF0000',
				textOutlineWidth: 2,
				textOutlineColor: '#0000FF',
			}),
		);
		expect(css.backgroundColor).toBe('#FFFF00');
		expect(css.textDecorationColor).toBe('#FF0000');
		expect(css.WebkitTextStroke).toBe('2px #0000FF');
		expect(css.paintOrder).toBe('stroke fill');
	});

	it('falls back to currentColor when an outline has width but no colour', () => {
		expect(segmentStyleToCss(seg({ textOutlineWidth: 1 })).WebkitTextStroke).toBe(
			'1px currentColor',
		);
	});

	it('maps a:rPr/@cap all/small to text-transform / font-variant-caps', () => {
		expect(segmentStyleToCss(seg({ textCaps: 'all' })).textTransform).toBe('uppercase');
		expect(segmentStyleToCss(seg({ textCaps: 'small' })).fontVariantCaps).toBe('small-caps');
		const none = segmentStyleToCss(seg({ textCaps: 'none' }));
		expect(none.textTransform).toBeUndefined();
		expect(none.fontVariantCaps).toBeUndefined();
	});

	it('substitutes the run own font-family through its own PANOSE classification', () => {
		// Regression: this used to call `getSubstituteFontFamily` with no PANOSE
		// argument at all, so a run overriding the body's own font substituted
		// WITHOUT its `a:latin/@panose` outside React. An unknown serif font with
		// no direct name match falls back to generic sans-serif without PANOSE,
		// and to the serif fallback chain with it - two different fonts entirely.
		const withoutPanose = segmentStyleToCss(seg({ fontFamily: 'CustomSerifFont' }));
		expect(withoutPanose.fontFamily).toBe('"CustomSerifFont", sans-serif');

		// PANOSE for a serif font (bFamilyType=2, bSerifStyle=2 / "Cove"), hex-encoded.
		const withPanose = segmentStyleToCss(
			seg({ fontFamily: 'CustomSerifFont', latinFontPanose: '02020502020202020204' }),
		);
		expect(withPanose.fontFamily).toBe('"CustomSerifFont", "Times New Roman", "Georgia", serif');
	});

	// D2-G2: theme `a:font/@script` per-script fonts, precomputed at parse time
	// into `scriptFallbackFont` (a whole-run approximation of the full
	// per-character `byScript` routing) but never consumed by any renderer.
	describe('scriptFallbackFont (D2-G2)', () => {
		it('falls back to scriptFallbackFont when the run authors no font of its own', () => {
			const result = segmentStyleToCss(seg({ scriptFallbackFont: 'PMingLiU' }));
			expect(result.fontFamily).toBe('"PMingLiU", sans-serif');
		});

		it('never overrides an explicitly authored fontFamily', () => {
			const result = segmentStyleToCss(
				seg({ fontFamily: 'Calibri', scriptFallbackFont: 'PMingLiU' }),
			);
			expect(result.fontFamily).not.toContain('PMingLiU');
		});

		it('leaves fontFamily undeclared (inherits the body font) when neither is authored', () => {
			expect(segmentStyleToCss(seg({ fontSize: 16 })).fontFamily).toBeUndefined();
		});
	});

	it('adds no keys beyond the always-declared weight and slant', () => {
		expect(segmentStyleToCss(seg({ fontSize: 16 }))).toStrictEqual({
			fontSize: '16px',
			fontWeight: 'normal',
			fontStyle: 'normal',
		});
	});

	it('declares regular weight and slant so the text block cannot leak its own', () => {
		// Regression: the text block carries a `font-weight` / `font-style` from the
		// element's resolved text style, so omitting these on a run let a bold
		// heading in the first paragraph turn every later paragraph of the same
		// shape bold. React has always declared both per run.
		const plain = segmentStyleToCss(seg({}));
		expect(plain.fontWeight).toBe('normal');
		expect(plain.fontStyle).toBe('normal');

		const emphasised = segmentStyleToCss(seg({ bold: true, italic: true }));
		expect(emphasised.fontWeight).toBe('bold');
		expect(emphasised.fontStyle).toBe('italic');
	});

	describe('hollow / outline-only text (a:rPr > a:noFill)', () => {
		it('leaves the glyph interior unpainted', () => {
			const hollow = segmentStyleToCss(seg({ textFillNone: true }));
			expect(hollow.WebkitTextFillColor).toBe('transparent');
			// `color` is the fallback for an engine without the prefixed property.
			expect(hollow.color).toBe('transparent');
		});

		// THE regression. `textFillNone` never arrives on its own: the parsed run
		// style merges the resolved theme / placeholder / master cascade under the
		// run's own properties, so the inherited colour always fills the slot
		// `<a:noFill/>` deliberately left empty. Reading `color` alone (which is
		// all this builder did) therefore painted every hollow WordArt run solid.
		it('beats the inherited colour that always accompanies it', () => {
			const hollow = segmentStyleToCss(seg({ textFillNone: true, color: '#FF0000' }));
			expect(hollow.color).toBe('transparent');
			expect(hollow.WebkitTextFillColor).toBe('transparent');
		});

		it('keeps painting an ordinary filled run', () => {
			const solid = segmentStyleToCss(seg({ color: '#FF0000' }));
			expect(solid.color).toBe('#FF0000');
			expect(solid.WebkitTextFillColor).toBeUndefined();
		});

		// The outline is the whole point of hollow text, and the stroke defaults to
		// `currentColor` - which the transparent fill above would otherwise take
		// with it, leaving an invisible run instead of an outlined one.
		it('pins a currentColor outline to the resolved colour before going hollow', () => {
			const outlined = segmentStyleToCss(
				seg({ textFillNone: true, color: '#0000FF', textOutlineWidth: 2 }),
			);
			expect(outlined.WebkitTextStroke).toBe('2px #0000FF');

			// An explicitly authored outline colour is left exactly as authored.
			const authored = segmentStyleToCss(
				seg({
					textFillNone: true,
					color: '#0000FF',
					textOutlineWidth: 2,
					textOutlineColor: '#00FF00',
				}),
			);
			expect(authored.WebkitTextStroke).toBe('2px #00FF00');
		});
	});
});

describe('applyUnderlineVariant', () => {
	it('layers a wavy underline style onto the run', () => {
		const style: Record<string, string | number> = {};
		applyUnderlineVariant(style, seg({ underline: true, underlineStyle: 'wavy' }));
		expect(style.textDecorationStyle).toBe('wavy');
	});

	it('a run-authored a:uLn (width/dash) overrides the a:u style-token decoration', () => {
		// a:uLn is a distinct line description from a:u's style token: a run can
		// carry both, and the line's own width/dash win. Previously only its
		// colour (`underlineColor`) ever reached the render output.
		const style: Record<string, string | number> = {};
		applyUnderlineVariant(
			style,
			seg({
				underline: true,
				underlineStyle: 'sng',
				underlineLine: { widthEmu: 28575, prstDash: 'lgDash' },
			}),
		);
		expect(style.textDecorationThickness).toBe('3px');
		expect(style.textDecorationStyle).toBe('dashed');
	});
});

/**
 * The hollow-text decision as its own export, because React's `text-segment-
 * render` builds its run style independently and has to merge the identical
 * object rather than grow a parallel branch (it had none at all, and painted
 * the inherited colour where the other four painted an outline).
 */
describe('hollowTextFillStyle', () => {
	it('is nothing for a run that is not hollow', () => {
		expect(hollowTextFillStyle({}, { color: '#ff0000' })).toBeUndefined();
		expect(hollowTextFillStyle({ textFillNone: false })).toBeUndefined();
	});

	it('clears the fill both ways: -webkit-text-fill-color and the color fallback', () => {
		expect(hollowTextFillStyle({ textFillNone: true })).toStrictEqual({
			color: 'transparent',
			WebkitTextFillColor: 'transparent',
		});
	});

	it('pins a currentColor outline to the resolved colour before clearing it', () => {
		// Without this the fallback turns the STROKE transparent too and the
		// letterform disappears instead of being outlined.
		expect(
			hollowTextFillStyle(
				{ textFillNone: true, textOutlineWidth: 2 },
				{ color: '#0000ff', textStroke: '2px currentColor' },
			),
		).toStrictEqual({
			color: 'transparent',
			WebkitTextFillColor: 'transparent',
			WebkitTextStroke: '2px #0000ff',
		});
	});

	it('leaves an outline that declared its own colour alone', () => {
		expect(
			hollowTextFillStyle(
				{ textFillNone: true, textOutlineWidth: 2, textOutlineColor: '#c00000' },
				{ color: '#0000ff', textStroke: '2px #c00000' },
			).WebkitTextStroke,
		).toBeUndefined();
	});
});

describe('nestedTextDecorationStyle', () => {
	it('hands back the decoration a nested span must repeat', () => {
		// `text-decoration-*` does not inherit: a span nested inside the run (a
		// per-word metric piece, a per-script font span) computes `none` of its
		// own, so the run's underline has to be repeated on it.
		const style = segmentStyleToCss(seg({ hyperlink: 'https://example.com/docs' }));
		applyUnderlineVariant(style, seg({ underline: true, underlineStyle: 'dbl' }));
		expect(nestedTextDecorationStyle(style)).toStrictEqual({
			textDecoration: 'underline',
			textDecorationStyle: 'double',
			textDecorationThickness: '1px',
		});
	});

	it('hands back nothing for an undecorated run, so the span stays bare', () => {
		expect(nestedTextDecorationStyle(segmentStyleToCss(seg({ fontSize: 20 })))).toBeUndefined();
	});
});
