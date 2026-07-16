import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartPivotFormats, parseChartPivotFormats } from './chart-pivot-formats';

const localName = (key: string): string => key.replace(/^.*:/u, '');

describe('classic ChartML pivot formats', () => {
	it('parses, edits, serializes, and reparses typed pivot formats', () => {
		const chart: XmlObject = {
			'x:pivotFmts': {
				'@_vendor': 'root',
				'x:pivotFmt': {
					'x:marker': { 'x:symbol': { '@_val': 'circle' } },
					'x:idx': { '@_val': '4', '@_vendor': 'idx' },
					'a:spPr': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000' } } },
					'x:dLbl': { 'x:idx': { '@_val': '2' } },
					'x:extLst': { 'x:ext': { '@_uri': 'urn:test', 'v:data': {} } },
					'v:future': { '@_keep': 'yes' },
				},
			},
			'x:plotArea': {},
		};
		const parsed = parseChartPivotFormats(chart, localName)!;
		expect(parsed.formats[0]).toMatchObject({ index: 4 });
		parsed.formats[0].index = 7;
		parsed.formats[0].markerXml = { 'x:symbol': { '@_val': 'diamond' } };
		parsed.formats[0].dataLabelXml = null;
		applyChartPivotFormats(chart, parsed, localName);

		const root = chart['x:pivotFmts'] as XmlObject;
		const item = root['x:pivotFmt'] as XmlObject[];
		expect(Object.keys(item[0]).map(localName)).toStrictEqual([
			'idx',
			'spPr',
			'marker',
			'extLst',
			'future',
		]);
		expect(item[0]['x:idx']).toStrictEqual({ '@_val': '7', '@_vendor': 'idx' });
		expect(item[0]['x:extLst']).toStrictEqual({
			'x:ext': { '@_uri': 'urn:test', 'v:data': {} },
		});
		expect(item[0]['v:future']).toStrictEqual({ '@_keep': 'yes' });
		expect(parseChartPivotFormats(chart, localName)!.formats[0]).toMatchObject({ index: 7 });
	});

	it('inserts in chart schema order and supports removal', () => {
		const chart: XmlObject = { 'c:autoTitleDeleted': {}, 'c:view3D': {}, 'c:plotArea': {} };
		applyChartPivotFormats(chart, { formats: [{ index: 0 }] }, localName);
		expect(Object.keys(chart).map(localName)).toStrictEqual([
			'autoTitleDeleted',
			'pivotFmts',
			'view3D',
			'plotArea',
		]);
		applyChartPivotFormats(chart, null, localName);
		expect(Object.keys(chart).map(localName)).toStrictEqual([
			'autoTitleDeleted',
			'view3D',
			'plotArea',
		]);
	});

	it('rejects invalid indexes and empty collections', () => {
		expect(() => applyChartPivotFormats({}, { formats: [] }, localName)).toThrow(RangeError);
		expect(() => applyChartPivotFormats({}, { formats: [{ index: -1 }] }, localName)).toThrow(
			RangeError,
		);
		expect(() =>
			applyChartPivotFormats({}, { formats: [{ index: 4_294_967_296 }] }, localName),
		).toThrow(RangeError);
	});
});
