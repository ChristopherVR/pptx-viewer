import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	applyChartAxisLabelFormatting,
	parseChartAxisLabelFormatting,
} from './chart-axis-label-formatting';

const localName = (key: string) => key.replace(/^.*:/u, '');

describe('chart axis label formatting', () => {
	it('writes axis position in schema order and validates its token', () => {
		const node: XmlObject = {
			'c:axId': { '@_val': '1' },
			'c:scaling': {},
			'c:crossAx': { '@_val': '2' },
		};
		applyChartAxisLabelFormatting(node, { axisType: 'valAx', axPos: 'r' }, localName);
		expect(Object.keys(node)).toStrictEqual(['c:axId', 'c:scaling', 'c:axPos', 'c:crossAx']);
		expect(node['c:axPos']).toStrictEqual({ '@_val': 'r' });
		expect(() =>
			applyChartAxisLabelFormatting({}, { axisType: 'valAx', axPos: 'bad' as never }, localName),
		).toThrow(RangeError);
	});
	it('parses tick marks and category label controls with arbitrary prefixes', () => {
		const node: XmlObject = {
			'x:majorTickMark': { '@_val': 'out' },
			'x:minorTickMark': { '@_val': 'in' },
			'x:tickLblPos': { '@_val': 'low' },
			'x:auto': { '@_val': '0' },
			'x:lblAlgn': { '@_val': 'r' },
			'x:lblOffset': { '@_val': '125' },
			'x:noMultiLvlLbl': { '@_val': 'true' },
		};

		expect(parseChartAxisLabelFormatting(node, 'catAx', localName)).toStrictEqual({
			majorTickMark: 'out',
			minorTickMark: 'in',
			tickLblPos: 'low',
			auto: false,
			labelAlignment: 'r',
			labelOffset: 125,
			noMultiLevelLabels: true,
		});
	});

	it('rejects invalid enums, booleans, and offsets', () => {
		const node: XmlObject = {
			'c:majorTickMark': { '@_val': 'sideways' },
			'c:auto': { '@_val': 'maybe' },
			'c:lblAlgn': { '@_val': 'justify' },
			'c:lblOffset': { '@_val': '1001%' },
		};
		expect(parseChartAxisLabelFormatting(node, 'catAx', localName)).toStrictEqual({});
	});

	it('writes Strict-compatible offsets in schema order and preserves unknown XML', () => {
		const node: XmlObject = {
			'c:axId': { '@_val': '1' },
			'c:spPr': { 'a:noFill': {} },
			'c:txPr': { 'a:bodyPr': {} },
			'c:crossAx': { '@_val': '2' },
			'c:extLst': { 'c:ext': { '@_uri': 'keep' } },
		};
		applyChartAxisLabelFormatting(
			node,
			{
				axisType: 'catAx',
				majorTickMark: 'cross',
				minorTickMark: 'none',
				tickLblPos: 'nextTo',
				auto: true,
				labelAlignment: 'ctr',
				labelOffset: 140,
				noMultiLevelLabels: false,
			},
			localName,
		);

		expect(node['c:lblOffset']).toStrictEqual({ '@_val': '140%' });
		expect(node['c:spPr']).toStrictEqual({ 'a:noFill': {} });
		expect(node['c:txPr']).toStrictEqual({ 'a:bodyPr': {} });
		expect(node['c:extLst']).toStrictEqual({ 'c:ext': { '@_uri': 'keep' } });
		const names = Object.keys(node).map(localName);
		expect(names.indexOf('minorTickMark')).toBeLessThan(names.indexOf('spPr'));
		expect(names.indexOf('lblOffset')).toBeGreaterThan(names.indexOf('crossAx'));
		expect(names.indexOf('noMultiLvlLbl')).toBeLessThan(names.indexOf('extLst'));
	});

	it('limits category-only controls and validates emitted offset range', () => {
		const valueAxis: XmlObject = {};
		applyChartAxisLabelFormatting(
			valueAxis,
			{
				axisType: 'valAx',
				majorTickMark: 'out',
				auto: true,
				labelAlignment: 'l',
				labelOffset: 100,
				noMultiLevelLabels: true,
			},
			localName,
		);
		expect(valueAxis).toStrictEqual({ 'c:majorTickMark': { '@_val': 'out' } });
		expect(() =>
			applyChartAxisLabelFormatting({}, { axisType: 'dateAx', labelOffset: -1 }, localName),
		).toThrow(RangeError);
	});
});
