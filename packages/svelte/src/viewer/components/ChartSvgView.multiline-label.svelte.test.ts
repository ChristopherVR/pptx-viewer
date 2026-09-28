import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { buildChartViewModel } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';

import ChartSvgView from './ChartSvgView.svelte';

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

describe('chartSvgView multi-line pie labels', () => {
	it('paints the category and the percentage as separate <text> nodes', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ChartSvgView, {
			target,
			props: { vm: buildChartViewModel(element), preserveAspectRatio: 'none', legendItems: [] },
		});
		flushSync();
		const texts = [...target.querySelectorAll('text')].map((t) => t.textContent?.trim());
		void unmount(component);
		target.remove();
		expect(texts).toContain('Direct');
		expect(texts).toContain('60%');
		expect(texts).not.toContain('Direct, 60%');
	});
});
