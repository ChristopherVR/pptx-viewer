/**
 * Explicit chart series colours must win over the fallback palette, and the
 * two shared entry points must agree on what that fallback palette IS.
 *
 * Regression tests for the cross-binding divergence where Angular (through
 * `chart-view-model`'s `DEFAULT_PALETTE`) painted Office accents while the
 * other four (through `chart-helpers`' `DEFAULT_CHART_PALETTE`) painted a
 * Tailwind-ish set for the very same unstyled chart.
 */
import type { PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { computeBoxWhiskerGeometry } from './chart-box-whisker';
import { computeFunnelSegments } from './chart-funnel-sunburst';
import {
	DEFAULT_CHART_PALETTE,
	seriesColor as helpersSeriesColor,
	paletteColor as helpersPaletteColor,
} from './chart-helpers';
import { DEFAULT_PALETTE, paletteColor, seriesColor } from './chart-view-model';

function series(partial: Partial<PptxChartSeries>): PptxChartSeries {
	return { name: 's', values: [1, 2, 3], ...partial } as PptxChartSeries;
}

describe('one default palette', () => {
	it('chart-helpers and chart-view-model share the identical fallback palette', () => {
		expect([...DEFAULT_CHART_PALETTE]).toStrictEqual([...DEFAULT_PALETTE]);
	});

	it('is the Office accent cycle, as PowerPoint paints for an unstyled chart', () => {
		expect(DEFAULT_CHART_PALETTE[0]).toBe('#4472C4');
		expect(DEFAULT_CHART_PALETTE[1]).toBe('#ED7D31');
	});

	it('both paletteColor entry points agree with no palette supplied', () => {
		for (const index of [0, 1, 5, 9]) {
			expect(helpersPaletteColor(index, undefined, undefined)).toBe(paletteColor(index, undefined));
		}
	});
});

describe('explicit series colour wins', () => {
	it('series.color beats the palette in both seriesColor entry points', () => {
		const s = series({ color: '#123456' });
		expect(seriesColor(s, 0, undefined)).toBe('#123456');
		expect(helpersSeriesColor(s, 0, undefined, undefined)).toBe('#123456');
	});

	it('a scatter series with only a marker fill takes the marker colour', () => {
		// c:ser/c:spPr/a:ln/a:noFill + c:marker/c:spPr/a:solidFill: the points
		// paint the marker fill, so the resolved series colour (legend swatch)
		// must match it rather than fall back to the palette.
		const s = series({ marker: { symbol: 'circle', spPr: { fillColor: '#ED7D31' } } });
		expect(seriesColor(s, 3, undefined)).toBe('#ED7D31');
		expect(helpersSeriesColor(s, 3, undefined, undefined)).toBe('#ED7D31');
	});

	it('funnel segments take the explicit series colour over the per-segment cycle', () => {
		const segments = computeFunnelSegments(
			[3, 2, 1],
			0,
			0,
			100,
			90,
			['a', 'b', 'c'],
			undefined,
			'#70AD47',
		);
		expect(segments.map((seg) => seg.fill)).toStrictEqual(['#70AD47', '#70AD47', '#70AD47']);
	});

	it('funnel segments still cycle the palette without an explicit colour', () => {
		const segments = computeFunnelSegments([3, 2, 1], 0, 0, 100, 90, ['a', 'b', 'c'], undefined);
		expect(segments.map((seg) => seg.fill)).toStrictEqual([
			DEFAULT_PALETTE[0],
			DEFAULT_PALETTE[1],
			DEFAULT_PALETTE[2],
		]);
	});

	it('box-whisker boxes take the explicit series colour over the per-category cycle', () => {
		const chartData = {
			chartType: 'boxWhisker',
			categories: ['a', 'b'],
			series: [series({ values: [1, 2] }), series({ values: [3, 4] }), series({ values: [5, 6] })],
		};
		const layout = {
			svgWidth: 200,
			svgHeight: 100,
			plotLeft: 10,
			plotTop: 10,
			plotWidth: 180,
			plotHeight: 80,
			plotBottom: 90,
			plotRight: 190,
		};
		const range = { min: 0, max: 10, span: 10 };
		const boxes = computeBoxWhiskerGeometry(
			chartData as never,
			2,
			layout as never,
			range,
			undefined,
			'#FFC000',
		);
		expect(boxes.map((box) => box.fill)).toStrictEqual(['#FFC000', '#FFC000']);
	});
});
