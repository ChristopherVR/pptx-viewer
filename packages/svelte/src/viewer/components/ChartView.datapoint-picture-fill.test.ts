import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartView from './ChartView.svelte';

/**
 * C2-G9 (render half): a data point's c:dPt/c:pictureOptions picture fill
 * reaches the SVG as a <pattern>/<image> def and a fill="url(#...)" bar rect,
 * verified through the real rendered Svelte DOM.
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

describe('chartView: c:dPt/c:pictureOptions picture fill', () => {
	it('renders a <pattern>/<image> def and points the bar fill at it', () => {
		const target = render(
			chartElement({
				chartType: 'bar',
				categories: ['Q1', 'Q2'],
				series: [
					{
						name: 'Revenue',
						values: [100, 150],
						dataPoints: [
							{
								idx: 0,
								picture: { imageUrl: 'data:image/png;base64,AAA', pictureFormat: 'stretch' },
							},
						],
					},
				],
			}),
		);
		const pattern = target.querySelector('pattern');
		expect(pattern).not.toBeNull();
		expect(target.querySelector('image')).not.toBeNull();
		const patternId = pattern?.getAttribute('id');
		const filledRect = Array.from(target.querySelectorAll('rect')).find(
			(r) => r.getAttribute('fill') === `url(#${patternId})`,
		);
		expect(filledRect).toBeDefined();
	});
});
