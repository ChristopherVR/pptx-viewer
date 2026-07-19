import { describe, it, expect } from 'vitest';

import type { PptxChartData, XmlObject } from '../types';
import { buildChartSpaceXml } from './chart-xml-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(overrides?: Partial<PptxChartData>): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['Q1', 'Q2', 'Q3'],
		series: [{ name: 'Revenue', values: [100, 200, 300] }],
		...overrides,
	};
}

function chartRoot(tree: XmlObject): XmlObject {
	return (tree['c:chartSpace'] as XmlObject)['c:chart'] as XmlObject;
}
function plotArea(tree: XmlObject): XmlObject {
	return chartRoot(tree)['c:plotArea'] as XmlObject;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildChartSpaceXml', () => {
	it('generates chart-level and per-point data labels in schema order', () => {
		const tree = buildChartSpaceXml(
			makeData({
				style: {
					hasDataLabels: true,
					dataLabels: { showValue: true, separator: ' / ', showLeaderLines: true },
				},
				series: [
					{
						name: 'Revenue',
						values: [100, 200, 300],
						dataLabels: [{ idx: 1, showVal: true, position: 'outEnd' }],
					},
				],
			}),
		);
		const container = plotArea(tree)['c:barChart'] as XmlObject;
		const series = (container['c:ser'] as XmlObject[])[0];
		const seriesLabels = series['c:dLbls'] as XmlObject;
		const point = seriesLabels['c:dLbl'] as XmlObject;
		expect((point['c:idx'] as XmlObject)['@_val']).toBe('1');
		expect((point['c:dLblPos'] as XmlObject)['@_val']).toBe('outEnd');
		const group = container['c:dLbls'] as XmlObject;
		expect(group['c:separator']).toBe(' / ');
		expect(group['c:showLeaderLines']).toStrictEqual({ '@_val': '1' });
		const containerKeys = Object.keys(container);
		expect(containerKeys.indexOf('c:dLbls')).toBeGreaterThan(containerKeys.indexOf('c:ser'));
		expect(containerKeys.indexOf('c:dLbls')).toBeLessThan(containerKeys.indexOf('c:axId'));
	});

	it('declares the chart/main/relationship namespaces on chartSpace', () => {
		const cs = buildChartSpaceXml(makeData())['c:chartSpace'] as XmlObject;
		expect(cs['@_xmlns:c']).toContain('drawingml/2006/chart');
		expect(cs['@_xmlns:r']).toContain('relationships');
	});

	it('builds a bar chart with category and value axes', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'bar' })));
		expect(pa['c:barChart']).toBeDefined();
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('generates typed display units and label formatting on the value axis', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({
					axes: [
						{
							axisType: 'valAx',
							displayUnits: 'millions',
							displayUnitsLabel: { text: 'M', layout: { x: 0.15 } },
						},
					],
				}),
			),
		);
		const units = (pa['c:valAx'] as XmlObject)['c:dispUnits'] as XmlObject;
		expect(units['c:builtInUnit']).toStrictEqual({ '@_val': 'millions' });
		const label = units['c:dispUnitsLbl'] as XmlObject;
		expect(
			(((label['c:layout'] as XmlObject)['c:manualLayout'] as XmlObject)['c:x'] as XmlObject)[
				'@_val'
			],
		).toBe('0.15');
	});

	it('generates typed tick marks and category-axis label controls in schema order', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({
					axes: [
						{
							axisType: 'catAx',
							majorTickMark: 'out',
							minorTickMark: 'in',
							tickLblPos: 'low',
							auto: false,
							labelAlignment: 'r',
							labelOffset: 175,
							noMultiLevelLabels: true,
						},
					],
				}),
			),
		);
		const axis = pa['c:catAx'] as XmlObject;
		expect(axis['c:majorTickMark']).toStrictEqual({ '@_val': 'out' });
		expect(axis['c:lblOffset']).toStrictEqual({ '@_val': '175%' });
		expect(axis['c:noMultiLvlLbl']).toStrictEqual({ '@_val': '1' });
		const names = Object.keys(axis).map((key) => key.replace(/^.*:/u, ''));
		expect(names.indexOf('majorTickMark')).toBeLessThan(names.indexOf('crossAx'));
		expect(names.indexOf('auto')).toBeGreaterThan(names.indexOf('crossAx'));
	});

	it('generates a typed data table after axes in CT_PlotArea schema order', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({
					dataTable: {
						showHorzBorder: true,
						showVertBorder: false,
						showOutline: true,
						showKeys: true,
					},
				}),
			),
		);
		const table = pa['c:dTable'] as XmlObject;
		expect(table['c:showVertBorder']).toStrictEqual({ '@_val': '0' });
		const names = Object.keys(pa).map((key) => key.replace(/^.*:/u, ''));
		expect(names.indexOf('dTable')).toBeGreaterThan(names.indexOf('valAx'));
	});

	it('writes series values as numLit and categories as strLit', () => {
		const pa = plotArea(buildChartSpaceXml(makeData()));
		const ser = (pa['c:barChart'] as XmlObject)['c:ser'] as XmlObject[];
		const val = (ser[0]['c:val'] as XmlObject)['c:numLit'] as XmlObject;
		expect(val['c:ptCount']).toStrictEqual({ '@_val': '3' });
		expect((val['c:pt'] as XmlObject[])[0]).toStrictEqual({ '@_idx': '0', 'c:v': '100' });
		const cat = (ser[0]['c:cat'] as XmlObject)['c:strLit'] as XmlObject;
		expect((cat['c:pt'] as XmlObject[])[0]).toStrictEqual({ '@_idx': '0', 'c:v': 'Q1' });
	});

	it('puts the series name in c:tx > c:v', () => {
		const pa = plotArea(buildChartSpaceXml(makeData()));
		const ser = (pa['c:barChart'] as XmlObject)['c:ser'] as XmlObject[];
		expect((ser[0]['c:tx'] as XmlObject)['c:v']).toBe('Revenue');
	});

	it('builds a pie chart with no axes', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'pie' })));
		expect(pa['c:pieChart']).toBeDefined();
		expect(pa['c:catAx']).toBeUndefined();
		expect(pa['c:valAx']).toBeUndefined();
	});

	it('builds a doughnut chart with a hole size', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'doughnut' })));
		expect((pa['c:doughnutChart'] as XmlObject)['c:holeSize']).toBeDefined();
	});

	it('builds a scatter chart with two value axes and xVal/yVal series', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'scatter' })));
		expect(Array.isArray(pa['c:valAx'])).toBeTruthy();
		expect(pa['c:valAx'] as XmlObject[]).toHaveLength(2);
		const ser = (pa['c:scatterChart'] as XmlObject)['c:ser'] as XmlObject[];
		expect(ser[0]['c:xVal']).toBeDefined();
		expect(ser[0]['c:yVal']).toBeDefined();
	});

	it('falls back to a bar chart for unknown/unsupported types', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'treemap' })));
		expect(pa['c:barChart']).toBeDefined();
	});

	it('emits a stockChart container with hi/low lines and axes for a stock chart', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'stock' })));
		const container = pa['c:stockChart'] as XmlObject;
		expect(container).toBeDefined();
		expect(container['c:hiLowLines']).toBeDefined();
		expect(container['c:grouping']).toBeUndefined();
		expect(container['c:varyColors']).toBeUndefined();
		expect(container['c:axId']).toHaveLength(2);
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('emits a surfaceChart container with axes for a surface chart', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'surface' })));
		const container = pa['c:surfaceChart'] as XmlObject;
		expect(container).toBeDefined();
		expect(container['c:axId']).toHaveLength(2);
		expect(pa['c:catAx']).toBeDefined();
		expect(pa['c:valAx']).toBeDefined();
	});

	it('emits an ofPieChart container with an ofPieType and no axes', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'ofPie' })));
		const container = pa['c:ofPieChart'] as XmlObject;
		expect(container).toBeDefined();
		expect(container['c:ofPieType']).toStrictEqual({ '@_val': 'pie' });
		expect(pa['c:catAx']).toBeUndefined();
		expect(pa['c:valAx']).toBeUndefined();
	});

	it('keeps 3-D variants in their own 3-D container instead of collapsing to 2-D', () => {
		expect(
			plotArea(buildChartSpaceXml(makeData({ chartType: 'bar3D' })))['c:bar3DChart'],
		).toBeDefined();
		expect(
			plotArea(buildChartSpaceXml(makeData({ chartType: 'pie3D' })))['c:pie3DChart'],
		).toBeDefined();
		expect(
			plotArea(buildChartSpaceXml(makeData({ chartType: 'line3D' })))['c:line3DChart'],
		).toBeDefined();
		expect(
			plotArea(buildChartSpaceXml(makeData({ chartType: 'area3D' })))['c:area3DChart'],
		).toBeDefined();
	});

	it('gives a pie3D chart no cartesian axes', () => {
		const pa = plotArea(buildChartSpaceXml(makeData({ chartType: 'pie3D' })));
		expect(pa['c:catAx']).toBeUndefined();
		expect(pa['c:valAx']).toBeUndefined();
	});

	it('emits a title and autoTitleDeleted=0 when a title is set', () => {
		const root = chartRoot(buildChartSpaceXml(makeData({ title: 'Sales' })));
		expect(root['c:title']).toBeDefined();
		expect(root['c:autoTitleDeleted']).toStrictEqual({ '@_val': '0' });
	});

	it('marks autoTitleDeleted=1 when no title is set', () => {
		const root = chartRoot(buildChartSpaceXml(makeData({ title: undefined })));
		expect(root['c:title']).toBeUndefined();
		expect(root['c:autoTitleDeleted']).toStrictEqual({ '@_val': '1' });
	});

	it('emits a legend when the style requests one', () => {
		const root = chartRoot(
			buildChartSpaceXml(makeData({ style: { hasLegend: true, legendPosition: 'b' } })),
		);
		expect((root['c:legend'] as XmlObject)['c:legendPos']).toStrictEqual({ '@_val': 'b' });
	});

	it('always emits plotVisOnly', () => {
		expect(chartRoot(buildChartSpaceXml(makeData()))['c:plotVisOnly']).toStrictEqual({
			'@_val': '1',
		});
	});

	it('writes a series colour as a solidFill srgbClr (hex without #, upper-cased)', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({ series: [{ name: 'Revenue', values: [1], color: '#4472c4' }] }),
			),
		);
		const ser = (pa['c:barChart'] as XmlObject)['c:ser'] as XmlObject[];
		const spPr = ser[0]['c:spPr'] as XmlObject;
		const fill = spPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('4472C4');
	});

	it('wraps a line-series colour in a:ln for line charts', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({ chartType: 'line', series: [{ name: 'A', values: [1], color: '#FF0000' }] }),
			),
		);
		const ser = (pa['c:lineChart'] as XmlObject)['c:ser'] as XmlObject[];
		const spPr = ser[0]['c:spPr'] as XmlObject;
		const ln = spPr['a:ln'] as XmlObject;
		expect(((ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('omits c:spPr when a series has no colour', () => {
		const pa = plotArea(buildChartSpaceXml(makeData()));
		const ser = (pa['c:barChart'] as XmlObject)['c:ser'] as XmlObject[];
		expect(ser[0]['c:spPr']).toBeUndefined();
	});

	it('emits typed trendlines and error bars for SDK-created charts', () => {
		const pa = plotArea(
			buildChartSpaceXml(
				makeData({
					series: [
						{
							name: 'Revenue',
							values: [1],
							trendlines: [
								{
									trendlineType: 'polynomial',
									order: 3,
									label: { numberFormatCode: '0.00' },
								},
							],
							errBars: [
								{
									direction: 'y',
									barType: 'both',
									valType: 'fixedVal',
									val: 2,
								},
							],
						},
					],
				}),
			),
		);
		const series = ((pa['c:barChart'] as XmlObject)['c:ser'] as XmlObject[])[0];
		const trendline = series['c:trendline'] as XmlObject;
		expect(trendline['c:order']).toStrictEqual({ '@_val': '3' });
		expect((trendline['c:trendlineLbl'] as XmlObject)['c:numFmt']).toStrictEqual({
			'@_formatCode': '0.00',
		});
		expect((series['c:errBars'] as XmlObject)['c:val']).toStrictEqual({ '@_val': '2' });
		const names = Object.keys(series).map((key) => key.replace(/^.*:/u, ''));
		expect(names.indexOf('trendline')).toBeLessThan(names.indexOf('errBars'));
		expect(names.indexOf('errBars')).toBeLessThan(names.indexOf('cat'));
	});
});
