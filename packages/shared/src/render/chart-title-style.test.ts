import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveChartTitleTextStyle } from './chart-title-style';
import { buildChartViewModel } from './chart-view-model-build';

function chart(style: PptxChartData['style'] = {}): PptxChartData {
	return {
		chartType: 'bar',
		title: 'Sales',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		style: { hasTitle: true, ...style },
	};
}

describe('resolveChartTitleTextStyle', () => {
	it('falls back to the viewer defaults (12px, semi-bold, slate) for an unstyled title', () => {
		expect(resolveChartTitleTextStyle(chart())).toStrictEqual({
			fontSize: 12,
			fontWeight: 600,
			fill: '#1e293b',
		});
	});

	it('honours the title run properties parsed from c:tx/c:rich', () => {
		expect(
			resolveChartTitleTextStyle(
				chart({
					titleFontSize: 18,
					titleFontBold: false,
					titleFontColor: '#FF0000',
					titleFontFamily: 'Georgia',
				}),
			),
		).toStrictEqual({ fontSize: 24, fontWeight: 400, fill: '#FF0000', fontFamily: 'Georgia' });
	});

	it('maps titleFontBold=true to a bold weight', () => {
		expect(resolveChartTitleTextStyle(chart({ titleFontBold: true })).fontWeight).toBe(700);
	});

	it('reaches every binding through vm.titleStyle', () => {
		const vm = buildChartViewModel({
			id: 'c1',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData: chart({ titleFontSize: 15, titleFontColor: '#123456' }),
		});
		expect(vm.title).toBe('Sales');
		expect(vm.titleStyle).toStrictEqual({ fontSize: 20, fontWeight: 600, fill: '#123456' });
	});
});
