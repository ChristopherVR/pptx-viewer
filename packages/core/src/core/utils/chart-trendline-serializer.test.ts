import { describe, it, expect } from 'vitest';

import type { PptxChartTrendline, XmlObject } from '../types';
import { applySeriesTrendlinesToXml } from './chart-trendline-serializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getLocalName = (key: string): string => {
	const colon = key.indexOf(':');
	return colon === -1 ? key : key.slice(colon + 1);
};

/** A bar series node with cat/val and no trendline. */
function seriesNode(): XmlObject {
	return {
		'c:idx': { '@_val': '0' },
		'c:order': { '@_val': '0' },
		'c:cat': {},
		'c:val': {},
	};
}

function trendlineOf(node: XmlObject): XmlObject {
	const tl = node['c:trendline'];
	return (Array.isArray(tl) ? tl[0] : tl) as XmlObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applySeriesTrendlinesToXml', () => {
	it('inserts a trendline before cat/val with the mapped type', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'exponential' }], getLocalName);
		expect(trendlineOf(node)['c:trendlineType']).toStrictEqual({ '@_val': 'exp' });
		const keys = Object.keys(node).map(getLocalName);
		expect(keys.indexOf('trendline')).toBeLessThan(keys.indexOf('cat'));
	});

	it('maps logarithmic and polynomial types and writes the order for polynomial', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'polynomial', order: 3 }], getLocalName);
		const tl = trendlineOf(node);
		expect(tl['c:trendlineType']).toStrictEqual({ '@_val': 'poly' });
		expect(tl['c:order']).toStrictEqual({ '@_val': '3' });
	});

	it('writes the period for a moving-average trendline', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'movingAvg', period: 4 }], getLocalName);
		expect(trendlineOf(node)['c:period']).toStrictEqual({ '@_val': '4' });
	});

	it('writes dispEq and dispRSqr when requested', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(
			node,
			[{ trendlineType: 'linear', displayEq: true, displayRSq: true }],
			getLocalName,
		);
		const tl = trendlineOf(node);
		expect(tl['c:dispEq']).toStrictEqual({ '@_val': '1' });
		expect(tl['c:dispRSqr']).toStrictEqual({ '@_val': '1' });
	});

	it('writes the line colour into spPr', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'linear', color: '#ff0000' }], getLocalName);
		const ln = (trendlineOf(node)['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect((ln['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({ '@_val': 'FF0000' });
	});

	it('removes all trendlines when given an empty array', () => {
		const node = seriesNode();
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'linear' }], getLocalName);
		applySeriesTrendlinesToXml(node, [], getLocalName);
		expect('c:trendline' in node).toBeFalsy();
	});

	it('preserves name and trendlineLbl on an existing trendline when updating', () => {
		const node = seriesNode();
		node['c:trendline'] = {
			'c:name': { '#text': 'My line' },
			'c:trendlineType': { '@_val': 'linear' },
			'c:trendlineLbl': { layout: true },
		};
		applySeriesTrendlinesToXml(
			node,
			[{ trendlineType: 'logarithmic', displayEq: true }],
			getLocalName,
		);
		const tl = trendlineOf(node);
		expect(tl['c:name']).toStrictEqual({ '#text': 'My line' });
		expect(tl['c:trendlineLbl']).toStrictEqual({ layout: true });
		expect(tl['c:trendlineType']).toStrictEqual({ '@_val': 'log' });
	});

	it('preserves existing line width while overriding the colour', () => {
		const node = seriesNode();
		node['c:trendline'] = {
			'c:spPr': {
				'a:ln': { '@_w': '19050', 'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } } },
			},
			'c:trendlineType': { '@_val': 'linear' },
		};
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'linear', color: '#00FF00' }], getLocalName);
		const ln = (trendlineOf(node)['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe('19050');
		expect((ln['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({ '@_val': '00FF00' });
	});

	it('supports two trendlines on one series as an array', () => {
		const node = seriesNode();
		const tls: PptxChartTrendline[] = [
			{ trendlineType: 'linear' },
			{ trendlineType: 'movingAvg', period: 2 },
		];
		applySeriesTrendlinesToXml(node, tls, getLocalName);
		expect(Array.isArray(node['c:trendline'])).toBeTruthy();
		expect(node['c:trendline'] as XmlObject[]).toHaveLength(2);
	});

	it('writes a typed label in schema order and preserves unmodeled label content', () => {
		const node = seriesNode();
		node['c:trendline'] = {
			'c:trendlineType': { '@_val': 'linear' },
			'c:trendlineLbl': {
				'c:tx': { 'c:v': 'y = mx + b' },
				'c:txPr': { marker: true },
				'c:extLst': { extension: true },
			},
			'c:extLst': { trendlineExtension: true },
		};
		applySeriesTrendlinesToXml(
			node,
			[
				{
					trendlineType: 'linear',
					name: 'Forecast',
					displayEq: false,
					label: {
						layout: { xMode: 'factor', x: 0.25 },
						numberFormatCode: '0.00',
						sourceLinked: false,
					},
				},
			],
			getLocalName,
		);
		const trendline = trendlineOf(node);
		expect(trendline['c:name']).toBe('Forecast');
		expect(trendline['c:dispEq']).toStrictEqual({ '@_val': '0' });
		expect(trendline['c:extLst']).toStrictEqual({ trendlineExtension: true });
		const label = trendline['c:trendlineLbl'] as XmlObject;
		expect(Object.keys(label).map(getLocalName)).toStrictEqual([
			'layout',
			'tx',
			'numFmt',
			'txPr',
			'extLst',
		]);
		expect(label['c:numFmt']).toStrictEqual({ '@_formatCode': '0.00', '@_sourceLinked': '0' });
		expect(label['c:txPr']).toStrictEqual({ marker: true });
	});

	it('removes an explicitly cleared trendline label', () => {
		const node = seriesNode();
		node['c:trendline'] = {
			'c:trendlineType': { '@_val': 'linear' },
			'c:trendlineLbl': { 'c:layout': {} },
		};
		applySeriesTrendlinesToXml(node, [{ trendlineType: 'linear', label: null }], getLocalName);
		expect(trendlineOf(node)['c:trendlineLbl']).toBeUndefined();
	});

	it('rejects values outside the schema facets', () => {
		expect(() =>
			applySeriesTrendlinesToXml(
				seriesNode(),
				[{ trendlineType: 'polynomial', order: 7 }],
				getLocalName,
			),
		).toThrow(RangeError);
		expect(() =>
			applySeriesTrendlinesToXml(
				seriesNode(),
				[{ trendlineType: 'movingAvg', period: 1 }],
				getLocalName,
			),
		).toThrow(RangeError);
	});
});
