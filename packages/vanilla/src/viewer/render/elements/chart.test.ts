import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement, resolveChartPalette } from './chart';
import { registerTableChartRenderers } from './register-table-chart';

function buildContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};
	return context;
}

function buildChartElement(chartData: PptxChartData | undefined): PptxElement {
	return { type: 'chart', id: 'el-chart', x: 40, y: 50, width: 400, height: 300, chartData };
}

function barChartData(): PptxChartData {
	return {
		chartType: 'bar',
		title: 'Revenue',
		categories: ['Q1', 'Q2', 'Q3'],
		series: [
			{ name: 'North', values: [10, 20, 30] },
			{ name: 'South', values: [15, 5, 25], color: '#123456' },
		],
		style: { hasTitle: true, hasLegend: true, legendPosition: 'b' },
	};
}

function pieChartData(): PptxChartData {
	return {
		chartType: 'pie',
		categories: ['A', 'B', 'C', 'D'],
		series: [{ name: 'Share', values: [40, 30, 20, 10] }],
		style: { hasLegend: true, hasDataLabels: true },
	};
}

function lineChartData(): PptxChartData {
	return {
		chartType: 'line',
		categories: ['Jan', 'Feb', 'Mar', 'Apr'],
		series: [{ name: 'Trend', values: [3, 7, 4, 9] }],
		style: {},
	};
}

function renderChart(chartData: PptxChartData | undefined): HTMLElement {
	const node = renderChartElement(buildChartElement(chartData), 5, buildContext());
	expect(node).toBeTruthy();
	return node as HTMLElement;
}

describe('renderChartElement', () => {
	it('returns null for non-chart elements', () => {
		const text: PptxElement = { type: 'text', id: 't', x: 0, y: 0, width: 10, height: 10 };
		expect(renderChartElement(text, 0, buildContext())).toBeNull();
	});

	it('renders a positioned container with an inline SVG', () => {
		const container = renderChart(barChartData());
		expect(container.dataset.elementId).toBe('el-chart');
		expect(container.style.left).toBe('40px');
		expect(container.style.top).toBe('50px');
		expect(container.style.zIndex).toBe('5');
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
		expect(svg?.getAttribute('viewBox')).toBe('0 0 400 300');
		expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');
	});

	it('renders bar charts: one tagged rect per series x category', () => {
		const svg = renderChart(barChartData()).querySelector('svg') as SVGSVGElement;
		const bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		expect(bars).toHaveLength(6);
		// The second series carries its explicit colour.
		const southBars = Array.from(bars).filter((b) => b.getAttribute('fill') === '#123456');
		expect(southBars).toHaveLength(3);
		expect(southBars[0]?.getAttribute('data-chart-series')).toBe('1');
	});

	it('renders bar chart chrome: title, gridlines, axis + category labels, legend', () => {
		const svg = renderChart(barChartData()).querySelector('svg') as SVGSVGElement;
		const texts = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
		expect(texts).toContain('Revenue');
		expect(texts).toContain('Q1');
		expect(texts).toContain('Q3');
		// Value-axis tick labels (0..max) are present.
		expect(texts).toContain('0');
		// Gridlines: 6 ticks for the value axis.
		expect(svg.querySelectorAll('line').length).toBeGreaterThanOrEqual(6);
		// Legend: one group per series with a swatch and the series name.
		const legendItems = svg.querySelectorAll('g.pptxv-chart-legend-item');
		expect(legendItems).toHaveLength(2);
		expect(legendItems[0].querySelector('rect')).toBeTruthy();
		expect(legendItems[0].querySelector('text')?.textContent).toBe('North');
	});

	it('renders pie charts: one slice path per category, square aspect ratio', () => {
		const svg = renderChart(pieChartData()).querySelector('svg') as SVGSVGElement;
		expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
		const slices = svg.querySelectorAll('path[data-chart-part="dataPoint"]');
		expect(slices).toHaveLength(4);
		expect(slices[2].getAttribute('data-chart-point')).toBe('2');
		// hasDataLabels renders one value label per slice.
		const labels = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
		expect(labels).toContain('40');
		expect(labels).toContain('10');
	});

	it('renders line charts: a series polyline plus point dots', () => {
		const svg = renderChart(lineChartData()).querySelector('svg') as SVGSVGElement;
		const polyline = svg.querySelector('polyline');
		expect(polyline).toBeTruthy();
		expect(polyline?.getAttribute('points')?.split(' ')).toHaveLength(4);
		expect(polyline?.getAttribute('fill')).toBe('none');
		expect(svg.querySelectorAll('circle').length).toBeGreaterThanOrEqual(4);
	});

	it('renders a labelled placeholder for charts without data', () => {
		const container = renderChart(undefined);
		expect(container.querySelector('svg')).toBeNull();
		expect(container.textContent).toContain('Chart: bar');
	});

	it('is dispatched through the registry via registerTableChartRenderers', () => {
		const context = buildContext();
		expect(context.registry.has('chart')).toBeTruthy();
		expect(context.registry.has('table')).toBeTruthy();
		const node = context.renderElement(buildChartElement(pieChartData()), 0);
		expect((node as HTMLElement).querySelector('svg path')).toBeTruthy();
	});
});

describe('resolveChartPalette', () => {
	it('prefers an explicit parsed colour palette', () => {
		const data = { ...barChartData(), colorPalette: ['#111111', '#222222'] };
		expect(resolveChartPalette(data)).toStrictEqual(['#111111', '#222222']);
	});

	it('falls back to the style-id palette when no palette is parsed', () => {
		const palette = resolveChartPalette(barChartData());
		expect(palette.length).toBeGreaterThan(0);
	});

	it('colours untagged series from the resolved palette', () => {
		const data = { ...barChartData(), colorPalette: ['#abcdef', '#fedcba'] };
		const svg = renderChart(data).querySelector('svg') as SVGSVGElement;
		const bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		// First series has no explicit colour: takes palette[0].
		expect(bars[0].getAttribute('fill')).toBe('#abcdef');
	});
});
