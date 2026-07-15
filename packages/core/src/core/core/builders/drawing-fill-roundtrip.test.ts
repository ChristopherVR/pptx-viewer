import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { drawingChild, drawingChildren, mergeDrawingFillXml } from './drawing-fill-xml';
import { PptxGradientStyleCodec } from './PptxGradientStyleCodec';

const codec = new PptxGradientStyleCodec({
	ensureArray: (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]),
	parseColor: (node) => {
		const color = drawingChild(node, 'srgbClr');
		return color?.['@_val'] ? `#${String(color['@_val'])}` : undefined;
	},
	extractColorOpacity: () => undefined,
	clampUnitInterval: (value) => Math.max(0, Math.min(1, value)),
	hexToRgb: () => undefined,
	rgbToHex: () => '#000000',
});

describe('drawingML fill round-trip preservation', () => {
	it('parses gradient structure independently of the authored prefix', () => {
		const gradient: XmlObject = {
			'@_flip': 'xy',
			'd:gsLst': {
				'd:gs': [
					{ '@_pos': '0', 'd:srgbClr': { '@_val': 'FF0000' } },
					{ '@_pos': '100000', 'd:srgbClr': { '@_val': '0000FF' } },
				],
			},
			'd:path': {
				'@_path': 'rect',
				'd:fillToRect': { '@_l': '10000', '@_t': '20000', '@_r': '30000', '@_b': '40000' },
			},
		};

		const stops = codec.extractGradientStops(gradient);
		expect(stops).toMatchObject([
			{ color: '#FF0000', position: 0 },
			{ color: '#0000FF', position: 100 },
		]);
		expect(stops[0].originalColorXml).toStrictEqual({
			'd:srgbClr': { '@_val': 'FF0000' },
		});
		expect(codec.extractGradientType(gradient)).toBe('radial');
		expect(codec.extractGradientPathType(gradient)).toBe('rect');
		expect(codec.extractGradientFillToRect(gradient)).toStrictEqual({
			l: 0.1,
			t: 0.2,
			r: 0.3,
			b: 0.4,
		});
	});

	it('preserves gradient extensions, unknown markup, and attributes in schema order', () => {
		const original: XmlObject = {
			'@_vendorAttr': 'keep',
			'd:gsLst': { 'd:gs': [] },
			'd:tileRect': { '@_l': '5000' },
			'd:extLst': { 'd:ext': { '@_uri': 'urn:test' } },
			'x:future': { '@_val': 'keep' },
		};
		const style: ShapeStyle = {
			fillGradientXml: original,
			fillGradientType: 'linear',
			fillGradientAngle: 30,
			fillGradientStops: [{ color: '#112233', position: 0 }],
		};

		const output = codec.buildGradientFillXml(style)!;
		expect(output['@_vendorAttr']).toBe('keep');
		expect(output['d:tileRect']).toStrictEqual({ '@_l': '5000' });
		expect(output['d:extLst']).toStrictEqual({ 'd:ext': { '@_uri': 'urn:test' } });
		expect(output['x:future']).toStrictEqual({ '@_val': 'keep' });
		expect(
			Object.keys(output)
				.filter((key) => !key.startsWith('@_'))
				.slice(0, 4),
		).toStrictEqual(['a:gsLst', 'a:lin', 'd:tileRect', 'd:extLst']);
	});

	it('replaces modeled pattern children but retains extension markup', () => {
		const output = mergeDrawingFillXml(
			{
				'@_prst': 'pct5',
				'd:fgClr': { 'd:schemeClr': { '@_val': 'accent1' } },
				'd:bgClr': { 'd:schemeClr': { '@_val': 'lt1' } },
				'd:extLst': { 'd:ext': { '@_uri': 'urn:pattern' } },
			},
			{
				'@_prst': 'cross',
				'a:fgClr': { 'a:srgbClr': { '@_val': '123456' } },
				'a:bgClr': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
			},
			['fgClr', 'bgClr'],
			['fgClr', 'bgClr', 'extLst'],
		);

		expect(output['@_prst']).toBe('cross');
		expect(drawingChildren(output, 'fgClr')).toHaveLength(1);
		expect(drawingChildren(output, 'bgClr')).toHaveLength(1);
		expect(output['d:extLst']).toStrictEqual({ 'd:ext': { '@_uri': 'urn:pattern' } });
		expect(Object.keys(output).filter((key) => !key.startsWith('@_'))).toStrictEqual([
			'a:fgClr',
			'a:bgClr',
			'd:extLst',
		]);
	});

	it('serializes an edited gradient stop instead of stale preserved color XML', () => {
		const style: ShapeStyle = {
			fillGradientStops: [
				{
					color: '#445566',
					position: 25,
					originalColorXml: { 'a:srgbClr': { '@_val': '112233' } },
				},
			],
		};
		const output = codec.buildGradientFillXml(style)!;
		const stop = drawingChildren(drawingChild(output, 'gsLst'), 'gs')[0];
		expect(drawingChild(stop, 'srgbClr')?.['@_val']).toBe('445566');
	});
});
