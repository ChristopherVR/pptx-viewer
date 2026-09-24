/**
 * Unit tests for chart-legend-build.ts's trendline legend entries.
 *
 * Base per-series legend entries (colour, label, line-vs-rect swatch) are
 * covered under `chart-view-model.test.ts`; this file is specifically the
 * "add trendlines to the legend" behaviour, matching PowerPoint's own
 * `"Linear (Series1)"`-style entries.
 */
import type { PptxChartSeries, PptxChartTrendline } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildLegend } from './chart-legend-build';

function series(name: string, overrides: Partial<PptxChartSeries> = {}): PptxChartSeries {
	return { name, values: [1, 2, 3], ...overrides };
}

describe('buildLegend: trendline entries', () => {
	it('adds no extra entries when no series declares a trendline', () => {
		const { legend } = buildLegend([series('S1'), series('S2')], undefined, 400, 'b', 300, 20);
		expect(legend).toHaveLength(2);
	});

	it("adds one entry per trendline, right after that series' own entry", () => {
		const linear: PptxChartTrendline = { trendlineType: 'linear' };
		const { legend } = buildLegend(
			[series('S1', { trendlines: [linear] }), series('S2')],
			undefined,
			400,
			'b',
			300,
			20,
		);
		expect(legend.map((e) => e.label)).toStrictEqual(['S1', 'S2', 'Linear (S1)']);
	});

	it("uses Excel's own family prefixes (Expon., Poly., Power, Log.)", () => {
		const trendlines: PptxChartTrendline[] = [
			{ trendlineType: 'exponential' },
			{ trendlineType: 'polynomial', order: 3 },
			{ trendlineType: 'power' },
			{ trendlineType: 'logarithmic' },
			{ trendlineType: 'movingAvg', period: 2 },
		];
		const { legend } = buildLegend(
			[series('Revenue', { trendlines })],
			undefined,
			400,
			'b',
			300,
			20,
		);
		expect(legend.map((e) => e.label)).toStrictEqual([
			'Revenue',
			'Expon. (Revenue)',
			'Poly. (Revenue)',
			'Power (Revenue)',
			'Log. (Revenue)',
			'Moving Average (Revenue)',
		]);
	});

	it("honours the trendline's own c:name over the generated label", () => {
		const tl: PptxChartTrendline = { trendlineType: 'linear', name: 'My Custom Trend' };
		const { legend } = buildLegend(
			[series('S1', { trendlines: [tl] })],
			undefined,
			400,
			'b',
			300,
			20,
		);
		expect(legend[1].label).toBe('My Custom Trend');
	});

	it('draws a dashed line-style swatch for every trendline entry', () => {
		const tl: PptxChartTrendline = { trendlineType: 'linear', color: '#E97132' };
		const { legend } = buildLegend(
			[series('S1', { trendlines: [tl] })],
			undefined,
			400,
			'b',
			300,
			20,
		);
		const trendEntry = legend[1];
		expect(trendEntry.lineSwatch).toBeDefined();
		expect(trendEntry.lineSwatch?.primitives[0]?.kind).toBe('line');
		expect(trendEntry.color).toBe('#E97132');
	});

	it("falls back to the owning series' colour when the trendline authored none", () => {
		const tl: PptxChartTrendline = { trendlineType: 'linear' };
		const { legend } = buildLegend(
			[series('S1', { color: '#123456', trendlines: [tl] })],
			undefined,
			400,
			'b',
			300,
			20,
		);
		expect(legend[1].color).toBe('#123456');
	});
});
