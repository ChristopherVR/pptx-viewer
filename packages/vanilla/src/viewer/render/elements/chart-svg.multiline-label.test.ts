import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderChartViewModelSvg } from './chart-svg';

/** A pie label with category + percent and no c:separator draws on two lines. */
const pieData = {
	chartType: 'pie',
	categories: ['Direct', 'Partner'],
	series: [
		{
			name: 'Share',
			values: [60, 40],
			dataLabelOptions: { showValue: false, showCategory: true, showPercent: true },
		},
	],
	style: { hasDataLabels: true },
} as PptxChartData;

const element = {
	id: 'el-pie',
	type: 'chart',
	x: 0,
	y: 0,
	width: 400,
	height: 300,
	chartData: pieData,
} as ChartPptxElement;

describe('renderChartViewModelSvg: multi-line pie labels', () => {
	it('paints the category and the percentage as separate <text> nodes', () => {
		const svg = renderChartViewModelSvg(document, buildChartViewModel(element), 'none');
		const texts = Array.from(svg.querySelectorAll('text')).map((t) => t.textContent);
		expect(texts).toContain('Direct');
		expect(texts).toContain('60%');
		expect(texts).not.toContain('Direct, 60%');
	});
});
