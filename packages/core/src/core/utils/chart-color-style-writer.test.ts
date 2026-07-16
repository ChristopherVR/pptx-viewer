import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartColorStyleXml, buildChartColorStyleXml } from './chart-color-style-writer';

describe('chart color style writer', () => {
	it('replaces palette colors in schema order while preserving extensions', () => {
		const tree: XmlObject = {
			'x:colorStyle': {
				'@_xmlns:x': 'http://schemas.microsoft.com/office/drawing/2012/chartStyle',
				'@_meth': 'cycle',
				'@_id': '12',
				'a:schemeClr': [{ '@_val': 'accent1' }],
				'x:variation': { 'a:tint': { '@_val': '20000' } },
				'x:extLst': { 'a:ext': { '@_uri': 'urn:test', 'v:data': {} } },
			},
		};
		applyChartColorStyleXml(tree, ['#112233', 'AABBCC'], 'withinLinear');
		const root = tree['x:colorStyle'] as XmlObject;
		expect(Object.keys(root)).toStrictEqual([
			'@_xmlns:x',
			'@_meth',
			'@_id',
			'a:srgbClr',
			'x:variation',
			'x:extLst',
		]);
		expect(root['a:srgbClr']).toStrictEqual([{ '@_val': '112233' }, { '@_val': 'AABBCC' }]);
		expect(root['x:extLst']).toStrictEqual({
			'a:ext': { '@_uri': 'urn:test', 'v:data': {} },
		});
	});

	it('builds and validates generated color style parts', () => {
		expect(buildChartColorStyleXml(['#4472C4'], 'cycle')).toMatchObject({
			'cs:colorStyle': { '@_meth': 'cycle', 'a:srgbClr': [{ '@_val': '4472C4' }] },
		});
		expect(() => buildChartColorStyleXml([], 'cycle')).toThrow(RangeError);
		expect(() => buildChartColorStyleXml(['red'], 'cycle')).toThrow(RangeError);
	});
});
