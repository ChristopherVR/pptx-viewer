import { describe, expect, it } from 'vitest';

import type { ShapeStyle, StrokeDashType, XmlObject } from '../types';
import { applyDrawingLineDash, parseDrawingLineDash } from './drawing-line-dash';

const normalize = (value: unknown): StrokeDashType | undefined =>
	value === 'dash' || value === 'solid' ? value : undefined;

describe('drawingML custom line dash', () => {
	it('parses arbitrary prefixes and preserves dash-stop payloads', () => {
		const custom: XmlObject = {
			'@_vendor': 'wrapper',
			'd:ds': [
				{ '@_d': '125000', '@_sp': '75000', '@_vendor': 'first' },
				{ '@_d': '50000', '@_sp': '25000', '@_vendor': 'second' },
			],
		};
		const parsed = parseDrawingLineDash({ 'd:custDash': custom }, normalize);
		expect(parsed).toMatchObject({
			strokeDash: 'custom',
			customDashSegments: [
				{ dash: 125000, space: 75000 },
				{ dash: 50000, space: 25000 },
			],
			customDashXml: custom,
		});
	});

	it('round-trips unchanged XML and edits values without losing unknown data', () => {
		const line: XmlObject = {
			'd:solidFill': { 'd:schemeClr': { '@_val': 'accent1' } },
			'd:custDash': {
				'@_vendor': 'wrapper',
				'd:ds': { '@_d': '125000', '@_sp': '75000', '@_vendor': 'stop' },
			},
			'd:miter': { '@_lim': '800000' },
			'd:extLst': { 'd:ext': { '@_uri': 'keep' } },
		};
		const style = parseDrawingLineDash(line, normalize) as ShapeStyle;
		const unchanged = structuredClone(line);
		applyDrawingLineDash(unchanged, style);
		expect(unchanged).toStrictEqual(line);

		style.customDashSegments![0].dash = 200000;
		applyDrawingLineDash(line, style);
		expect(line['d:custDash']).toStrictEqual({
			'@_vendor': 'wrapper',
			'd:ds': { '@_d': '200000', '@_sp': '75000', '@_vendor': 'stop' },
		});
		expect(Object.keys(line)).toStrictEqual(['d:solidFill', 'd:custDash', 'd:miter', 'd:extLst']);
	});

	it('rejects invalid stops and removes arbitrary-prefixed dash choices', () => {
		const parsed = parseDrawingLineDash(
			{
				'd:custDash': {
					'd:ds': [
						{ '@_d': '-1', '@_sp': '2' },
						{ '@_d': '3', '@_sp': '2147483648' },
					],
				},
			},
			normalize,
		);
		expect(parsed.customDashSegments).toStrictEqual([]);

		const line: XmlObject = {
			'd:prstDash': { '@_val': 'dash' },
			'd:custDash': { 'd:ds': { '@_d': '1', '@_sp': '1' } },
		};
		applyDrawingLineDash(line, { strokeDash: 'solid' });
		expect(line).toStrictEqual({});
	});

	it('inserts custom dash before line joins and extensions', () => {
		const line: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } },
			'a:headEnd': { '@_type': 'triangle' },
			'a:extLst': { 'a:ext': { '@_uri': 'keep' } },
		};
		applyDrawingLineDash(line, {
			strokeDash: 'custom',
			customDashSegments: [{ dash: 100000, space: 50000 }],
		});
		expect(Object.keys(line)).toStrictEqual(['a:solidFill', 'a:custDash', 'a:headEnd', 'a:extLst']);
	});
});
