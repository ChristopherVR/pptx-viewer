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
			'x:tickLblSkip': { '@_val': '2' },
			'x:tickMarkSkip': { '@_val': '3' },
			'x:noMultiLvlLbl': { '@_val': 'true' },
		};

		expect(parseChartAxisLabelFormatting(node, 'catAx', localName)).toStrictEqual({
			majorTickMark: 'out',
			minorTickMark: 'in',
			tickLblPos: 'low',
			auto: false,
			labelAlignment: 'r',
			labelOffset: 125,
			tickLabelSkip: 2,
			tickMarkSkip: 3,
			noMultiLevelLabels: true,
		});
	});

	it('parses crossing modes, explicit values, and value-axis category placement', () => {
		const node: XmlObject = {
			'x:crossesAt': { '@_val': '12.5' },
			'x:crossBetween': { '@_val': 'midCat' },
		};
		expect(parseChartAxisLabelFormatting(node, 'valAx', localName)).toStrictEqual({
			crossesAt: 12.5,
			crossBetween: 'midCat',
		});
		expect(
			parseChartAxisLabelFormatting({ 'x:crosses': { '@_val': 'max' } }, 'dateAx', localName),
		).toStrictEqual({ crosses: 'max' });
	});

	it('rejects invalid enums, booleans, and offsets', () => {
		const node: XmlObject = {
			'c:majorTickMark': { '@_val': 'sideways' },
			'c:auto': { '@_val': 'maybe' },
			'c:lblAlgn': { '@_val': 'justify' },
			'c:lblOffset': { '@_val': '1001%' },
			'c:tickLblSkip': { '@_val': '0' },
			'c:tickMarkSkip': { '@_val': 'not-a-number' },
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
				tickLabelSkip: 2,
				tickMarkSkip: 3,
				noMultiLevelLabels: false,
			},
			localName,
		);

		expect(node['c:lblOffset']).toStrictEqual({ '@_val': '140%' });
		expect(node['c:tickLblSkip']).toStrictEqual({ '@_val': '2' });
		expect(node['c:tickMarkSkip']).toStrictEqual({ '@_val': '3' });
		expect(node['c:spPr']).toStrictEqual({ 'a:noFill': {} });
		expect(node['c:txPr']).toStrictEqual({ 'a:bodyPr': {} });
		expect(node['c:extLst']).toStrictEqual({ 'c:ext': { '@_uri': 'keep' } });
		const names = Object.keys(node).map(localName);
		expect(names.indexOf('minorTickMark')).toBeLessThan(names.indexOf('spPr'));
		expect(names.indexOf('lblOffset')).toBeGreaterThan(names.indexOf('crossAx'));
		expect(names.indexOf('noMultiLvlLbl')).toBeLessThan(names.indexOf('extLst'));
	});

	it('writes mutually exclusive crossing controls in schema order', () => {
		const node: XmlObject = {
			'c:crossAx': { '@_val': '2' },
			'c:crosses': { '@_val': 'autoZero' },
			'c:extLst': { 'c:ext': { '@_uri': 'keep' } },
		};
		applyChartAxisLabelFormatting(
			node,
			{ axisType: 'valAx', crossesAt: 7.5, crossBetween: 'between' },
			localName,
		);
		expect(node['c:crosses']).toBeUndefined();
		expect(node['c:crossesAt']).toStrictEqual({ '@_val': '7.5' });
		expect(node['c:crossBetween']).toStrictEqual({ '@_val': 'between' });
		expect(node['c:extLst']).toStrictEqual({ 'c:ext': { '@_uri': 'keep' } });
		const names = Object.keys(node).map(localName);
		expect(names.indexOf('crossesAt')).toBeLessThan(names.indexOf('crossBetween'));
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
		expect(() =>
			applyChartAxisLabelFormatting({}, { axisType: 'catAx', tickLabelSkip: 0 }, localName),
		).toThrow(RangeError);
	});
});
