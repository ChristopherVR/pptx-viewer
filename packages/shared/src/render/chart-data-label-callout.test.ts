import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildDataLabelDecorations, calloutLabelLift } from './chart-data-label-callout';
import { buildChartViewModel } from './chart-view-model';
import type { SvgText } from './chart-view-model';

const label: SvgText = {
	kind: 'text',
	x: 100,
	y: 50,
	text: 'Category 1 | 4.3',
	fontSize: 12,
	fill: '#404040',
	textAnchor: 'middle',
};

function series(options: PptxChartSeries['dataLabelOptions']): PptxChartSeries {
	return { name: 'S', values: [4.3], dataLabelOptions: options };
}

const chart = { chartType: 'bar', categories: ['A'], series: [] } as PptxChartData;

describe('buildDataLabelDecorations (COM: charts-com.pptx slide 17)', () => {
	it('draws a filled wedge callout reaching the bar top', () => {
		const [box] = buildDataLabelDecorations(
			chart,
			series({ labelShape: { fillColor: '#FFFFCC' }, calloutShape: 'wedgeRectCallout' }),
			label,
			{ x: 100, y: 90 },
			false,
		);
		expect(box).toMatchObject({ kind: 'polygon', fill: '#FFFFCC' });
		expect(box.kind === 'polygon' && box.points).toContain('100,90');
	});

	it('draws a leader line only for a moved label', () => {
		const opts = { extLeaderLines: true };
		expect(
			buildDataLabelDecorations(chart, series(opts), label, { x: 100, y: 90 }, false),
		).toStrictEqual([]);
		const [line] = buildDataLabelDecorations(chart, series(opts), label, { x: 100, y: 90 }, true);
		expect(line).toMatchObject({ kind: 'line', x2: 100, y2: 90 });
	});

	it('lifts an unmoved callout label so its pointer shows', () => {
		expect(
			calloutLabelLift(chart, series({ calloutShape: 'wedgeRectCallout' }), 12, false),
		).toBeGreaterThan(0);
		expect(calloutLabelLift(chart, series({ calloutShape: 'wedgeRectCallout' }), 12, true)).toBe(0);
		expect(calloutLabelLift(chart, series({}), 12, false)).toBe(0);
	});

	it('reaches the bar view model', () => {
		const vm = buildChartViewModel({
			id: 'c',
			type: 'chart',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			chartData: {
				chartType: 'bar',
				barDirection: 'col',
				categories: ['A'],
				series: [
					series({
						showValue: true,
						labelShape: { fillColor: '#FFFFCC' },
						calloutShape: 'wedgeRectCallout',
					}),
				],
				style: { hasDataLabels: true },
			},
		} as never);
		expect(vm.primitives.some((p) => p.kind === 'polygon' && p.fill === '#FFFFCC')).toBeTruthy();
	});
});
