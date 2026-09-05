import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildStockCloseLabel } from './chart-stock-close-label';

const frame = { width: 400, height: 300 };

function chart(closeSeries: Partial<PptxChartSeries>): {
	chartData: PptxChartData;
	closeSeries: PptxChartSeries;
} {
	const series: PptxChartSeries = { name: 'Close', values: [103], ...closeSeries };
	return {
		chartData: { chartType: 'stock', categories: ['D1'], series: [series], style: {} },
		closeSeries: series,
	};
}

describe('buildStockCloseLabel', () => {
	it('returns undefined when the label resolves to nothing (deleted point)', () => {
		const { chartData, closeSeries } = chart({ dataLabels: [{ idx: 0, deleted: true }] });
		expect(buildStockCloseLabel(chartData, closeSeries, 0, 103, 50, 60, frame)).toBeUndefined();
	});

	it('defaults to the right of the tick (start-anchored) when no c:dLblPos is authored', () => {
		const { chartData, closeSeries } = chart({});
		const label = buildStockCloseLabel(chartData, closeSeries, 0, 103, 50, 60, frame);
		expect(label?.textAnchor).toBe('start');
		expect(label?.text).toBe('103');
	});

	it("honours the close series' own c:dLblPos", () => {
		const { chartData, closeSeries } = chart({ dataLabelOptions: { position: 't' } });
		const label = buildStockCloseLabel(chartData, closeSeries, 0, 103, 50, 60, frame);
		expect(label?.textAnchor).toBe('middle');
		expect(label?.y).toBeLessThan(60);
	});

	it("carries a [Red]/[Blue] number-format colour from the close series' own format", () => {
		const { chartData, closeSeries } = chart({ numberFormat: '#,##0;[Red]-#,##0' });
		closeSeries.values = [-5];
		const label = buildStockCloseLabel(chartData, closeSeries, 0, -5, 50, 60, frame);
		expect(label?.text).toBe('-5');
		expect(label?.fill).toBe('#FF0000');
	});

	it('shifts the label by a per-point c:dLbl/c:layout manual drag', () => {
		const { chartData, closeSeries } = chart({
			dataLabels: [{ idx: 0, layout: { x: 0.1, xMode: 'factor' } }],
		});
		const withoutDrag = buildStockCloseLabel(
			chart({}).chartData,
			chart({}).closeSeries,
			0,
			103,
			50,
			60,
			frame,
		);
		const withDrag = buildStockCloseLabel(chartData, closeSeries, 0, 103, 50, 60, frame);
		expect(withDrag?.x).toBeCloseTo((withoutDrag?.x ?? 0) + 0.1 * frame.width, 5);
	});
});
