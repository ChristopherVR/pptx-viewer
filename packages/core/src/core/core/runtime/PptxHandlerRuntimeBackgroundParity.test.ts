import { describe, it, expect } from 'vitest';

import type { PptxThemeFormatScheme, XmlObject } from '../../types';

/**
 * Mirror of `resolveBackgroundRefColor` (PptxHandlerRuntimeBackgroundParsing).
 *
 * The production version is a protected method on a deep mixin chain; we
 * re-implement the logic here so we can drive it with synthetic theme
 * format schemes without spinning up the full runtime. Any change to the
 * production resolver must be mirrored below.
 */
function resolveBackgroundRefColor(
	bgRef: XmlObject,
	themeFormatScheme: PptxThemeFormatScheme | undefined,
	parseColor: (node: XmlObject | undefined) => string | undefined,
): string | undefined {
	const rawIdx = bgRef['@_idx'];
	const idx = parseInt(String(rawIdx ?? '0'), 10);
	if (Number.isFinite(idx) && idx === 0) {
		return undefined;
	}
	const solidFill = bgRef['a:solidFill'] as XmlObject | undefined;
	if (solidFill) {
		return parseColor(solidFill);
	}
	const overrideColor = parseColor(bgRef);
	if (Number.isFinite(idx) && themeFormatScheme) {
		let fillDef = undefined as PptxThemeFormatScheme['fillStyles'][number] | undefined;
		if (idx >= 1 && idx <= 999) {
			fillDef = themeFormatScheme.fillStyles[idx - 1];
		} else if (idx >= 1001 && idx <= 1003) {
			fillDef = themeFormatScheme.backgroundFillStyles[idx - 1001];
		}
		if (fillDef) {
			switch (fillDef.kind) {
				case 'none':
					return undefined;
				case 'solid':
				case 'gradient':
					return overrideColor || fillDef.color;
				case 'pattern':
					return overrideColor || fillDef.color || fillDef.patternBackgroundColor;
			}
		}
	}
	if (overrideColor) {
		return overrideColor;
	}
	return '#FFFFFF';
}

const FORMAT_SCHEME: PptxThemeFormatScheme = {
	fillStyles: [
		{ kind: 'solid', color: '#AAAAAA' },
		{ kind: 'solid', color: '#BBBBBB' },
		{ kind: 'solid', color: '#CCCCCC' },
	],
	lineStyles: [],
	effectStyles: [],
	backgroundFillStyles: [
		{ kind: 'solid', color: '#111111' },
		{ kind: 'solid', color: '#222222' },
		{ kind: 'solid', color: '#333333' },
	],
};

const stubParseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	if (srgb && typeof srgb['@_val'] === 'string') {
		return `#${(srgb['@_val'] as string).toUpperCase()}`;
	}
	return undefined;
};

describe('bgRef @idx full table (ECMA-376 §20.1.4.2.10)', () => {
	it('idx == 0 → no fill / undefined', () => {
		expect(
			resolveBackgroundRefColor({ '@_idx': '0' }, FORMAT_SCHEME, stubParseColor),
		).toBeUndefined();
	});

	it('idx 1-999 → fillStyleLst[idx-1]', () => {
		expect(resolveBackgroundRefColor({ '@_idx': '1' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#AAAAAA',
		);
		expect(resolveBackgroundRefColor({ '@_idx': '3' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#CCCCCC',
		);
	});

	it('idx 1001-1003 → bgFillStyleLst[idx-1001]', () => {
		expect(resolveBackgroundRefColor({ '@_idx': '1001' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#111111',
		);
		expect(resolveBackgroundRefColor({ '@_idx': '1003' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#333333',
		);
	});

	it('out-of-range idx falls through to #FFFFFF', () => {
		expect(resolveBackgroundRefColor({ '@_idx': '500' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#FFFFFF',
		);
		expect(resolveBackgroundRefColor({ '@_idx': '1500' }, FORMAT_SCHEME, stubParseColor)).toBe(
			'#FFFFFF',
		);
	});

	it('idx 0 with mid-out-of-range theme size still returns undefined', () => {
		const sparseScheme: PptxThemeFormatScheme = {
			...FORMAT_SCHEME,
			fillStyles: [{ kind: 'solid', color: '#AAAAAA' }],
		};
		expect(
			resolveBackgroundRefColor({ '@_idx': '0' }, sparseScheme, stubParseColor),
		).toBeUndefined();
	});

	it('override colour child takes precedence over the matrix entry', () => {
		const bgRef: XmlObject = {
			'@_idx': '1001',
			'a:srgbClr': { '@_val': 'AABBCC' },
		};
		expect(resolveBackgroundRefColor(bgRef, FORMAT_SCHEME, stubParseColor)).toBe('#AABBCC');
	});

	it('idx 1001 returns gradient fill colour (fall through to .color)', () => {
		const gradientScheme: PptxThemeFormatScheme = {
			...FORMAT_SCHEME,
			backgroundFillStyles: [{ kind: 'gradient', color: '#445566' }],
		};
		expect(resolveBackgroundRefColor({ '@_idx': '1001' }, gradientScheme, stubParseColor)).toBe(
			'#445566',
		);
	});
});

/**
 * Pure-logic mirror of `extractBackgroundPattern`.
 *
 * The production version reads the same XML shape; we mirror it here so
 * we can validate the discriminator without instantiating the runtime.
 */
function extractBackgroundPattern(slideXml: XmlObject):
	| {
			preset: string;
			fgColor?: string;
			bgColor?: string;
	  }
	| undefined {
	const bg = (slideXml['p:sld'] as XmlObject | undefined)?.['p:cSld'] as XmlObject | undefined;
	const pattFill = (bg?.['p:bg'] as XmlObject | undefined)?.['p:bgPr']?.['a:pattFill'] as
		| XmlObject
		| undefined;
	if (!pattFill) {
		return undefined;
	}
	const preset = String(pattFill['@_prst'] || '').trim();
	if (!preset) {
		return undefined;
	}
	return {
		preset,
		fgColor: stubParseColor(pattFill['a:fgClr'] as XmlObject | undefined),
		bgColor: stubParseColor(pattFill['a:bgClr'] as XmlObject | undefined),
	};
}

describe('extractBackgroundPattern (typed pattFill discriminator)', () => {
	it('returns undefined for slides without a pattFill', () => {
		expect(extractBackgroundPattern({ 'p:sld': { 'p:cSld': {} } })).toBeUndefined();
	});

	it('emits preset + fg + bg when pattFill is present', () => {
		const result = extractBackgroundPattern({
			'p:sld': {
				'p:cSld': {
					'p:bg': {
						'p:bgPr': {
							'a:pattFill': {
								'@_prst': 'ltDnDiag',
								'a:fgClr': { 'a:srgbClr': { '@_val': '4472C4' } },
								'a:bgClr': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
							},
						},
					},
				},
			},
		});
		expect(result).toStrictEqual({
			preset: 'ltDnDiag',
			fgColor: '#4472C4',
			bgColor: '#FFFFFF',
		});
	});

	it('returns undefined when @prst is missing', () => {
		expect(
			extractBackgroundPattern({
				'p:sld': {
					'p:cSld': {
						'p:bg': {
							'p:bgPr': {
								'a:pattFill': {
									'a:fgClr': { 'a:srgbClr': { '@_val': '000000' } },
								},
							},
						},
					},
				},
			}),
		).toBeUndefined();
	});
});

/**
 * Pure-logic mirror of `extractBackgroundShadeToTitle`.
 */
function extractBackgroundShadeToTitle(slideXml: XmlObject): boolean | undefined {
	const bgPr = (
		(slideXml['p:sld'] as XmlObject | undefined)?.['p:cSld']?.['p:bg'] as XmlObject | undefined
	)?.['p:bgPr'] as XmlObject | undefined;
	if (!bgPr) {
		return undefined;
	}
	const raw = bgPr['@_shadeToTitle'];
	if (raw === undefined) {
		return undefined;
	}
	const normalized = String(raw).trim().toLowerCase();
	return normalized === '1' || normalized === 'true';
}

describe('extractBackgroundShadeToTitle (round-trip)', () => {
	it('returns undefined when attribute is absent', () => {
		expect(
			extractBackgroundShadeToTitle({
				'p:sld': { 'p:cSld': { 'p:bg': { 'p:bgPr': {} } } },
			}),
		).toBeUndefined();
	});

	it('parses shadeToTitle="1" as true', () => {
		expect(
			extractBackgroundShadeToTitle({
				'p:sld': {
					'p:cSld': {
						'p:bg': { 'p:bgPr': { '@_shadeToTitle': '1' } },
					},
				},
			}),
		).toBeTruthy();
	});

	it('parses shadeToTitle="0" as false', () => {
		expect(
			extractBackgroundShadeToTitle({
				'p:sld': {
					'p:cSld': {
						'p:bg': { 'p:bgPr': { '@_shadeToTitle': '0' } },
					},
				},
			}),
		).toBeFalsy();
	});

	it('parses shadeToTitle="true" / "false"', () => {
		expect(
			extractBackgroundShadeToTitle({
				'p:sld': {
					'p:cSld': { 'p:bg': { 'p:bgPr': { '@_shadeToTitle': 'true' } } },
				},
			}),
		).toBeTruthy();
		expect(
			extractBackgroundShadeToTitle({
				'p:sld': {
					'p:cSld': { 'p:bg': { 'p:bgPr': { '@_shadeToTitle': 'false' } } },
				},
			}),
		).toBeFalsy();
	});
});
