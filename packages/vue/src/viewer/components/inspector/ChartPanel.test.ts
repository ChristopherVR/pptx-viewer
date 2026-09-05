import { mount } from '@vue/test-utils';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import ChartPanel from './ChartPanel.vue';

function chartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		title: 'Sales',
		chartType: 'bar',
		categories: ['Jan', 'Feb', 'Mar'],
		series: [{ name: 'Revenue', values: [10, 20, 30] }],
		grouping: 'clustered',
		...overrides,
	};
}

function chartElement(overrides: Partial<PptxChartData> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: chartData(overrides),
	} as PptxElement;
}

function nonChartElement(): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as PptxElement;
}

/** Read the single emitted `update` patch's chartData payload. */
function lastChartData(emitted: unknown): PptxChartData {
	const events = emitted as Array<Array<{ chartData?: PptxChartData }>> | undefined;
	if (!events || events.length === 0) {
		throw new Error('no update emitted');
	}
	const patch = events[events.length - 1][0];
	if (!patch.chartData) {
		throw new Error('patch has no chartData');
	}
	return patch.chartData;
}

describe('chartPanel', () => {
	it('shows a muted note for non-chart elements', () => {
		const wrapper = mount(ChartPanel, { props: { element: nonChartElement() } });
		expect(wrapper.find('.pptx-vue-chart-muted').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="chart-type"]').exists()).toBeFalsy();
	});

	it('changing the type emits new chartData carrying that type', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		const select = wrapper.get('[data-testid="chart-type"]');
		await select.setValue('line');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.chartType).toBe('line');
		// Original data is preserved (categories/series carried over).
		expect(next.categories).toStrictEqual(['Jan', 'Feb', 'Mar']);
		expect(next.series).toHaveLength(1);
	});

	it('offers each of the six ChartEx types and emits the chosen one', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		const select = wrapper.get('[data-testid="chart-type"]');
		for (const chartType of [
			'histogram',
			'funnel',
			'treemap',
			'sunburst',
			'boxWhisker',
			'regionMap',
		]) {
			await select.setValue(chartType);
			expect(lastChartData(wrapper.emitted('update')).chartType).toBe(chartType);
		}
	});

	it('clears grouping when switching to a type that does not support it', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-type"]').setValue('pie');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.chartType).toBe('pie');
		expect(next.grouping).toBeUndefined();
	});

	it('editing the title emits updated chartData with the new title', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		const input = wrapper.get('[data-testid="chart-title"]');
		await input.setValue('New Title');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.title).toBe('New Title');
		// Type is untouched by a title edit.
		expect(next.chartType).toBe('bar');
	});

	// W4-D: a multi-run title collapses to one run in the dominant style
	// instead of leaving a stale second run's text behind.
	it('collapses a multi-run title to one run in the dominant style on edit', async () => {
		const wrapper = mount(ChartPanel, {
			props: {
				element: chartElement({
					titleRuns: [
						{ text: 'Sales ', bold: true },
						{ text: 'Q1 Numbers', italic: true, color: '#FF0000' },
					],
				}),
			},
		});
		const input = wrapper.get('[data-testid="chart-title"]');
		await input.setValue('New Title');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.title).toBe('New Title');
		expect(next.titleRuns).toStrictEqual([{ text: 'New Title', italic: true, color: '#FF0000' }]);
	});

	it('shows the grouping control only for grouping-capable types', () => {
		const grouped = mount(ChartPanel, { props: { element: chartElement({ chartType: 'bar' }) } });
		expect(grouped.find('[data-testid="chart-grouping"]').exists()).toBeTruthy();

		const ungrouped = mount(ChartPanel, {
			props: { element: chartElement({ chartType: 'pie', grouping: undefined }) },
		});
		expect(ungrouped.find('[data-testid="chart-grouping"]').exists()).toBeFalsy();
	});

	it('changing grouping emits updated chartData with the new grouping', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-grouping"]').setValue('stacked');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.grouping).toBe('stacked');
		expect(next.chartType).toBe('bar');
	});

	it('renders a colour swatch per series', () => {
		const wrapper = mount(ChartPanel, {
			props: {
				element: chartElement({
					series: [
						{ name: 'A', values: [1] },
						{ name: 'B', values: [2] },
					],
				}),
			},
		});
		expect(wrapper.findAll('[data-testid="chart-series-color"]')).toHaveLength(2);
	});

	it('picking a series colour emits chartData with that colour set on the series (debounced)', async () => {
		vi.useFakeTimers();
		try {
			const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
			await wrapper.get('[data-testid="chart-series-color"]').setValue('#ff0000');

			// The commit is debounced: nothing is emitted until the timer fires.
			expect(wrapper.emitted('update')).toBeUndefined();
			vi.runAllTimers();

			const next = lastChartData(wrapper.emitted('update'));
			expect(next.series[0].color).toBe('#ff0000');
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not mutate the original element when picking a colour', async () => {
		const el = chartElement();
		const wrapper = mount(ChartPanel, { props: { element: el } });
		await wrapper.get('[data-testid="chart-series-color"]').setValue('#00ff00');

		expect((el as { chartData?: PptxChartData }).chartData?.series[0].color).toBeUndefined();
	});

	// ── Advanced controls (parity with the React chart editor) ─────────

	it('toggling show-legend emits style with hasLegend set', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-show-legend"]').setValue(true);

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.style?.hasLegend).toBeTruthy();
	});

	it('legend position only appears once a legend is enabled', async () => {
		const off = mount(ChartPanel, { props: { element: chartElement() } });
		expect(off.find('[data-testid="chart-legend-position"]').exists()).toBeFalsy();

		const on = mount(ChartPanel, {
			props: { element: chartElement({ style: { hasLegend: true } }) },
		});
		expect(on.find('[data-testid="chart-legend-position"]').exists()).toBeTruthy();
	});

	it('enabling data labels emits style with hasDataLabels and reveals content flags', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		expect(wrapper.find('[data-testid="chart-data-label-content"]').exists()).toBeFalsy();

		await wrapper.get('[data-testid="chart-show-data-labels"]').setValue(true);
		const next = lastChartData(wrapper.emitted('update'));
		expect(next.style?.hasDataLabels).toBeTruthy();

		const labelled = mount(ChartPanel, {
			props: { element: chartElement({ style: { hasDataLabels: true } }) },
		});
		expect(labelled.find('[data-testid="chart-data-label-content"]').exists()).toBeTruthy();
	});

	it('editing an axis min emits chartData with that axis scale', async () => {
		const wrapper = mount(ChartPanel, {
			props: { element: chartElement({ axes: [{ axisType: 'valAx' }] }) },
		});
		await wrapper.get('[data-testid="chart-axis-scale"]').setValue('5');

		const next = lastChartData(wrapper.emitted('update'));
		const valAx = next.axes?.find((a) => a.axisType === 'valAx');
		expect(valAx?.min).toBe(5);
	});

	it('enabling log scale emits chartData with logScale on the value axis', async () => {
		const wrapper = mount(ChartPanel, {
			props: { element: chartElement({ axes: [{ axisType: 'valAx' }] }) },
		});
		await wrapper.get('[data-testid="chart-axis-log-scale"]').setValue(true);

		const next = lastChartData(wrapper.emitted('update'));
		const valAx = next.axes?.find((a) => a.axisType === 'valAx');
		expect(valAx?.logScale).toBeTruthy();
	});

	it('shows markers for line charts and applies a chosen symbol', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'line' }) } });
		const select = wrapper.get('[data-testid="chart-marker-symbol"]');
		await select.setValue('circle');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].marker?.symbol).toBe('circle');
	});

	it('hides markers for bar charts', () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'bar' }) } });
		expect(wrapper.find('[data-testid="chart-marker-symbol"]').exists()).toBeFalsy();
	});

	it('shows combo per-series type when there are two or more series', async () => {
		const wrapper = mount(ChartPanel, {
			props: {
				element: chartElement({
					chartType: 'bar',
					series: [
						{ name: 'A', values: [1] },
						{ name: 'B', values: [2] },
					],
				}),
			},
		});
		const selects = wrapper.findAll('[data-testid="chart-combo-type"]');
		expect(selects).toHaveLength(2);

		await selects[1].setValue('line');
		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[1].seriesChartType).toBe('line');
	});

	it('applies a trendline to a series', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'line' }) } });
		await wrapper.get('[data-testid="chart-trendline-type"]').setValue('linear');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].trendlines?.[0]?.trendlineType).toBe('linear');
	});

	it('applies error bars to a series', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'bar' }) } });
		await wrapper.get('[data-testid="chart-error-bar-valtype"]').setValue('percentage');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].errBars?.[0]?.valType).toBe('percentage');
	});

	it('shows per-point explosion for pie charts and applies it', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'pie' }) } });
		const inputs = wrapper.findAll('[data-testid="chart-point-explosion"]');
		expect(inputs).toHaveLength(3);

		await inputs[0].setValue('30');
		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].dataPoints?.find((p) => p.idx === 0)?.explosion).toBe(30);
	});

	it('applies a per-point fill', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'pie' }) } });
		await wrapper.findAll('[data-testid="chart-point-fill"]')[1].setValue('#abcdef');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].dataPoints?.find((p) => p.idx === 1)?.spPr?.fillColor).toBe('#abcdef');
	});

	// ── Data grid + summary ────────────────────────────────────────────

	it('renders a data summary line reporting series and category counts', () => {
		const wrapper = mount(ChartPanel, {
			props: {
				element: chartElement({
					series: [
						{ name: 'A', values: [1, 2, 3] },
						{ name: 'B', values: [4, 5, 6] },
					],
				}),
			},
		});
		expect(wrapper.get('[data-testid="chart-data-summary"]').text()).toBe(
			'2 Series · 3 Categories',
		);
	});

	it('editing a grid value emits chartData with the new numeric value', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.findAll('[data-testid="chart-grid-value"]')[1].setValue('99');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].values[1]).toBe(99);
	});

	it('renaming a series via the grid header emits chartData with the new name', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-grid-series-name"]').setValue('Profit');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].name).toBe('Profit');
	});

	it('adding a series appends a zero-filled series matching the category count', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-add-series"]').trigger('click');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series).toHaveLength(2);
		expect(next.series[1].values).toStrictEqual([0, 0, 0]);
	});

	it('adding a category appends a label and a zero to each series', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.get('[data-testid="chart-add-category"]').trigger('click');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.categories).toHaveLength(4);
		expect(next.series[0].values).toHaveLength(4);
	});

	it('removing a category drops it and its values from every series', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement() } });
		await wrapper.findAll('[data-testid="chart-remove-category"]')[0].trigger('click');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.categories).toStrictEqual(['Feb', 'Mar']);
		expect(next.series[0].values).toStrictEqual([20, 30]);
	});

	// ── Per-point label + marker overrides ─────────────────────────────

	it('applies a per-point label text override', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'pie' }) } });
		await wrapper.findAll('[data-testid="chart-point-label"]')[0].setValue('Peak');

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].dataLabels?.find((l) => l.idx === 0)?.text).toBe('Peak');
	});

	it('toggling a per-point marker override adds a marker to that point', async () => {
		const wrapper = mount(ChartPanel, { props: { element: chartElement({ chartType: 'line' }) } });
		await wrapper.findAll('[data-testid="chart-point-marker-toggle"]')[0].setValue(true);

		const next = lastChartData(wrapper.emitted('update'));
		expect(next.series[0].dataPoints?.find((p) => p.idx === 0)?.marker?.symbol).toBe('circle');
	});
});
