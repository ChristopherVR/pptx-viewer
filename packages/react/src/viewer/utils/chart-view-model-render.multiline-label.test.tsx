import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderChartViewModel } from './chart-view-model-render';

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

describe('renderChartViewModel: multi-line pie labels', () => {
	it('paints the category and the percentage as separate <text> nodes', () => {
		const html = renderToStaticMarkup(renderChartViewModel('c1', buildChartViewModel(element)));
		expect(html).toContain('>Direct</text>');
		expect(html).toContain('>60%</text>');
		expect(html).not.toContain('Direct, 60%');
	});
});
