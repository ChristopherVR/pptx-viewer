import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * Regression coverage for hover-tooltip text on chart marks.
 *
 * Only the region map's `path` primitives carried a `title`; every other mark
 * kind (bar rects, line/scatter/bubble dots, radar vertices) rendered no
 * hover tooltip at all, because the projector's per-primitive branch only
 * emitted an SVG `<title>` child for `path`. This asserts bar rects and
 * line-chart point dots now do too.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	// `target` must exist (and be appended) before `mount()` is called, so this
	// declaration can't merge with the one above without reordering the setup.
	// eslint-disable-next-line one-var
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

function buildChartElement(chartData: PptxChartData): PptxElement {
	return { type: 'chart', id: 'el-chart', x: 40, y: 50, width: 400, height: 300, chartData };
}

function renderChartSvg(chartData: PptxChartData): SVGSVGElement {
	const svg = mountEl(buildChartElement(chartData)).querySelector('svg');
	expect(svg).toBeTruthy();
	return svg as SVGSVGElement;
}

describe('chartView: mark tooltips', () => {
	it('projects a bar rect title as an SVG <title> child', () => {
		const svg = renderChartSvg({
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [{ name: 'North', values: [10, 20] }],
			}),
			bars = svg.querySelectorAll('rect[data-chart-part="dataPoint"]');
		expect(bars[0].querySelector('title')?.textContent).toBe('North, Q1: 10');
	});

	it('projects a line-chart point-dot title as an SVG <title> child', () => {
		const svg = renderChartSvg({
				chartType: 'line',
				categories: ['Jan', 'Feb'],
				series: [{ name: 'Trend', values: [3, 7] }],
			}),
			dots = svg.querySelectorAll('circle[data-chart-part="dataPoint"]');
		expect(dots.length).toBeGreaterThan(0);
		expect(dots[0].querySelector('title')?.textContent).toBe('Trend, Jan: 3');
	});
});
