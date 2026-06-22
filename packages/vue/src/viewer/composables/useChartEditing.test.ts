// oxlint-disable react-hooks/rules-of-hooks
import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';

import { useChartEditing } from './useChartEditing';

function makeChartData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		title: 'Sales',
		chartType: 'bar',
		categories: ['Jan', 'Feb', 'Mar'],
		series: [{ name: 'Revenue', values: [10, 20, 30] }],
		grouping: 'clustered',
		...overrides,
	};
}

function makeChartElement(data: PptxChartData): ChartPptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: data,
	} as ChartPptxElement;
}

/** Build the editing bundle over a fixed snapshot + a capturing emit. */
function setup(data: PptxChartData) {
	const el = makeChartElement(data);
	const emitted: PptxChartData[] = [];
	const editing = useChartEditing(
		computed(() => el),
		computed(() => data),
		(next) => emitted.push(next),
	);
	return { el, emitted, editing };
}

describe('useChartEditing', () => {
	it('patchChartData adapts grouping when switching to an ungrouped type', () => {
		const { emitted, editing } = setup(makeChartData());
		editing.patchChartData({ chartType: 'pie' });
		expect(emitted).toHaveLength(1);
		expect(emitted[0].chartType).toBe('pie');
		expect(emitted[0].grouping).toBeUndefined();
	});

	it('updateStyle merges into the existing style object', () => {
		const { emitted, editing } = setup(makeChartData({ style: { hasLegend: true } }));
		editing.updateStyle({ hasDataLabels: true });
		expect(emitted[0].style).toStrictEqual({ hasLegend: true, hasDataLabels: true });
	});

	it('updateAxis creates a new axis entry when none exists', () => {
		const { emitted, editing } = setup(makeChartData());
		editing.updateAxis('valAx', { min: 0, max: 100 });
		expect(emitted[0].axes).toStrictEqual([{ axisType: 'valAx', min: 0, max: 100 }]);
	});

	it('updateAxis merges into an existing axis entry', () => {
		const { emitted, editing } = setup(makeChartData({ axes: [{ axisType: 'valAx', min: 0 }] }));
		editing.updateAxis('valAx', { max: 50 });
		expect(emitted[0].axes).toStrictEqual([{ axisType: 'valAx', min: 0, max: 50 }]);
	});

	it('setSeriesColor sets and clears a series colour', () => {
		const { emitted, editing } = setup(makeChartData());
		editing.setSeriesColor(0, '#ff0000');
		expect(emitted[0].series[0].color).toBe('#ff0000');
		editing.setSeriesColor(0, null);
		expect(emitted[1].series[0].color).toBeUndefined();
	});

	it('setSeriesTrendline wraps the trendline in the series array', () => {
		const { emitted, editing } = setup(makeChartData());
		editing.setSeriesTrendline(0, { trendlineType: 'linear' });
		expect(emitted[0].series[0].trendlines).toStrictEqual([{ trendlineType: 'linear' }]);
		editing.setSeriesTrendline(0, null);
		expect(emitted[1].series[0].trendlines).toStrictEqual([]);
	});

	it('setSeriesErrorBars wraps the error bars in the series array', () => {
		const { emitted, editing } = setup(makeChartData());
		editing.setSeriesErrorBars(0, {
			direction: 'y',
			barType: 'both',
			valType: 'percentage',
			val: 5,
		});
		expect(emitted[0].series[0].errBars).toStrictEqual([
			{ direction: 'y', barType: 'both', valType: 'percentage', val: 5 },
		]);
	});

	it('setAxisLogScale runs the core op against a clone (no live mutation)', () => {
		const data = makeChartData();
		const { el, emitted, editing } = setup(data);
		editing.setAxisLogScale('valAx', { enabled: true, base: 10 });
		const axis = emitted[0].axes?.find((a) => a.axisType === 'valAx');
		expect(axis?.logScale).toBeTruthy();
		expect(axis?.logBase).toBe(10);
		// Original element untouched.
		expect(el.chartData?.axes).toBeUndefined();
	});

	it('setSeriesMarker applies a marker via the core op', () => {
		const { emitted, editing } = setup(makeChartData({ chartType: 'line' }));
		editing.setSeriesMarker(0, { symbol: 'circle' });
		expect(emitted[0].series[0].marker?.symbol).toBe('circle');
	});

	it('setPointFill applies a per-point fill via the core op', () => {
		const { emitted, editing } = setup(makeChartData({ chartType: 'pie' }));
		editing.setPointFill(0, 1, '#00ff00');
		const point = emitted[0].series[0].dataPoints?.find((p) => p.idx === 1);
		expect(point?.spPr?.fillColor).toBe('#00ff00');
	});

	it('setPointExplosion applies a slice explosion via the core op', () => {
		const { emitted, editing } = setup(makeChartData({ chartType: 'pie' }));
		editing.setPointExplosion(0, 2, 25);
		const point = emitted[0].series[0].dataPoints?.find((p) => p.idx === 2);
		expect(point?.explosion).toBe(25);
	});

	it('does not emit when there is no chart data', () => {
		const emitFn = vi.fn();
		const editing = useChartEditing(
			computed(() => null),
			computed(() => null),
			emitFn,
		);
		editing.patchChartData({ title: 'x' });
		editing.setAxisLogScale('valAx', { enabled: true });
		expect(emitFn).not.toHaveBeenCalled();
	});
});
