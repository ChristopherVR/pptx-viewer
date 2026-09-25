import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model-build';
import { computePieLayout } from './chart-view-model-points';

/** A 230 x 250pt pie (the COM fixture's frame) whose labels PowerPoint put at bestFit. */
function pie(position: 'bestFit' | undefined, seriesLevel: boolean): PptxElement {
	return {
		id: 'pie',
		type: 'chart',
		x: 0,
		y: 0,
		width: 306.67,
		height: 333.33,
		chartData: {
			chartType: 'pie',
			chartChrome: { autoTitleDeleted: true },
			categories: ['A', 'B', 'C', 'D'],
			series: [
				{
					name: 'Sales',
					values: [25, 25, 25, 25],
					...(seriesLevel && position ? { dataLabelOptions: { position } } : {}),
				},
			],
			style: {
				hasDataLabels: true,
				...(!seriesLevel && position ? { dataLabels: { position } } : {}),
			},
		},
	} as unknown as PptxElement;
}

function labelDistances(element: PptxElement): number[] {
	const vm = buildChartViewModel(element);
	const { cx, cy, outerR } = computePieLayout(
		element.width,
		element.height,
		(element as unknown as { chartData: Parameters<typeof computePieLayout>[2] }).chartData,
		false,
	);
	return vm.dataLabels.map((label) => Math.hypot(label.x - cx, label.y - cy) / outerR);
}

describe('pie bestFit data labels', () => {
	it('reads the series-level c:dLblPos PowerPoint writes, not only the chart-level one', () => {
		for (const distance of labelDistances(pie('bestFit', true))) {
			// COM: 73pt out on an 89.6pt radius (0.81R); the centroid rule was 0.7R.
			expect(distance).toBeGreaterThan(0.78);
			expect(distance).toBeLessThan(0.9);
		}
	});

	it('places chart-level bestFit labels the same way', () => {
		expect(labelDistances(pie('bestFit', false))).toStrictEqual(
			labelDistances(pie('bestFit', true)),
		);
	});

	it('leaves labels with no position at the centroid', () => {
		for (const distance of labelDistances(pie(undefined, true))) {
			expect(distance).toBeCloseTo(0.7, 5);
		}
	});
});
