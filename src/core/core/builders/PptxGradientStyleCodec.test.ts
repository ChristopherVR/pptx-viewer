import { describe, it, expect } from 'vitest';
import { PptxGradientStyleCodec } from './PptxGradientStyleCodec';
import type { XmlObject, ShapeStyle } from '../../types';

const mockContext = {
	ensureArray: (value: unknown): unknown[] => {
		if (Array.isArray(value)) return value;
		if (value === undefined || value === null) return [];
		return [value];
	},
	parseColor: (colorNode: XmlObject | undefined): string | undefined => {
		if (!colorNode) return undefined;
		const srgb = colorNode['a:srgbClr'] as XmlObject | undefined;
		if (srgb) return `#${srgb['@_val']}`;
		const scheme = colorNode['a:schemeClr'] as XmlObject | undefined;
		if (scheme) return `#theme_${scheme['@_val']}`;
		return undefined;
	},
	extractColorOpacity: (): number | undefined => undefined,
	clampUnitInterval: (v: number): number => Math.max(0, Math.min(1, v)),
	hexToRgb: (hex: string) => {
		const h = hex.replace('#', '');
		return {
			r: parseInt(h.substring(0, 2), 16),
			g: parseInt(h.substring(2, 4), 16),
			b: parseInt(h.substring(4, 6), 16),
		};
	},
	rgbToHex: (r: number, g: number, b: number): string => {
		const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	},
};

describe('PptxGradientStyleCodec', () => {
	const codec = new PptxGradientStyleCodec(mockContext);

	describe('extractGradientStops', () => {
		it('should extract stops with colors and positions', () => {
			const gradFill: XmlObject = {
				'a:gsLst': {
					'a:gs': [
						{ '@_pos': '0', 'a:srgbClr': { '@_val': 'FF0000' } },
						{ '@_pos': '100000', 'a:srgbClr': { '@_val': '0000FF' } },
					],
				},
			};
			const stops = codec.extractGradientStops(gradFill);
			expect(stops).toHaveLength(2);
			expect(stops[0].color).toBe('#FF0000');
			expect(stops[0].position).toBe(0);
			expect(stops[1].color).toBe('#0000FF');
			expect(stops[1].position).toBe(100);
		});

		it('should preserve originalColorXml for scheme colors with transforms', () => {
			const gradFill: XmlObject = {
				'a:gsLst': {
					'a:gs': [
						{
							'@_pos': '0',
							'a:schemeClr': {
								'@_val': 'accent1',
								'a:lumMod': { '@_val': '75000' },
								'a:shade': { '@_val': '80000' },
							},
						},
					],
				},
			};
			const stops = codec.extractGradientStops(gradFill);
			expect(stops).toHaveLength(1);
			expect(stops[0].originalColorXml).toBeDefined();
			const colorXml = stops[0].originalColorXml as XmlObject;
			expect(colorXml['a:schemeClr']).toBeDefined();
			const schemeClr = colorXml['a:schemeClr'] as XmlObject;
			expect(schemeClr['@_val']).toBe('accent1');
			expect(schemeClr['a:lumMod']).toEqual({ '@_val': '75000' });
			expect(schemeClr['a:shade']).toEqual({ '@_val': '80000' });
		});

		it('should preserve originalColorXml for sRGB colors', () => {
			const gradFill: XmlObject = {
				'a:gsLst': {
					'a:gs': [
						{ '@_pos': '50000', 'a:srgbClr': { '@_val': 'AABBCC' } },
					],
				},
			};
			const stops = codec.extractGradientStops(gradFill);
			expect(stops[0].originalColorXml).toEqual({
				'a:srgbClr': { '@_val': 'AABBCC' },
			});
		});
	});

	describe('buildGradientFillXml', () => {
		it('should prefer originalColorXml over sRGB when building XML', () => {
			const shapeStyle: ShapeStyle = {
				fillGradientStops: [
					{
						color: '#theme_accent1',
						position: 0,
						originalColorXml: {
							'a:schemeClr': {
								'@_val': 'accent1',
								'a:tint': { '@_val': '60000' },
							},
						},
					},
					{
						color: '#0000FF',
						position: 100,
					},
				],
				fillGradientType: 'linear',
				fillGradientAngle: 90,
			};
			const xml = codec.buildGradientFillXml(shapeStyle);
			expect(xml).toBeDefined();
			const stops = (xml as XmlObject)['a:gsLst'] as XmlObject;
			const gsArray = stops['a:gs'] as XmlObject[];
			expect(gsArray).toHaveLength(2);

			// First stop should use preserved scheme color
			expect(gsArray[0]['a:schemeClr']).toBeDefined();
			expect((gsArray[0]['a:schemeClr'] as XmlObject)['@_val']).toBe('accent1');
			expect((gsArray[0]['a:schemeClr'] as XmlObject)['a:tint']).toEqual({ '@_val': '60000' });

			// Second stop should use sRGB fallback
			expect(gsArray[1]['a:srgbClr']).toBeDefined();
			expect((gsArray[1]['a:srgbClr'] as XmlObject)['@_val']).toBe('0000FF');
		});

		it('should round-trip gradient stops preserving scheme colors', () => {
			const gradFill: XmlObject = {
				'a:gsLst': {
					'a:gs': [
						{
							'@_pos': '0',
							'a:schemeClr': {
								'@_val': 'dk1',
								'a:satMod': { '@_val': '110000' },
							},
						},
						{
							'@_pos': '100000',
							'a:schemeClr': {
								'@_val': 'lt1',
								'a:lumMod': { '@_val': '90000' },
								'a:lumOff': { '@_val': '10000' },
							},
						},
					],
				},
				'a:lin': { '@_ang': '5400000', '@_scaled': '1' },
			};

			// Extract
			const stops = codec.extractGradientStops(gradFill);
			const angle = codec.extractGradientAngle(gradFill);
			const type = codec.extractGradientType(gradFill);

			// Build
			const shapeStyle: ShapeStyle = {
				fillGradientStops: stops,
				fillGradientAngle: angle,
				fillGradientType: type,
			};
			const rebuilt = codec.buildGradientFillXml(shapeStyle);
			expect(rebuilt).toBeDefined();

			const rebuiltStops = ((rebuilt as XmlObject)['a:gsLst'] as XmlObject)['a:gs'] as XmlObject[];

			// Verify scheme colors are preserved, not flattened to sRGB
			expect(rebuiltStops[0]['a:schemeClr']).toBeDefined();
			expect((rebuiltStops[0]['a:schemeClr'] as XmlObject)['@_val']).toBe('dk1');
			expect((rebuiltStops[0]['a:schemeClr'] as XmlObject)['a:satMod']).toEqual({ '@_val': '110000' });

			expect(rebuiltStops[1]['a:schemeClr']).toBeDefined();
			expect((rebuiltStops[1]['a:schemeClr'] as XmlObject)['@_val']).toBe('lt1');
			expect((rebuiltStops[1]['a:schemeClr'] as XmlObject)['a:lumMod']).toEqual({ '@_val': '90000' });
			expect((rebuiltStops[1]['a:schemeClr'] as XmlObject)['a:lumOff']).toEqual({ '@_val': '10000' });
		});

		it('should handle empty gradient stops gracefully', () => {
			const shapeStyle: ShapeStyle = {
				fillGradientStops: [],
			};
			const xml = codec.buildGradientFillXml(shapeStyle);
			expect(xml).toBeUndefined();
		});
	});
});
