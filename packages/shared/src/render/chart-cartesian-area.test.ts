/**
 * Tests for `buildAreas`, focused on the percentStacked data-label centring
 * fix (limitations.md "Percent-stacked data labels": labels must sit at the
 * centre of the VISIBLE segment, not a fixed offset above the top line).
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildAreas } from './chart-cartesian-area';
import type { PlotLayout, ValueRange } from './chart-view-model';
import { valueToY } from './chart-view-model';

const layout: PlotLayout = {
	svgWidth: 400,
	svgHeight: 300,
	plotLeft: 40,
	plotTop: 8,
	plotRight: 392,
	plotBottom: 276,
	plotWidth: 352,
	plotHeight: 268,
};
const percentRange: ValueRange = { min: 0, max: 100, span: 100 };

function percentStackedChart(values: number[][]): PptxChartData {
	return {
		chartType: 'area',
		categories: values[0].map((_v, i) => `C${i}`),
		series: values.map((v, i) => ({ name: `S${i}`, values: v })),
		style: { hasDataLabels: true },
	};
}

describe('buildAreas percentStacked labels (limitations.md "Percent-stacked data labels")', () => {
	it('centres a normal (non-skewed) segment label at its own band midpoint', () => {
		const chartData = percentStackedChart([[50], [50]]);
		const result = buildAreas(chartData, 1, layout, percentRange, [0], undefined, 'percentStacked');
		// Series 0: band from 0 to 50 (%). Series 1: band from 50 to 100 (%).
		const label0 = result.dataLabels.find((l) => l.text === '50%' && l.fill === '#ffffff');
		expect(label0).toBeDefined();
		const expectedMidY =
			(valueToY(0, percentRange, layout.plotTop, layout.plotBottom) +
				valueToY(50, percentRange, layout.plotTop, layout.plotBottom)) /
			2;
		// One of the two 50% labels must land on the lower band's midpoint.
		expect(result.dataLabels.some((l) => Math.abs((l.y ?? 0) - expectedMidY) < 0.01)).toBeTruthy();
	});

	it('keeps a tiny segment label centred on its own thin band rather than floating above it', () => {
		// Series 0 is a tiny 2% sliver at the bottom of a heavily skewed category;
		// series 1 takes the remaining 98%.
		const chartData = percentStackedChart([[2], [98]]);
		const result = buildAreas(chartData, 1, layout, percentRange, [0], undefined, 'percentStacked');
		const tinyLabel = result.dataLabels.find((l) => l.text === '2%');
		expect(tinyLabel).toBeDefined();
		const bandTop = valueToY(2, percentRange, layout.plotTop, layout.plotBottom),
			bandBottom = valueToY(0, percentRange, layout.plotTop, layout.plotBottom),
			expectedMidY = (bandTop + bandBottom) / 2;
		expect(tinyLabel?.y).toBeCloseTo(expectedMidY, 5);
		// Still drawn even though the 2%-tall band is visually thin.
		expect(tinyLabel?.dominantBaseline).toBe('central');
	});

	it('renders white bold text centred inside the filled band, matching stacked bar', () => {
		const chartData = percentStackedChart([[30], [70]]);
		const result = buildAreas(chartData, 1, layout, percentRange, [0], undefined, 'percentStacked');
		for (const label of result.dataLabels) {
			expect(label.fill).toBe('#ffffff');
			expect(label.fontWeight).toBe('bold');
			expect(label.dominantBaseline).toBe('central');
		}
	});

	it('suppresses the label for a zero-value segment', () => {
		const chartData = percentStackedChart([[0], [100]]);
		const result = buildAreas(chartData, 1, layout, percentRange, [0], undefined, 'percentStacked');
		expect(result.dataLabels.some((l) => l.text === '0%')).toBeFalsy();
	});
});
