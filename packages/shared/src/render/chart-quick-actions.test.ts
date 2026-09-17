import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildChartQuickActionsDescriptor,
	CHART_QUICK_ACTION_BUTTON_SIZE,
} from './chart-quick-actions';

function chart(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A', 'B'],
		series: [{ name: 'S1', values: [1, 2] }],
		...overrides,
	} as PptxChartData;
}

const box = { x: 100, y: 50, width: 200, height: 120 };

describe('buildChartQuickActionsDescriptor', () => {
	it('returns null when the selection is not a chart', () => {
		expect(
			buildChartQuickActionsDescriptor({
				isChartSelected: false,
				chartData: chart(),
				selectionBox: box,
			}),
		).toBeNull();
	});

	it('returns null when there is no chart data', () => {
		expect(
			buildChartQuickActionsDescriptor({
				isChartSelected: true,
				chartData: undefined,
				selectionBox: box,
			}),
		).toBeNull();
	});

	it('anchors the three buttons outside the top-right corner, stacked vertically', () => {
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: chart(),
			selectionBox: box,
		})!;
		expect(descriptor.buttons.map((b) => b.id)).toStrictEqual(['elements', 'styles', 'filters']);
		const expectedX = box.x + box.width + 8;
		descriptor.buttons.forEach((button, i) => {
			expect(button.x).toBe(expectedX);
			expect(button.size).toBe(CHART_QUICK_ACTION_BUTTON_SIZE);
			if (i > 0) {
				expect(button.y).toBeGreaterThan(descriptor.buttons[i - 1]!.y);
			}
		});
	});

	it('builds the Chart Elements checklist from style/gridlines/axes state', () => {
		const data = chart({
			style: { hasTitle: true, hasLegend: false, hasDataLabels: true },
			axes: [{ axisType: 'valAx', axPos: 'l', majorGridlines: true, titleText: 'Revenue' }],
		});
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: data,
			selectionBox: box,
		})!;
		const byKey = Object.fromEntries(descriptor.elements.map((e) => [e.key, e.checked]));
		expect(byKey.title).toBeTruthy();
		expect(byKey.legend).toBeFalsy();
		expect(byKey.dataLabels).toBeTruthy();
		expect(byKey.gridlines).toBeTruthy();
		expect(byKey.axes).toBeTruthy();
		expect(byKey.axisTitles).toBeTruthy();
	});

	it('omits axes/axisTitles rows when the chart has no axes', () => {
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: chart({ chartType: 'pie' }),
			selectionBox: box,
		})!;
		expect(descriptor.elements.some((e) => e.key === 'axes')).toBeFalsy();
		expect(descriptor.elements.some((e) => e.key === 'axisTitles')).toBeFalsy();
	});

	it('lists every series (visible and filtered) for Chart Filters, gated on more than one', () => {
		const single = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: chart(),
			selectionBox: box,
		})!;
		expect(single.filters.visible).toBeFalsy();

		const multi = chart({
			series: [
				{ name: 'S1', values: [1, 2] },
				{ name: 'S2', values: [3, 4] },
			],
			filteredSeries: [{ idx: 2, order: 2, name: 'S3', values: [5, 6] }],
		});
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: multi,
			selectionBox: box,
		})!;
		expect(descriptor.filters.visible).toBeTruthy();
		expect(descriptor.filters.series).toStrictEqual([
			{ key: 'visible-0', name: 'S1', visible: true, seriesIndex: 0 },
			{ key: 'visible-1', name: 'S2', visible: true, seriesIndex: 1 },
			{ key: 'filtered-0', name: 'S3', visible: false, filteredIndex: 0 },
		]);
	});

	it('exposes the Chart Styles preset gallery', () => {
		const descriptor = buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: chart(),
			selectionBox: box,
		})!;
		expect(descriptor.styles.presets).toHaveLength(6);
	});
});
