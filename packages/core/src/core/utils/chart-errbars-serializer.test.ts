import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applySeriesErrBarsToXml } from './chart-errbars-serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function seriesNode(): XmlObject {
	return {
		'c:idx': { '@_val': '0' },
		'c:cat': {},
		'c:val': {},
	};
}

function errBarsOf(node: XmlObject): XmlObject {
	const e = node['c:errBars'];
	return (Array.isArray(e) ? e[0] : e) as XmlObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applySeriesErrBarsToXml', () => {
	it('writes direction, bar type, value type, and value before cat/val', () => {
		const node = seriesNode();
		applySeriesErrBarsToXml(
			node,
			[{ direction: 'y', barType: 'both', valType: 'percentage', val: 5 }],
			getLocalName,
		);
		const e = errBarsOf(node);
		expect(e['c:errDir']).toStrictEqual({ '@_val': 'y' });
		expect(e['c:errBarType']).toStrictEqual({ '@_val': 'both' });
		expect(e['c:errValType']).toStrictEqual({ '@_val': 'percentage' });
		expect(e['c:val']).toStrictEqual({ '@_val': '5' });
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('errBars')).toBeLessThan(keys.indexOf('cat'));
	});

	it('omits the value element for standard-error bars', () => {
		const node = seriesNode();
		applySeriesErrBarsToXml(
			node,
			[{ direction: 'y', barType: 'both', valType: 'stdErr' }],
			getLocalName,
		);
		expect(errBarsOf(node)['c:val']).toBeUndefined();
	});

	it('writes custom plus/minus numLit caches for custom error bars', () => {
		const node = seriesNode();
		applySeriesErrBarsToXml(
			node,
			[
				{
					direction: 'y',
					barType: 'both',
					valType: 'cust',
					customPlus: [1, 2, 3],
					customMinus: [1, 1, 1],
				},
			],
			getLocalName,
		);
		const e = errBarsOf(node);
		const plus = (e['c:plus'] as XmlObject)['c:numLit'] as XmlObject;
		expect(plus['c:ptCount']).toStrictEqual({ '@_val': '3' });
		expect((plus['c:pt'] as XmlObject[])[0]).toStrictEqual({ '@_idx': '0', 'c:v': '1' });
		expect((e['c:minus'] as XmlObject)['c:numLit']).toBeDefined();
		expect(e['c:val']).toBeUndefined();
	});

	it('removes error bars when given an empty array', () => {
		const node = seriesNode();
		applySeriesErrBarsToXml(
			node,
			[{ direction: 'y', barType: 'both', valType: 'fixedVal', val: 1 }],
			getLocalName,
		);
		applySeriesErrBarsToXml(node, [], getLocalName);
		expect('c:errBars' in node).toBeFalsy();
	});

	it('preserves noEndCap and spPr on an existing node when updating', () => {
		const node = seriesNode();
		node['c:errBars'] = {
			'c:errDir': { '@_val': 'y' },
			'c:errBarType': { '@_val': 'both' },
			'c:errValType': { '@_val': 'fixedVal' },
			'c:noEndCap': { '@_val': '1' },
			'c:spPr': { 'a:ln': { '@_w': '9525' } },
			'c:val': { '@_val': '1' },
		};
		applySeriesErrBarsToXml(
			node,
			[{ direction: 'y', barType: 'minus', valType: 'fixedVal', val: 2 }],
			getLocalName,
		);
		const e = errBarsOf(node);
		expect(e['c:noEndCap']).toStrictEqual({ '@_val': '1' });
		expect(e['c:spPr']).toStrictEqual({ 'a:ln': { '@_w': '9525' } });
		expect(e['c:errBarType']).toStrictEqual({ '@_val': 'minus' });
		expect(e['c:val']).toStrictEqual({ '@_val': '2' });
	});

	it('supports x and y error bars as an array', () => {
		const node = seriesNode();
		applySeriesErrBarsToXml(
			node,
			[
				{ direction: 'x', barType: 'both', valType: 'fixedVal', val: 1 },
				{ direction: 'y', barType: 'both', valType: 'fixedVal', val: 2 },
			],
			getLocalName,
		);
		expect(Array.isArray(node['c:errBars'])).toBeTruthy();
		expect(node['c:errBars'] as XmlObject[]).toHaveLength(2);
	});

	it('edits end caps and line color while preserving extensions', () => {
		const node = seriesNode();
		node['c:errBars'] = {
			'c:errBarType': { '@_val': 'both' },
			'c:errValType': { '@_val': 'fixedVal' },
			'c:spPr': { 'a:ln': { '@_w': '12700' } },
			'c:extLst': { marker: true },
		};
		applySeriesErrBarsToXml(
			node,
			[
				{
					direction: 'y',
					barType: 'both',
					valType: 'fixedVal',
					val: 2,
					noEndCap: false,
					color: '#123456',
				},
			],
			getLocalName,
		);
		const bars = errBarsOf(node);
		expect(bars['c:noEndCap']).toStrictEqual({ '@_val': '0' });
		expect(bars['c:extLst']).toStrictEqual({ marker: true });
		const line = (bars['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(line['@_w']).toBe('12700');
		expect(line['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '123456' } });
	});

	it('rejects non-finite values', () => {
		expect(() =>
			applySeriesErrBarsToXml(
				seriesNode(),
				[{ direction: 'y', barType: 'both', valType: 'fixedVal', val: Number.NaN }],
				getLocalName,
			),
		).toThrow(RangeError);
	});
});
