import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyUnderlineVariant, segmentStyleToCss } from './text-run-style';

function seg(style: NonNullable<TextSegment['style']>): TextSegment {
	return { text: 'x', style };
}

describe('segmentStyleToCss run properties', () => {
	it('maps character spacing to letter-spacing px (hundredths of a point)', () => {
		// 100 (=1pt) -> 1 * 96/72 px
		expect(segmentStyleToCss(seg({ characterSpacing: 100 })).letterSpacing).toBe(`${96 / 72}px`);
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
		expect(segmentStyleToCss(seg({ kerning: 1200 })).fontKerning).toBe('normal');
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

	it('leaves a plain run untouched (no extra keys)', () => {
		expect(segmentStyleToCss(seg({ fontSize: 16 }))).toStrictEqual({ fontSize: '16px' });
	});
});

describe('applyUnderlineVariant', () => {
	it('layers a wavy underline style onto the run', () => {
		const style: Record<string, string | number> = {};
		applyUnderlineVariant(style, seg({ underline: true, underlineStyle: 'wavy' }));
		expect(style.textDecorationStyle).toBe('wavy');
	});
});
