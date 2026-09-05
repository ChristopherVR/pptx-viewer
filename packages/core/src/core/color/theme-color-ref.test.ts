import { describe, expect, it } from 'vitest';

import {
	resolveThemeColorRef,
	themeColorRefFromColorChoice,
	themeColorRefFromSchemeClr,
	themeColorRefToSolidFill,
	themeColorRefToSolidFillWithOpacity,
	themeColorRefToXml,
} from './theme-color-ref';

const THEME = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	accent1: '#4472C4',
	bg1: '#FFFFFF',
	tx1: '#000000',
};

describe('theme-color-ref', () => {
	it('writes schemeClr children in schema order as thousandths of a percent', () => {
		const xml = themeColorRefToXml({ scheme: 'accent1', lumMod: 0.6, lumOff: 0.4, alpha: 0.5 });
		expect(Object.keys(xml)).toStrictEqual(['@_val', 'a:lumMod', 'a:lumOff', 'a:alpha']);
		expect(xml['a:lumMod']).toStrictEqual({ '@_val': '60000' });
		expect(xml['a:lumOff']).toStrictEqual({ '@_val': '40000' });
		expect(themeColorRefToSolidFill({ scheme: 'tx1' })).toStrictEqual({
			'a:schemeClr': { '@_val': 'tx1' },
		});
	});

	it('round-trips a typed ref through XML', () => {
		const ref = { scheme: 'accent2' as const, tint: 0.75, shade: 0.9, lumMod: 0.2, lumOff: 0.8 };
		expect(themeColorRefFromSchemeClr(themeColorRefToXml(ref))).toStrictEqual(ref);
		expect(themeColorRefFromColorChoice(themeColorRefToSolidFill(ref))).toStrictEqual(ref);
	});

	it('refuses nodes the typed model cannot express', () => {
		expect(
			themeColorRefFromSchemeClr({ '@_val': 'accent1', 'a:satMod': { '@_val': '50000' } }),
		).toBeUndefined();
		expect(themeColorRefFromSchemeClr({ '@_val': 'notAScheme' })).toBeUndefined();
		expect(themeColorRefFromColorChoice({ 'a:srgbClr': { '@_val': 'FF0000' } })).toBeUndefined();
	});

	it('resolves a ref against the theme map, applying luminance variants', () => {
		expect(resolveThemeColorRef({ scheme: 'accent1' }, THEME)).toBe('#4472c4');
		// Lighter 80% of white-ish accent stays lighter than the base.
		const lighter = resolveThemeColorRef({ scheme: 'accent1', lumMod: 0.2, lumOff: 0.8 }, THEME);
		expect(lighter).toBe('#dae3f3');
		// Darker 50% halves the luminance.
		expect(resolveThemeColorRef({ scheme: 'accent1', lumMod: 0.5 }, THEME)).toBe('#203864');
		// bg2 falls back to lt2 through the default clrMap when the map lacks the alias.
		expect(resolveThemeColorRef({ scheme: 'bg2' }, { lt2: '#E7E6E6' })).toBe('#e7e6e6');
		expect(resolveThemeColorRef({ scheme: 'accent6' }, THEME)).toBeUndefined();
	});

	it('folds an opacity fraction into alpha only when the ref has none of its own', () => {
		expect(themeColorRefToSolidFillWithOpacity({ scheme: 'accent1' }, 0.5)).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent1', 'a:alpha': { '@_val': '50000' } },
		});
		// Opaque (1) or absent opacity: no alpha child added.
		expect(themeColorRefToSolidFillWithOpacity({ scheme: 'accent1' }, 1)).toStrictEqual(
			themeColorRefToSolidFill({ scheme: 'accent1' }),
		);
		expect(themeColorRefToSolidFillWithOpacity({ scheme: 'accent1' })).toStrictEqual(
			themeColorRefToSolidFill({ scheme: 'accent1' }),
		);
		// An explicit ref.alpha wins over the opacity fraction.
		expect(
			themeColorRefToSolidFillWithOpacity({ scheme: 'accent1', alpha: 0.9 }, 0.2),
		).toStrictEqual(themeColorRefToSolidFill({ scheme: 'accent1', alpha: 0.9 }));
	});
});
