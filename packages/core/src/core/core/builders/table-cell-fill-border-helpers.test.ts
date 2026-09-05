import { describe, it, expect } from 'vitest';

import type { PptxTableCellStyle, XmlObject } from '../../types';
import { applyCell3DStyle } from './table-cell-3d-helpers';
import {
	applyCellFillStyle,
	applyCellBorderStyle,
	applyCellMarginStyle,
} from './table-cell-fill-border-helpers';
import type { TableCellFillBorderContext } from './table-cell-fill-border-helpers';

// Helper to build a minimal context.
function makeContext(
	overrides: Partial<TableCellFillBorderContext> = {},
): TableCellFillBorderContext {
	return {
		emuPerPx: 9525,
		ensureArray: (value: unknown): unknown[] => {
			if (Array.isArray(value)) {
				return value;
			}
			if (value === undefined || value === null) {
				return [];
			}
			return [value];
		},
		parseColor: (colorNode: XmlObject | undefined) => {
			if (!colorNode) {
				return undefined;
			}
			const srgb = colorNode['a:srgbClr'] as XmlObject | undefined;
			if (srgb) {
				return `#${srgb['@_val']}`;
			}
			return undefined;
		},
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// applyCellFillStyle - solid fill
// ---------------------------------------------------------------------------

describe('applyCellFillStyle - solid fill', () => {
	it('applies solid fill from a:solidFill', () => {
		const cellProps: XmlObject = {
			'a:solidFill': {
				'a:srgbClr': { '@_val': 'FF0000' },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.fillMode).toBe('solid');
		expect(style.backgroundColor).toBe('#FF0000');
	});

	it('returns false when no fill is present', () => {
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle({}, style, makeContext());
		expect(result).toBeFalsy();
		expect(style.fillMode).toBeUndefined();
	});

	it('returns false when parseColor returns undefined for solidFill', () => {
		const cellProps: XmlObject = {
			'a:solidFill': { 'a:schemeClr': { '@_val': 'accent1' } },
		};
		const style: PptxTableCellStyle = {};
		// Our simple parseColor doesn't handle scheme colors
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeFalsy();
	});

	it('handles undefined cellProperties', () => {
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(undefined, style, makeContext());
		expect(result).toBeFalsy();
	});

	it('captures a typed backgroundColorRef for a plain schemeClr fill', () => {
		const cellProps: XmlObject = {
			'a:solidFill': { 'a:schemeClr': { '@_val': 'accent4', 'a:shade': { '@_val': '80000' } } },
		};
		const style: PptxTableCellStyle = {};
		const context = makeContext({
			parseColor: (colorNode) => {
				const scheme = (colorNode as XmlObject | undefined)?.['a:schemeClr'] as
					| XmlObject
					| undefined;
				return scheme ? '#theme' : undefined;
			},
		});
		const result = applyCellFillStyle(cellProps, style, context);
		expect(result).toBeTruthy();
		expect(style.backgroundColorRef).toStrictEqual({ scheme: 'accent4', shade: 0.8 });
	});
});

// ---------------------------------------------------------------------------
// applyCellFillStyle - gradient fill
// ---------------------------------------------------------------------------

describe('applyCellFillStyle - gradient fill', () => {
	it('sets fillMode to gradient when a:gradFill is present', () => {
		const cellProps: XmlObject = {
			'a:gradFill': {
				'a:gsLst': {
					'a:gs': [
						{
							'@_pos': '0',
							'a:srgbClr': { '@_val': 'FF0000' },
						},
						{
							'@_pos': '100000',
							'a:srgbClr': { '@_val': '0000FF' },
						},
					],
				},
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.fillMode).toBe('gradient');
		// Falls back to first stop color for backgroundColor
		expect(style.backgroundColor).toBe('#FF0000');
	});

	it('calls gradient extraction callbacks when provided', () => {
		const cellProps: XmlObject = {
			'a:gradFill': {
				'a:gsLst': { 'a:gs': [] },
			},
		};
		const style: PptxTableCellStyle = {};
		const stops = [
			{ color: '#FF0000', position: 0 },
			{ color: '#0000FF', position: 1 },
		];
		const context = makeContext({
			extractGradientStops: () => stops,
			extractGradientType: () => 'linear' as const,
			extractGradientAngle: () => 90,
			extractGradientFillCss: () => 'linear-gradient(90deg, #FF0000, #0000FF)',
		});
		applyCellFillStyle(cellProps, style, context);
		expect(style.gradientFillStops).toStrictEqual(stops);
		expect(style.gradientFillType).toBe('linear');
		expect(style.gradientFillAngle).toBe(90);
		expect(style.gradientFillCss).toBe('linear-gradient(90deg, #FF0000, #0000FF)');
	});
});

// ---------------------------------------------------------------------------
// applyCellFillStyle - pattern fill
// ---------------------------------------------------------------------------

describe('applyCellFillStyle - pattern fill', () => {
	it('applies pattern fill with preset, fg, and bg colors', () => {
		const cellProps: XmlObject = {
			'a:pattFill': {
				'@_prst': 'ltDnDiag',
				'a:fgClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
				'a:bgClr': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.fillMode).toBe('pattern');
		expect(style.patternFillPreset).toBe('ltDnDiag');
		expect(style.patternFillForeground).toBe('#FF0000');
		expect(style.patternFillBackground).toBe('#FFFFFF');
		expect(style.backgroundColor).toBe('#FF0000');
	});

	it('applies pattern fill with only preset (no colors)', () => {
		const cellProps: XmlObject = {
			'a:pattFill': { '@_prst': 'dnDiag' },
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.fillMode).toBe('pattern');
		expect(style.patternFillPreset).toBe('dnDiag');
	});

	it('returns false when pattFill has no preset, fg, or bg', () => {
		const cellProps: XmlObject = {
			'a:pattFill': {},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// applyCellFillStyle - image fill (a:tcPr/a:blipFill)
// ---------------------------------------------------------------------------

describe('applyCellFillStyle - image fill', () => {
	it('resolves r:embed to a path and sets fillMode "image"', () => {
		const cellProps: XmlObject = {
			'a:blipFill': { 'a:blip': { '@_r:embed': 'rId3' } },
		};
		const style: PptxTableCellStyle = {};
		const resolveCellImagePath = (
			rEmbed: string | undefined,
			rLink: string | undefined,
			slidePath: string | undefined,
		): string | undefined => {
			expect(rEmbed).toBe('rId3');
			expect(rLink).toBeUndefined();
			expect(slidePath).toBe('ppt/slides/slide1.xml');
			return 'ppt/media/image1.png';
		};
		const result = applyCellFillStyle(
			cellProps,
			style,
			makeContext({ resolveCellImagePath }),
			'ppt/slides/slide1.xml',
		);
		expect(result).toBeTruthy();
		expect(style.fillMode).toBe('image');
		expect(style.backgroundImageFillPath).toBe('ppt/media/image1.png');
	});

	it('falls back to r:link when r:embed is absent', () => {
		const cellProps: XmlObject = {
			'a:blipFill': { 'a:blip': { '@_r:link': 'rId9' } },
		};
		const style: PptxTableCellStyle = {};
		const resolveCellImagePath = (rEmbed: string | undefined, rLink: string | undefined) => {
			expect(rEmbed).toBeUndefined();
			expect(rLink).toBe('rId9');
			return 'https://example.test/linked.png';
		};
		applyCellFillStyle(cellProps, style, makeContext({ resolveCellImagePath }));
		expect(style.fillMode).toBe('image');
		expect(style.backgroundImageFillPath).toBe('https://example.test/linked.png');
	});

	it('returns false when there is no resolveCellImagePath callback wired up', () => {
		const cellProps: XmlObject = {
			'a:blipFill': { 'a:blip': { '@_r:embed': 'rId3' } },
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(cellProps, style, makeContext());
		expect(result).toBeFalsy();
		expect(style.fillMode).toBeUndefined();
	});

	it('returns false when the relationship cannot be resolved', () => {
		const cellProps: XmlObject = {
			'a:blipFill': { 'a:blip': { '@_r:embed': 'rId404' } },
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(
			cellProps,
			style,
			makeContext({ resolveCellImagePath: () => undefined }),
		);
		expect(result).toBeFalsy();
		expect(style.fillMode).toBeUndefined();
	});

	it('returns false when blipFill has no blip', () => {
		const cellProps: XmlObject = { 'a:blipFill': {} };
		const style: PptxTableCellStyle = {};
		const result = applyCellFillStyle(
			cellProps,
			style,
			makeContext({ resolveCellImagePath: () => 'ppt/media/image1.png' }),
		);
		expect(result).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// applyCellBorderStyle
// ---------------------------------------------------------------------------

describe('applyCellBorderStyle', () => {
	it('returns false for undefined cellProperties', () => {
		const style: PptxTableCellStyle = {};
		expect(applyCellBorderStyle(undefined, style, makeContext())).toBeFalsy();
	});

	it('applies top border width and color', () => {
		const cellProps: XmlObject = {
			'a:lnT': {
				'@_w': '12700',
				'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellBorderStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		// 12700 / 9525 ≈ 1.33 → Math.round = 1
		expect(style.borderTopWidth).toBe(1);
		expect(style.borderTopColor).toBe('#000000');
		expect(style.borderColor).toBe('#000000');
	});

	it('applies all four border sides', () => {
		const makeBorder = (color: string) => ({
			'@_w': '19050',
			'a:solidFill': { 'a:srgbClr': { '@_val': color } },
		});
		const cellProps: XmlObject = {
			'a:lnT': makeBorder('FF0000'),
			'a:lnB': makeBorder('00FF00'),
			'a:lnL': makeBorder('0000FF'),
			'a:lnR': makeBorder('FFFF00'),
		};
		const style: PptxTableCellStyle = {};
		applyCellBorderStyle(cellProps, style, makeContext());
		expect(style.borderTopColor).toBe('#FF0000');
		expect(style.borderBottomColor).toBe('#00FF00');
		expect(style.borderLeftColor).toBe('#0000FF');
		expect(style.borderRightColor).toBe('#FFFF00');
		// 19050/9525 = 2
		expect(style.borderTopWidth).toBe(2);
		// Legacy borderColor is first found
		expect(style.borderColor).toBe('#FF0000');
	});

	it('applies border dash style', () => {
		const cellProps: XmlObject = {
			'a:lnT': {
				'@_w': '12700',
				'a:prstDash': { '@_val': 'dash' },
			},
		};
		const style: PptxTableCellStyle = {};
		applyCellBorderStyle(cellProps, style, makeContext());
		expect(style.borderTopDash).toBe('dash');
	});

	it('applies diagonal borders', () => {
		const cellProps: XmlObject = {
			'a:lnTlToBr': {
				'@_w': '19050',
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } },
			},
			'a:lnBlToTr': {
				'@_w': '9525',
				'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellBorderStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.borderDiagDownColor).toBe('#FF0000');
		expect(style.borderDiagDownWidth).toBe(2);
		expect(style.borderDiagUpColor).toBe('#0000FF');
		expect(style.borderDiagUpWidth).toBe(1);
	});

	it('returns false when borders have zero width and no color', () => {
		const cellProps: XmlObject = {
			'a:lnT': { '@_w': '0' },
		};
		const style: PptxTableCellStyle = {};
		expect(applyCellBorderStyle(cellProps, style, makeContext())).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// applyCellMarginStyle
// ---------------------------------------------------------------------------

describe('applyCellMarginStyle', () => {
	it('returns false for undefined cellProperties', () => {
		const style: PptxTableCellStyle = {};
		expect(applyCellMarginStyle(undefined, style, makeContext())).toBeFalsy();
	});

	it('applies margins from a:tcMar', () => {
		const cellProps: XmlObject = {
			'a:tcMar': {
				'a:marL': { '@_w': '91440' },
				'a:marR': { '@_w': '91440' },
				'a:marT': { '@_w': '45720' },
				'a:marB': { '@_w': '45720' },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellMarginStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		// 91440 / 9525 ≈ 9.6 → Math.round = 10
		expect(style.marginLeft).toBe(10);
		expect(style.marginRight).toBe(10);
		// 45720 / 9525 ≈ 4.8 → Math.round = 5
		expect(style.marginTop).toBe(5);
		expect(style.marginBottom).toBe(5);
	});

	it('applies direct margin attributes as fallback', () => {
		const cellProps: XmlObject = {
			'@_marL': '95250',
			'@_marT': '47625',
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellMarginStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		// 95250 / 9525 = 10
		expect(style.marginLeft).toBe(10);
		// 47625 / 9525 = 5
		expect(style.marginTop).toBe(5);
	});

	it('does not overwrite a:tcMar values with direct attributes', () => {
		const cellProps: XmlObject = {
			'a:tcMar': {
				'a:marL': { '@_w': '91440' },
			},
			'@_marL': '190500',
		};
		const style: PptxTableCellStyle = {};
		applyCellMarginStyle(cellProps, style, makeContext());
		// a:tcMar value (10) should win over direct (20)
		expect(style.marginLeft).toBe(10);
	});

	it('returns false when a:tcMar has no children at all', () => {
		const cellProps: XmlObject = { 'a:tcMar': {} };
		const style: PptxTableCellStyle = {};
		expect(applyCellMarginStyle(cellProps, style, makeContext())).toBeFalsy();
	});

	// An explicitly zeroed margin (`<a:marL w="0"/>`, common in dense or
	// image-filled tables) is a deliberate authoring choice, distinct from an
	// absent `a:marL` (which means "unspecified"). It must round-trip as `0`,
	// not collapse to "unspecified" the way a falsy/truthy check would.
	it('applies an explicit zero margin as 0, not "unspecified"', () => {
		const cellProps: XmlObject = {
			'a:tcMar': {
				'a:marL': { '@_w': '0' },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCellMarginStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.marginLeft).toBe(0);
	});

	it('leaves a margin unset when its element has no @_w attribute at all', () => {
		const cellProps: XmlObject = {
			'a:tcMar': {
				'a:marL': {},
			},
		};
		const style: PptxTableCellStyle = {};
		expect(applyCellMarginStyle(cellProps, style, makeContext())).toBeFalsy();
		expect(style.marginLeft).toBeUndefined();
	});

	it('applies an explicit zero margin from a direct attribute fallback', () => {
		const cellProps: XmlObject = { '@_marL': '0' };
		const style: PptxTableCellStyle = {};
		const result = applyCellMarginStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.marginLeft).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// applyCell3DStyle
// ---------------------------------------------------------------------------

describe('applyCell3DStyle', () => {
	it('returns false for undefined cellProperties', () => {
		const style: PptxTableCellStyle = {};
		expect(applyCell3DStyle(undefined, style, makeContext())).toBeFalsy();
		expect(style.cell3D).toBeUndefined();
	});

	it('returns false when no a:cell3D is present', () => {
		const style: PptxTableCellStyle = {};
		expect(applyCell3DStyle({}, style, makeContext())).toBeFalsy();
		expect(style.cell3D).toBeUndefined();
	});

	it('parses bevel width/height/preset, material, and light rig', () => {
		const cellProps: XmlObject = {
			'a:cell3D': {
				'@_prstMaterial': 'plastic',
				'a:bevel': { '@_w': '76200', '@_h': '38100', '@_prst': 'circle' },
				'a:lightRig': { '@_rig': 'threePt', '@_dir': 'tl' },
			},
		};
		const style: PptxTableCellStyle = {};
		const result = applyCell3DStyle(cellProps, style, makeContext());
		expect(result).toBeTruthy();
		// 76200 / 9525 = 8, 38100 / 9525 = 4
		expect(style.cell3D?.bevelWidth).toBe(8);
		expect(style.cell3D?.bevelHeight).toBe(4);
		expect(style.cell3D?.bevelPreset).toBe('circle');
		expect(style.cell3D?.material).toBe('plastic');
		expect(style.cell3D?.lightRig).toBe('threePt');
		expect(style.cell3D?.lightRigDirection).toBe('tl');
	});

	it('parses an empty a:cell3D as no captured properties', () => {
		const cellProps: XmlObject = { 'a:cell3D': {} };
		const style: PptxTableCellStyle = {};
		expect(applyCell3DStyle(cellProps, style, makeContext())).toBeFalsy();
		expect(style.cell3D).toBeUndefined();
	});
});
