import { describe, expect, it } from 'vitest';

import { PptxXmlLookupService } from '../services/PptxXmlLookupService';
import type { XmlObject } from '../types';
import { applyChartBandFmts, parseChartBandFmts } from './chart-band-fmts';

const lookup = new PptxXmlLookupService();
const localName = (key: string) => key.replace(/^.*:/u, '');
const colorParser = {
	parseColor(node: XmlObject | undefined): string | undefined {
		const srgb = lookup.getChildByLocalName(node, 'srgbClr');
		return srgb?.['@_val'] ? `#${srgb['@_val']}` : undefined;
	},
};

describe('parseChartBandFmts', () => {
	it('returns undefined when the container has no c:bandFmts', () => {
		expect(parseChartBandFmts({}, lookup, colorParser)).toBeUndefined();
	});

	it('parses idx + spPr for each band, skipping bands without a usable idx', () => {
		const container: XmlObject = {
			'c:bandFmts': {
				'c:bandFmt': [
					{
						'c:idx': { '@_val': '0' },
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '3366CC' } } },
					},
					{ 'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } } },
					{ 'c:idx': { '@_val': '2' } },
				],
			},
		};
		expect(parseChartBandFmts(container, lookup, colorParser)).toStrictEqual([
			{ index: 0, spPr: { fillColor: '#3366CC' } },
			{ index: 2 },
		]);
	});

	it('handles a single bandFmt (not wrapped in an array)', () => {
		const container: XmlObject = {
			'c:bandFmts': {
				'c:bandFmt': {
					'c:idx': { '@_val': '1' },
					'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': '00AA00' } } },
				},
			},
		};
		expect(parseChartBandFmts(container, lookup, colorParser)).toStrictEqual([
			{ index: 1, spPr: { fillColor: '#00AA00' } },
		]);
	});
});

describe('applyChartBandFmts', () => {
	it('does not change source XML for an undefined model value', () => {
		const container: XmlObject = { 'c:bandFmts': { 'c:bandFmt': { 'c:idx': { '@_val': '0' } } } };
		const before = structuredClone(container);
		applyChartBandFmts(container, undefined, localName);
		expect(container).toStrictEqual(before);
	});

	it('removes c:bandFmts when set to an empty array', () => {
		const container: XmlObject = { 'c:bandFmts': { 'c:bandFmt': { 'c:idx': { '@_val': '0' } } } };
		applyChartBandFmts(container, [], localName);
		expect(container['c:bandFmts']).toBeUndefined();
	});

	it('creates c:bandFmts with one c:bandFmt per band on a fresh container', () => {
		const container: XmlObject = {};
		applyChartBandFmts(
			container,
			[
				{ index: 0, spPr: { fillColor: '#112233' } },
				{ index: 1, spPr: { fillColor: '#445566' } },
			],
			localName,
		);
		const bandFmts = container['c:bandFmts'] as XmlObject;
		const bands = bandFmts['c:bandFmt'] as XmlObject[];
		expect(bands).toHaveLength(2);
		expect((bands[0]['c:idx'] as XmlObject)['@_val']).toBe('0');
		expect(
			((bands[0]['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject)['a:srgbClr'],
		).toStrictEqual({ '@_val': '112233' });
	});

	it('updates an existing band by idx without disturbing an unrelated band', () => {
		const container: XmlObject = {
			'c:bandFmts': {
				'c:bandFmt': [
					{
						'c:idx': { '@_val': '0' },
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'AAAAAA' } } },
					},
					{
						'c:idx': { '@_val': '1' },
						'c:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'BBBBBB' } } },
					},
				],
			},
		};
		applyChartBandFmts(container, [{ index: 1, spPr: { fillColor: '#00FF00' } }], localName);
		const bands = (container['c:bandFmts'] as XmlObject)['c:bandFmt'] as XmlObject[];
		expect(bands).toHaveLength(2);
		expect(
			((bands[0]['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject)['a:srgbClr'],
		).toStrictEqual({ '@_val': 'AAAAAA' });
		expect(
			((bands[1]['c:spPr'] as XmlObject)['a:solidFill'] as XmlObject)['a:srgbClr'],
		).toStrictEqual({ '@_val': '00FF00' });
	});

	it('round-trips through parseChartBandFmts', () => {
		const container: XmlObject = {};
		const model = [
			{ index: 0, spPr: { fillColor: '#112233' } },
			{ index: 3, spPr: { fillColor: '#445566', strokeColor: '#000000', strokeWidth: 1 } },
		];
		applyChartBandFmts(container, model, localName);
		expect(parseChartBandFmts(container, lookup, colorParser)).toStrictEqual(model);
	});
});
