import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderChartElement } from './chart';
import { registerTableChartRenderers } from './register-table-chart';

/**
 * Regression coverage for hover-tooltip text on chart marks.
 *
 * Only the region map's `path` primitives carried a `title`; every other
 * mark kind (bar rects, line/scatter/bubble dots, radar vertices) rendered no
 * hover tooltip at all, because the projector's per-primitive branch only
 * emitted an SVG `<title>` child for `path`. This asserts bar rects and
 * line-chart point dots now do too.
 */

function buildContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	registerTableChartRenderers(registry);
	// `context` self-references via `renderElement`, so its declaration can't
	// merge with the one above without hoisting the object literal apart.
	// eslint-disable-next-line one-var
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

function buildChartElement(chartData: PptxChartData): PptxElement {
	return { type: 'chart', id: 'el-chart', x: 40, y: 50, width: 400, height: 300, chartData };
}

function renderChart(chartData: PptxChartData): HTMLElement {
	const node = renderChartElement(buildChartElement(chartData), 5, buildContext());
	expect(node).toBeTruthy();
	return node as HTMLElement;
}

describe('renderChartElement: mark tooltips', () => {
	it('projects a bar rect title as an SVG <title> child', () => {
		const svg = renderChart({
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'North', values: [10, 20] }],
			}).querySelector('svg') as SVGSVGElement,
			bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		expect(bars[0].querySelector('title')?.textContent).toBe('North, Q1: 10');
	});

	it('projects a line-chart point-dot title as an SVG <title> child', () => {
		const svg = renderChart({
				chartType: 'line',
				categories: ['Jan', 'Feb'],
				series: [{ name: 'Trend', values: [3, 7] }],
			}).querySelector('svg') as SVGSVGElement,
			dots = svg.querySelectorAll('circle[data-chart-part="dataPoint"]');
		expect(dots.length).toBeGreaterThan(0);
		expect(dots[0].querySelector('title')?.textContent).toBe('Trend, Jan: 3');
	});
});
