import { describe, it, expect, vi } from 'vitest';

import type { PptxElement } from '../../core';
import type { MediaContext } from '../media-context';
import { ChartElementProcessor } from './ChartElementProcessor';
import type { ElementProcessorContext } from './ElementProcessor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ElementProcessorContext> = {}): ElementProcessorContext {
	return {
		mediaContext: {} as MediaContext,
		slideNumber: 1,
		slideWidth: 960,
		slideHeight: 540,
		processElements: vi.fn(async () => []),
		...overrides,
	};
}

function makeChartElement(
	chartData: Record<string, unknown> | undefined,
	overrides: Record<string, unknown> = {},
): PptxElement {
	return {
		type: 'chart',
		id: 'chart_1',
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		chartData,
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chartElementProcessor', () => {
	const processor = new ChartElementProcessor();

	it('reports supported types as chart', () => {
		expect(processor.supportedTypes).toStrictEqual(['chart']);
	});

	it('returns null for non-chart element', async () => {
		const el = {
			type: 'text',
			id: 'txt_1',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
		} as unknown as PptxElement;
		const result = await processor.process(el, makeCtx());
		expect(result).toBeNull();
	});

	it('returns placeholder when chartData is undefined', async () => {
		const result = await processor.process(makeChartElement(undefined), makeCtx());
		expect(result).toBe('*[Chart: no data]*');
	});

	it('renders chart title and type', async () => {
		const chartData = {
			title: 'Sales Chart',
			chartType: 'barChart',
			categories: [],
			series: [],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('**Sales Chart**');
		expect(result).toContain('*Type: Bar Chart*');
	});

	it('uses "Untitled Chart" when title is empty', async () => {
		const chartData = {
			title: '',
			chartType: 'pieChart',
			categories: [],
			series: [],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('**Untitled Chart**');
	});

	it('humanizes chart type (camelCase to Title Case)', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'lineChart3D',
			categories: [],
			series: [],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('*Type: Line Chart 3D*');
	});

	it('renders data table with categories and series', async () => {
		const chartData = {
			title: 'Revenue',
			chartType: 'barChart',
			categories: ['Q1', 'Q2', 'Q3'],
			series: [
				{ name: 'Product A', values: [100, 150, 200] },
				{ name: 'Product B', values: [80, 120, 160] },
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('Category');
		expect(result).toContain('Product A');
		expect(result).toContain('Product B');
		expect(result).toContain('Q1');
		expect(result).toContain('100');
	});

	it('includes percentage column for pie charts', async () => {
		const chartData = {
			title: 'Pie',
			chartType: 'pie',
			categories: ['A', 'B'],
			series: [{ name: 'Values', values: [75, 25] }],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('%');
		expect(result).toContain('75.0%');
		expect(result).toContain('25.0%');
	});

	it('includes percentage column for doughnut charts', async () => {
		const chartData = {
			title: 'Doughnut',
			chartType: 'doughnut',
			categories: ['A', 'B'],
			series: [{ name: 'Values', values: [50, 50] }],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('%');
		expect(result).toContain('50.0%');
	});

	it('renders series as bullet list when no categories', async () => {
		const chartData = {
			title: 'No Categories',
			chartType: 'barChart',
			categories: [],
			series: [{ name: 'Series 1', values: [10, 20, 30] }],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('- **Series 1**: 10, 20, 30');
	});

	it('renders axis information', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			axes: [
				{ axisType: 'catAx', titleText: 'Month' },
				{ axisType: 'valAx', titleText: 'Sales', numFmt: { formatCode: '#,##0' } },
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('Category: "Month"');
		expect(result).toContain('Value: "Sales", format: #,##0');
	});

	it('humanizes axis types', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			axes: [
				{ axisType: 'dateAx', titleText: 'Date' },
				{ axisType: 'serAx', titleText: 'Series' },
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('Date: "Date"');
		expect(result).toContain('Series: "Series"');
	});

	it('renders grouping info', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			grouping: 'stacked',
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('*Grouping: stacked*');
	});

	it('renders legend position', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			style: { legendPosition: 'bottom' },
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('*Legend: bottom*');
	});

	it('renders data table flags', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			dataTable: {
				showHorzBorder: true,
				showVertBorder: true,
				showOutline: false,
				showKeys: true,
			},
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('horizontal borders');
		expect(result).toContain('vertical borders');
		expect(result).toContain('keys');
		expect(result).not.toContain('outline');
	});

	it('renders trendline info', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [
				{
					name: 'Sales',
					values: [10],
					trendlines: [{ trendlineType: 'linear' }],
				},
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('*Trendlines: Sales (linear)*');
	});

	it('renders external data path', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [],
			externalData: { targetPath: 'data.xlsx' },
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('*External data: data.xlsx*');
	});

	it('renders data labels', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: ['A'],
			series: [
				{
					name: 'S1',
					values: [10],
					dataLabels: [{ idx: 0, text: 'Label text' }],
				},
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('Data labels: S1[0]: "Label text"');
	});

	it('renders data label flags', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: ['A'],
			series: [
				{
					name: 'S1',
					values: [10],
					dataLabels: [{ idx: 0, showVal: true, showPercent: true }],
				},
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('value+percent');
	});

	it('renders error bars', async () => {
		const chartData = {
			title: 'Test',
			chartType: 'barChart',
			categories: [],
			series: [
				{
					name: 'S1',
					values: [10],
					errBars: [
						{
							direction: 'y',
							valType: 'fixedVal',
							val: 5,
							barType: 'both',
						},
					],
				},
			],
		};
		const result = await processor.process(makeChartElement(chartData), makeCtx());
		expect(result).toContain('Error bars: S1 y-axis fixedVal 5 (both)');
	});
});
