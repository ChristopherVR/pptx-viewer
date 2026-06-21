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
});
