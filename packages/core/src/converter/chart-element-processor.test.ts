import { describe, it, expect } from 'vitest';
import { ChartElementProcessor } from './elements/ChartElementProcessor';
import type { ElementProcessorContext } from './elements/ElementProcessor';
import type { PptxElement, ChartPptxElement, PptxChartData } from '../core';
import { MediaContext } from './media-context';

function makeContext(): ElementProcessorContext {
	return {
		mediaContext: new MediaContext('/out', 'media'),
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		semanticMode: true,
		processElements: async () => [],
	};
}

function makeChartElement(chartData?: PptxChartData): ChartPptxElement {
	return {
		type: 'chart',
		id: 'chart_1',
		x: 50,
		y: 100,
		width: 600,
		height: 400,
		chartData,
	} as ChartPptxElement;
}

describe('ChartElementProcessor', () => {
	const processor = new ChartElementProcessor();

	it('should support only the chart type', () => {
		expect(processor.supportedTypes).toEqual(['chart']);
	});

	it('should render chart with title and type', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Sales Overview',
			chartType: 'bar',
			categories: ['Q1', 'Q2', 'Q3', 'Q4'],
			series: [
				{ name: 'Revenue', values: [100, 120, 140, 160] },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('**Sales Overview**');
		expect(result).toContain('*Type: Bar*');
	});

	it('should render data as a markdown table with categories and series', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Performance',
			chartType: 'line',
			categories: ['Jan', 'Feb', 'Mar'],
			series: [
				{ name: 'Sales', values: [10, 20, 30] },
				{ name: 'Costs', values: [5, 8, 12] },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Category');
		expect(result).toContain('Sales');
		expect(result).toContain('Costs');
		expect(result).toContain('Jan');
		expect(result).toContain('20');
	});

	it('should render pie chart with percentage column', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Market Share',
			chartType: 'pie',
			categories: ['Product A', 'Product B', 'Product C'],
			series: [
				{ name: 'Share', values: [50, 30, 20] },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('%');
		expect(result).toContain('50.0%');
		expect(result).toContain('30.0%');
		expect(result).toContain('20.0%');
	});

	it('should handle chart with no data', async () => {
		const ctx = makeContext();
		const element = makeChartElement(undefined);
		const result = await processor.process(element, ctx);
		expect(result).toContain('[Chart: no data]');
	});

	it('should return null for non-chart element type', async () => {
		const ctx = makeContext();
		const element = {
			type: 'text',
			id: 'txt_1',
			x: 0, y: 0, width: 100, height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(element, ctx);
		expect(result).toBeNull();
	});

	it('should render axis information when present', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Revenue Chart',
			chartType: 'bar',
			categories: ['Jan'],
			series: [{ name: 'Revenue', values: [100] }],
			axes: [
				{
					axisType: 'catAx',
					titleText: 'Month',
				},
				{
					axisType: 'valAx',
					titleText: 'Amount',
					numFmt: { formatCode: '$#,##0' },
				},
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Axes:');
		expect(result).toContain('Category: "Month"');
		expect(result).toContain('Value: "Amount"');
		expect(result).toContain('$#,##0');
	});

	it('should render chart grouping', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Stacked Chart',
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S1', values: [10] }],
			grouping: 'stacked',
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('*Grouping: stacked*');
	});

	it('should render legend position', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'With Legend',
			chartType: 'line',
			categories: ['A'],
			series: [{ name: 'S1', values: [10] }],
			style: { legendPosition: 'b' },
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('*Legend: b*');
	});

	it('should render trendlines', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'With Trendline',
			chartType: 'scatter',
			categories: [],
			series: [
				{
					name: 'Data',
					values: [10, 20, 30],
					trendlines: [{ trendlineType: 'linear' }],
				},
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Trendlines:');
		expect(result).toContain('Data (linear)');
	});

	it('should render error bars', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'With Error Bars',
			chartType: 'bar',
			categories: ['A'],
			series: [
				{
					name: 'Values',
					values: [50],
					errBars: [
						{
							direction: 'y',
							barType: 'both',
							valType: 'percentage',
							val: 10,
						},
					],
				},
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Error bars:');
		expect(result).toContain('y-axis');
		expect(result).toContain('percentage');
	});

	it('should render data labels', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Labeled Chart',
			chartType: 'bar',
			categories: ['X'],
			series: [
				{
					name: 'Series1',
					values: [42],
					dataLabels: [
						{ idx: 0, showVal: true, showCatName: true },
					],
				},
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Data labels:');
		expect(result).toContain('value');
		expect(result).toContain('category');
	});

	it('should render external data reference', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'External',
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S1', values: [1] }],
			externalData: {
				relId: 'rId1',
				targetPath: 'file:///C:/Data/budget.xlsx',
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('External data: file:///C:/Data/budget.xlsx');
	});

	it('should use Untitled Chart when title is empty', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: '',
			chartType: 'bar',
			categories: [],
			series: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('**Untitled Chart**');
	});

	it('should humanize chart type names with spaces', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'Box Plot',
			chartType: 'boxWhisker',
			categories: [],
			series: [],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Box Whisker');
	});

	it('should render data table flags', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'With Data Table',
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S1', values: [1] }],
			dataTable: {
				showHorzBorder: true,
				showVertBorder: true,
				showOutline: true,
				showKeys: true,
			},
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('Data table:');
		expect(result).toContain('horizontal borders');
		expect(result).toContain('keys');
	});

	it('should render series values as bullet list when no categories', async () => {
		const ctx = makeContext();
		const element = makeChartElement({
			title: 'No Categories',
			chartType: 'bar',
			categories: [],
			series: [
				{ name: 'Series A', values: [10, 20, 30] },
			],
		});
		const result = await processor.process(element, ctx);
		expect(result).not.toBeNull();
		expect(result).toContain('- **Series A**: 10, 20, 30');
	});
});
