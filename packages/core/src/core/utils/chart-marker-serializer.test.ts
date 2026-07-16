import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { applySeriesMarkerToXml } from './chart-marker-serializer';

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

describe('applySeriesMarkerToXml', () => {
	it('inserts a marker before c:cat in schema order', () => {
		const node = seriesNode();
		applySeriesMarkerToXml(node, { symbol: 'circle', size: 7 }, getLocalName);
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('marker')).toBeGreaterThan(keys.indexOf('tx'));
		expect(keys.indexOf('marker')).toBeLessThan(keys.indexOf('cat'));
		const marker = node['c:marker'] as XmlObject;
		expect((marker['c:symbol'] as XmlObject)['@_val']).toBe('circle');
		expect((marker['c:size'] as XmlObject)['@_val']).toBe('7');
	});

	it('writes the marker fill colour into spPr', () => {
		const node = seriesNode();
		applySeriesMarkerToXml(
			node,
			{ symbol: 'square', spPr: { fillColor: '#FF0000' } },
			getLocalName,
		);
		const marker = node['c:marker'] as XmlObject;
		const spPr = marker['c:spPr'] as XmlObject;
		const fill = spPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('updates an existing marker in place', () => {
		const node = seriesNode();
		node['c:marker'] = {
			'c:symbol': { '@_val': 'none' },
			'c:extLst': { extension: true },
		};
		applySeriesMarkerToXml(node, { symbol: 'diamond', size: 5 }, getLocalName);
		const marker = node['c:marker'] as XmlObject;
		expect((marker['c:symbol'] as XmlObject)['@_val']).toBe('diamond');
		expect(marker['c:extLst']).toStrictEqual({ extension: true });
		expect(Object.keys(marker).map(getLocalName)).toStrictEqual(['symbol', 'size', 'extLst']);
	});

	it('rejects marker sizes outside the ST_MarkerSize range', () => {
		for (const size of [1, 73, 2.5]) {
			expect(() =>
				applySeriesMarkerToXml(seriesNode(), { symbol: 'circle', size }, getLocalName),
			).toThrow(RangeError);
		}
	});

	it('removes the marker on null', () => {
		const node = seriesNode();
		node['c:marker'] = { 'c:symbol': { '@_val': 'circle' } };
		applySeriesMarkerToXml(node, null, getLocalName);
		expect(node['c:marker']).toBeUndefined();
	});
});
