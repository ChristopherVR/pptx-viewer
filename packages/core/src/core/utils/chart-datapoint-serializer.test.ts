import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applySeriesDataPointsToXml } from './chart-datapoint-serializer';

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

function seriesNode(): XmlObject {
	return {
		'c:idx': { '@_val': '0' },
		'c:order': { '@_val': '0' },
		'c:tx': { 'c:v': 'Series 1' },
		'c:cat': {},
		'c:val': {},
	};
}

describe('applySeriesDataPointsToXml', () => {
	it('inserts dPt nodes before c:cat in schema order', () => {
		const node = seriesNode();
		applySeriesDataPointsToXml(
			node,
			[
				{ idx: 0, spPr: { fillColor: '#112233' } },
				{ idx: 2, explosion: 25 },
			],
			getLocalName,
		);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('dPt')).toBeLessThan(keys.indexOf('cat'));
		const dpts = node['c:dPt'] as XmlObject[];
		expect(Array.isArray(dpts)).toBeTruthy();
		expect(dpts).toHaveLength(2);
		const fill = (dpts[0]['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('112233');
		expect((dpts[1]['c:explosion'] as XmlObject)['@_val']).toBe('25');
		expect((dpts[1]['c:idx'] as XmlObject)['@_val']).toBe('2');
	});

	it('reuses an existing dPt by idx to preserve unmodeled children', () => {
		const node = seriesNode();
		node['c:dPt'] = {
			'c:idx': { '@_val': '1' },
			'c:bubble3D': { '@_val': '0' },
		};
		applySeriesDataPointsToXml(node, [{ idx: 1, spPr: { fillColor: '#abcdef' } }], getLocalName);
		const dpt = node['c:dPt'] as XmlObject;
		expect(dpt['c:bubble3D']).toBeDefined();
		const fill = (dpt['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('ABCDEF');
	});

	it('writes marker and bubble3D in CT_DPt schema order while preserving extensions', () => {
		const node = seriesNode();
		node['c:dPt'] = {
			'c:idx': { '@_val': '1' },
			'c:marker': {
				'c:symbol': { '@_val': 'none' },
				'c:extLst': { markerExtension: true },
			},
			'c:pictureOptions': { passthrough: true },
			'c:extLst': { pointExtension: true },
		};
		applySeriesDataPointsToXml(
			node,
			[
				{
					idx: 1,
					invertIfNegative: false,
					marker: { symbol: 'star', size: 12 },
					bubble3D: false,
					explosion: 9,
					spPr: { fillColor: '#123456' },
				},
			],
			getLocalName,
		);
		const dpt = node['c:dPt'] as XmlObject;
		expect(Object.keys(dpt).map(getLocalName)).toStrictEqual([
			'idx',
			'invertIfNegative',
			'marker',
			'bubble3D',
			'explosion',
			'spPr',
			'pictureOptions',
			'extLst',
		]);
		expect((dpt['c:bubble3D'] as XmlObject)['@_val']).toBe('0');
		expect((dpt['c:marker'] as XmlObject)['c:extLst']).toStrictEqual({ markerExtension: true });
		expect(dpt['c:pictureOptions']).toStrictEqual({ passthrough: true });
	});

	it('rejects invalid unsigned values and marker sizes', () => {
		for (const point of [
			{ idx: -1 },
			{ idx: 1.5 },
			{ idx: 0, explosion: -1 },
			{ idx: 0, explosion: 2.5 },
			{ idx: 0, marker: { symbol: 'circle' as const, size: 73 } },
		]) {
			expect(() => applySeriesDataPointsToXml(seriesNode(), [point], getLocalName)).toThrow(
				RangeError,
			);
		}
	});

	it('removes all dPt when given an empty array', () => {
		const node = seriesNode();
		node['c:dPt'] = { 'c:idx': { '@_val': '0' } };
		applySeriesDataPointsToXml(node, [], getLocalName);
		expect(node['c:dPt']).toBeUndefined();
	});

	it('treats undefined like empty (removes existing dPt)', () => {
		const node = seriesNode();
		node['c:dPt'] = { 'c:idx': { '@_val': '0' } };
		applySeriesDataPointsToXml(node, undefined, getLocalName);
		expect(node['c:dPt']).toBeUndefined();
	});
});
