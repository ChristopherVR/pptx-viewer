import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveChartPalette } from '../render';
import ElementRenderer from './ElementRenderer.svelte';

/**
 * ChartView tests: mount the dispatcher with fabricated bar / pie / line
 * charts and assert the projected SVG structure (tagged data marks, chrome,
 * legend, palette resolution), mirroring the vanilla chart renderer tests.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 5 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

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

function renderChartSvg(chartData: PptxChartData): SVGSVGElement {
	const svg = mountEl(buildChartElement(chartData)).querySelector('svg');
	expect(svg).toBeTruthy();
	return svg as SVGSVGElement;
}

describe('chartView', () => {
	it('renders a positioned container with an inline SVG', () => {
		const target = mountEl(buildChartElement(barChartData()));
		const container = target.querySelector<HTMLElement>('[data-element-id="el-chart"]');
		const style = container?.getAttribute('style') ?? '';
		expect(style).toContain('left: 40px');
		expect(style).toContain('top: 50px');
		expect(style).toContain('z-index: 5');
		const svg = container?.querySelector('svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 400 300');
		expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');
	});

	it('renders bar charts: one tagged rect per series x category', () => {
		const svg = renderChartSvg(barChartData());
		const bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		expect(bars).toHaveLength(6);
		// The second series carries its explicit colour.
		const southBars = Array.from(bars).filter((b) => b.getAttribute('fill') === '#123456');
		expect(southBars).toHaveLength(3);
		expect(southBars[0]?.getAttribute('data-chart-series')).toBe('1');
	});

	it('renders bar chart chrome: title, gridlines, axis + category labels, legend', () => {
		const svg = renderChartSvg(barChartData());
		const texts = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
		expect(texts).toContain('Revenue');
		expect(texts).toContain('Q1');
		expect(texts).toContain('Q3');
		// Value-axis tick labels (0..max) are present.
		expect(texts).toContain('0');
		// Gridlines: 6 ticks for the value axis.
		expect(svg.querySelectorAll('line').length).toBeGreaterThanOrEqual(6);
		// Legend: one group per series with a swatch and the series name.
		const legendItems = svg.querySelectorAll('g.pptx-svelte-chart-legend-item');
		expect(legendItems).toHaveLength(2);
		expect(legendItems[0].querySelector('rect')).toBeTruthy();
		expect(legendItems[0].querySelector('text')?.textContent).toBe('North');
	});

	it('renders pie charts: one slice path per category, square aspect ratio', () => {
		const svg = renderChartSvg(pieChartData());
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
		const svg = renderChartSvg(lineChartData());
		const polyline = svg.querySelector('polyline');
		expect(polyline).toBeTruthy();
		expect(polyline?.getAttribute('points')?.split(' ')).toHaveLength(4);
		expect(polyline?.getAttribute('fill')).toBe('none');
		expect(svg.querySelectorAll('circle').length).toBeGreaterThanOrEqual(4);
	});

	it('renders a labelled placeholder for charts without data', () => {
		const target = mountEl(buildChartElement(undefined));
		expect(target.querySelector('svg')).toBeNull();
		expect(target.textContent).toContain('Chart: bar');
	});

	it('colours untagged series from an explicit parsed palette', () => {
		const data = { ...barChartData(), colorPalette: ['#abcdef', '#fedcba'] };
		expect(resolveChartPalette(data)).toStrictEqual(['#abcdef', '#fedcba']);
		const svg = renderChartSvg(data);
		const bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		// First series has no explicit colour: takes palette[0].
		expect(bars[0].getAttribute('fill')).toBe('#abcdef');
	});

	it('falls back to the style-id palette when no palette is parsed', () => {
		expect(resolveChartPalette(barChartData()).length).toBeGreaterThan(0);
	});
});
