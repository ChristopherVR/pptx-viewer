import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderChartViewModelSvg } from './chart-svg';

/**
 * C2-G9 (render half): a data point's c:dPt/c:pictureOptions picture fill
 * reaches the SVG as a <pattern>/<image> def and a fill="url(#...)" bar rect,
 * through the real shared `buildChartViewModel` pipeline.
 */

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

describe('renderChartViewModelSvg: c:dPt/c:pictureOptions picture fill', () => {
	it('renders a <pattern>/<image> def and points the bar fill at it', () => {
		const element = chartElement({
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
		});
		const vm = buildChartViewModel(element);
		const svg = renderChartViewModelSvg(document, vm, 'none');
		const pattern = svg.querySelector('pattern');
		expect(pattern).not.toBeNull();
		expect(svg.querySelector('image')).not.toBeNull();
		const patternId = pattern?.getAttribute('id');
		const filledRect = Array.from(svg.querySelectorAll('rect')).find(
			(r) => r.getAttribute('fill') === `url(#${patternId})`,
		);
		expect(filledRect).toBeDefined();
	});
});
