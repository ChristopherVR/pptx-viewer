/**
 * A pie label with category + percent and no c:separator draws on two lines.
 * `ChartRendererComponent` paints every `vm.dataLabels` entry as one `<text>`
 * (see `chart-renderer.component.test.ts` for why no TestBed mount), so the
 * view model must already carry one entry per line.
 */
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-renderer-helpers';

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

describe('chartRenderer multi-line pie labels', () => {
	it('emits the category and the percentage as separate data labels', () => {
		const texts = buildChartViewModel(element).dataLabels.map((label) => label.text);
		expect(texts).toContain('Direct');
		expect(texts).toContain('60%');
		expect(texts).not.toContain('Direct, 60%');
	});
});
