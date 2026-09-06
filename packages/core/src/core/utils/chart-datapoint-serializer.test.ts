import { describe, it, expect } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import {
	applySeriesDataPointsToXml,
	applySeriesPictureOptionsToXml,
	parseChartDataPointPicture,
	parseChartDataPointPictureBlipRel,
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

	it('writes stroke width and dash style into c:dPt/c:spPr (not just fill colour)', () => {
		const node = seriesNode();
		applySeriesDataPointsToXml(
			node,
			[{ idx: 0, spPr: { strokeColor: '#ABCDEF', strokeWidth: 1.5, strokeDashStyle: 'sysDot' } }],
			getLocalName,
		);
		const dpt = node['c:dPt'] as XmlObject;
		const ln = (dpt['c:spPr'] as XmlObject)['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(1.5 * 12700)));
		expect((ln['a:prstDash'] as XmlObject)['@_val']).toBe('sysDot');
		const fill = ln['a:solidFill'] as XmlObject;
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

	// C2-G9 (save half): an independent write path for c:dPt/c:pictureOptions,
	// distinct from the raw-XML passthrough an untouched point still uses (see
	// the preceding test).
	it('rebuilds c:pictureOptions from the typed model once dp.picture is set', () => {
		const node = seriesNode();
		node['c:dPt'] = {
			'c:idx': { '@_val': '0' },
			'c:pictureOptions': { 'c:pictureFormat': { '@_val': 'stretch' } },
		};
		applySeriesDataPointsToXml(
			node,
			[{ idx: 0, picture: { pictureFormat: 'stack', pictureStackUnit: 36, applyToFront: true } }],
			getLocalName,
		);
		const dpt = node['c:dPt'] as XmlObject;
		expect(dpt['c:pictureOptions']).toStrictEqual({
			'c:applyToFront': { '@_val': '1' },
			'c:pictureFormat': { '@_val': 'stack' },
			'c:pictureStackUnit': { '@_val': '36' },
		});
	});

	it('removes c:pictureOptions when dp.picture is an empty object', () => {
		const node = seriesNode();
		node['c:dPt'] = {
			'c:idx': { '@_val': '0' },
			'c:pictureOptions': { 'c:pictureFormat': { '@_val': 'stretch' } },
		};
		applySeriesDataPointsToXml(node, [{ idx: 0, picture: {} }], getLocalName);
		const dpt = node['c:dPt'] as XmlObject;
		expect(dpt['c:pictureOptions']).toBeUndefined();
	});

	it('leaves c:pictureOptions absent for a freshly-created point with no picture', () => {
		const node = seriesNode();
		applySeriesDataPointsToXml(node, [{ idx: 0, explosion: 5 }], getLocalName);
		const dpt = node['c:dPt'] as XmlObject;
		expect(dpt['c:pictureOptions']).toBeUndefined();
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

// Series-level c:ser/c:pictureOptions (CT_BarSer): applies to every point
// unless a c:dPt overrides it.
describe('applySeriesPictureOptionsToXml', () => {
	it('inserts c:pictureOptions before c:dPt when both are modeled', () => {
		const node = seriesNode();
		node['c:dPt'] = { 'c:idx': { '@_val': '0' } };
		applySeriesPictureOptionsToXml(
			node,
			{ applyToFront: true, applyToSides: true, applyToEnd: true },
			getLocalName,
		);
		const keys = Object.keys(node);
		expect(keys.indexOf('c:pictureOptions')).toBeLessThan(keys.indexOf('c:dPt'));
		expect(node['c:pictureOptions']).toStrictEqual({
			'c:applyToFront': { '@_val': '1' },
			'c:applyToSides': { '@_val': '1' },
			'c:applyToEnd': { '@_val': '1' },
		});
	});

	it('inserts before c:cat when there is no c:dPt', () => {
		const node = seriesNode();
		applySeriesPictureOptionsToXml(node, { pictureFormat: 'stack' }, getLocalName);
		const keys = Object.keys(node);
		expect(keys.indexOf('c:pictureOptions')).toBeLessThan(keys.indexOf('c:cat'));
	});

	it('updates an existing c:pictureOptions in place', () => {
		const node = seriesNode();
		node['c:pictureOptions'] = { 'c:applyToFront': { '@_val': '1' } };
		applySeriesPictureOptionsToXml(node, { applyToFront: false }, getLocalName);
		expect(node['c:pictureOptions']).toStrictEqual({ 'c:applyToFront': { '@_val': '0' } });
	});

	it('removes c:pictureOptions when every flag is unset', () => {
		const node = seriesNode();
		node['c:pictureOptions'] = { 'c:applyToFront': { '@_val': '1' } };
		applySeriesPictureOptionsToXml(node, {}, getLocalName);
		expect(node['c:pictureOptions']).toBeUndefined();
	});
});

// C2-G9 (parse half): c:dPt/c:pictureOptions per-point picture-fill flags.
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

// C2-G9 (render half): the r:embed/r:link relationship id the runtime
// resolves into PptxChartDataPointPicture.imageUrl in a follow-up pass.
describe('parseChartDataPointPictureBlipRel', () => {
	it('returns undefined when the point has no picture fill', () => {
		expect(
			parseChartDataPointPictureBlipRel({ 'c:idx': { '@_val': '0' } }, lookup),
		).toBeUndefined();
	});

	it('extracts r:embed from c:spPr/a:blipFill/a:blip', () => {
		const dPt: XmlObject = {
			'c:spPr': { 'a:blipFill': { 'a:blip': { '@_r:embed': 'rId5' } } },
		};
		expect(parseChartDataPointPictureBlipRel(dPt, lookup)).toBe('rId5');
	});

	it('falls back to r:link for a linked (not embedded) picture', () => {
		const dPt: XmlObject = {
			'c:spPr': { 'a:blipFill': { 'a:blip': { '@_r:link': 'rId9' } } },
		};
		expect(parseChartDataPointPictureBlipRel(dPt, lookup)).toBe('rId9');
	});
});
