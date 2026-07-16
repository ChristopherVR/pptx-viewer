import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyChartPivotSource, parseChartPivotSource } from './chart-pivot-source';
import { buildChartSpaceXml } from './chart-xml-generator';

const localName = (key: string): string => key.replace(/^.*:/u, '');

describe('classic ChartML pivot source', () => {
	it('parses required prefix-independent name and unsigned format ID', () => {
		const parsed = parseChartPivotSource(
			{
				'x:pivotSource': {
					'x:name': { '#text': '[book.xlsx]Sheet1!PivotTable1' },
					'x:fmtId': { '@_val': '4294967295' },
				},
			},
			localName,
		);
		expect(parsed).toMatchObject({
			name: '[book.xlsx]Sheet1!PivotTable1',
			formatId: 4_294_967_295,
		});
	});

	it('rejects incomplete or invalid required children without coercion', () => {
		expect(
			parseChartPivotSource({ 'c:pivotSource': { 'c:name': 'Pivot' } }, localName),
		).toBeUndefined();
		expect(
			parseChartPivotSource(
				{ 'c:pivotSource': { 'c:name': 'Pivot', 'c:fmtId': { '@_val': '12x' } } },
				localName,
			),
		).toBeUndefined();
	});

	it('round trips edits while preserving extensions and foreign markup', () => {
		const chartSpace: XmlObject = {
			'x:pivotSource': {
				'@_vendor': 'root',
				'x:fmtId': { '@_val': '7', '@_vendor': 'leaf' },
				'v:future': { '@_keep': 'yes' },
				'x:name': { '#text': 'Old', '@_xml:space': 'preserve' },
				'x:extLst': { 'x:ext': { '@_uri': 'urn:test', 'v:data': {} } },
			},
			'x:chart': {},
		};
		const parsed = parseChartPivotSource(chartSpace, localName)!;
		parsed.name = 'New Pivot';
		parsed.formatId = 9;
		applyChartPivotSource(chartSpace, parsed, localName);

		const pivot = chartSpace['x:pivotSource'] as XmlObject;
		expect(Object.keys(pivot).map(localName)).toStrictEqual([
			'@_vendor',
			'name',
			'fmtId',
			'extLst',
			'future',
		]);
		expect(pivot['x:fmtId']).toStrictEqual({ '@_val': '9', '@_vendor': 'leaf' });
		expect(pivot['x:name']).toStrictEqual({
			'#text': 'New Pivot',
			'@_xml:space': 'preserve',
		});
		expect(pivot['x:extLst']).toStrictEqual({
			'x:ext': { '@_uri': 'urn:test', 'v:data': {} },
		});
		expect(pivot['v:future']).toStrictEqual({ '@_keep': 'yes' });
		expect(parseChartPivotSource(chartSpace, localName)).toMatchObject({
			name: 'New Pivot',
			formatId: 9,
		});
	});

	it('inserts before protection and chart and supports explicit removal', () => {
		const chartSpace: XmlObject = { 'c:protection': {}, 'c:chart': {} };
		applyChartPivotSource(chartSpace, { name: 'Pivot', formatId: 0 }, localName);
		expect(Object.keys(chartSpace).map(localName)).toStrictEqual([
			'pivotSource',
			'protection',
			'chart',
		]);
		expect(chartSpace['c:pivotSource']).toStrictEqual({
			'c:name': { '#text': 'Pivot' },
			'c:fmtId': { '@_val': '0' },
		});
		applyChartPivotSource(chartSpace, null, localName);
		expect(Object.keys(chartSpace).map(localName)).toStrictEqual(['protection', 'chart']);
	});

	it('validates required values on serialization', () => {
		expect(() => applyChartPivotSource({}, { name: 'Pivot', formatId: -1 }, localName)).toThrow(
			RangeError,
		);
		expect(() =>
			applyChartPivotSource({}, { name: 'Pivot', formatId: 4_294_967_296 }, localName),
		).toThrow(RangeError);
	});

	it('serializes pivot metadata for a newly generated chart part', () => {
		const tree = buildChartSpaceXml({
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
			pivotSource: { name: 'Pivot', formatId: 3 },
		});
		const chartSpace = tree['c:chartSpace'] as XmlObject;
		expect(Object.keys(chartSpace).map(localName).slice(-2)).toStrictEqual([
			'pivotSource',
			'chart',
		]);
		expect(parseChartPivotSource(chartSpace, localName)).toMatchObject({
			name: 'Pivot',
			formatId: 3,
		});
	});
});
