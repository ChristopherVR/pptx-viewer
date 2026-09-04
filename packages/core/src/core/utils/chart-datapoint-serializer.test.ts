import { describe, it, expect } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import {
	applySeriesDataPointsToXml,
	parseChartDataPointPicture,
} from './chart-datapoint-serializer';

const lookup = new PptxXmlLookupService();

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

// C2-G9 (parse half): c:dPt/c:pictureOptions is a known, intentionally
// unmodeled preserve-only child of the serializer above; this pure helper
// parses it (not yet wired into the real c:dPt parser - see its doc comment).
describe('parseChartDataPointPicture', () => {
	it('returns undefined when there is no c:pictureOptions', () => {
		expect(parseChartDataPointPicture({ 'c:idx': { '@_val': '0' } }, lookup)).toBeUndefined();
	});

	it('parses apply* flags, pictureFormat, and pictureStackUnit', () => {
		const dPt: XmlObject = {
			'c:idx': { '@_val': '0' },
			'c:pictureOptions': {
				'c:applyToFront': { '@_val': '1' },
				'c:applyToSides': { '@_val': '0' },
				'c:pictureFormat': { '@_val': 'stack' },
				'c:pictureStackUnit': { '@_val': '36' },
			},
		};
		expect(parseChartDataPointPicture(dPt, lookup)).toStrictEqual({
			applyToFront: true,
			applyToSides: false,
			pictureFormat: 'stack',
			pictureStackUnit: 36,
		});
	});

	it('treats a present CT_Boolean element with no @val as true', () => {
		const dPt: XmlObject = {
			'c:pictureOptions': { 'c:applyToEnd': {} },
		};
		expect(parseChartDataPointPicture(dPt, lookup)?.applyToEnd).toBeTruthy();
	});

	it('ignores an invalid pictureFormat value', () => {
		const dPt: XmlObject = {
			'c:pictureOptions': { 'c:pictureFormat': { '@_val': 'sideways' } },
		};
		expect(parseChartDataPointPicture(dPt, lookup)).toBeUndefined();
	});
});
