import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartView from './ChartView.svelte';

/**
 * W4-D: a chart title with typed rich-text runs (`titleRuns`) draws one
 * <tspan> per run instead of collapsing to a single flat text node, verified
 * through the real rendered Svelte DOM.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ChartView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 0 },
	});
	flushSync();
	return target;
}

function chartElement(chartData: PptxChartData): PptxElement {
	return {
		id: 'el-chart',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData,
	} as PptxElement;
}

describe('chartView: chart title rich text (titleRunSpans)', () => {
	it('renders one <tspan> per titleRunSpans entry with its own style', () => {
		const target = render(
			chartElement({
				chartType: 'bar',
				title: 'Sales Q1',
				categories: ['Q1'],
				series: [{ name: 'Revenue', values: [10] }],
				style: { hasTitle: true },
				titleRuns: [
					{ text: 'Sales ', bold: true },
					{ text: 'Q1', italic: true, color: '#FF0000' },
				],
			}),
		);
		const tspans = Array.from(target.querySelectorAll('tspan'));
		expect(tspans).toHaveLength(2);
		expect(tspans[0].textContent).toBe('Sales ');
		expect(tspans[1].textContent).toBe('Q1');
		expect(tspans[1].getAttribute('font-style')).toBe('italic');
	});

	it('falls back to a flat text node when the title has no typed runs', () => {
		const target = render(
			chartElement({
				chartType: 'bar',
				title: 'Sales',
				categories: ['Q1'],
				series: [{ name: 'Revenue', values: [10] }],
				style: { hasTitle: true },
			}),
		);
		expect(target.querySelectorAll('tspan')).toHaveLength(0);
		const titleText = target.querySelector('[data-chart-part="title"]');
		expect(titleText?.textContent).toBe('Sales');
	});
});
