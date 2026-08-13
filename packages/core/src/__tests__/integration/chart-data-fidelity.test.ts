import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { ChartPptxElement, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * Ground-truth parse coverage for chart SERIES DATA, against a deck authored by
 * the real PowerPoint through COM (`scripts`-free; see the manifest entry).
 *
 * Every assertion here pins something the engine used to guess:
 *  - slide 1 (bubble): `c:bubbleSize` was never read by any parser, so bubble
 *    radii came from a "the third series is the size" heuristic that also
 *    deleted series 3+ from the plot. `c:xVal` is per series too.
 *  - slide 2 (scatter): `c:scatterStyle` was never read, and PowerPoint writes
 *    `lineMarker` + `c:symbol val="none"` for a lines-only scatter, so the
 *    series rendered as nothing at all.
 *  - slide 3 (column): `c:strCache` is SPARSE (`ptCount=5`, no `idx=2`) while
 *    `c:numCache` is dense. Collapsing the categories to a dense list left them
 *    shorter than the values, which truncated the plot and shifted the labels.
 *  - slide 4 (pie): the content flags live on the SERIES `c:dLbls`; the
 *    chart-type-level group PowerPoint writes alongside it is all zeros.
 */
const FIXTURE = requireFixture(
	fileURLToPath(new URL('../../../../../e2e/fixtures/chart-data-fidelity.pptx', import.meta.url)),
);

async function loadFixture(): Promise<PptxData> {
	const buf = readFileSync(FIXTURE);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new PptxHandler().load(ab);
}

function chartOnSlide(data: PptxData, slideIndex: number): ChartPptxElement {
	const chart = data.slides[slideIndex]?.elements.find(
		(element): element is ChartPptxElement => element.type === 'chart',
	);
	if (!chart) {
		throw new Error(`no chart element on slide ${slideIndex + 1}`);
	}
	return chart;
}

describe('chart-data-fidelity fixture (PowerPoint-authored)', () => {
	it('parses c:bubbleSize and c:xVal per bubble series', async () => {
		const chart = chartOnSlide(await loadFixture(), 0);
		expect(chart.chartData?.chartType).toBe('bubble');
		const series = chart.chartData?.series ?? [];
		expect(series).toHaveLength(3);
		for (const entry of series) {
			expect(entry.bubbleSizes).toHaveLength(3);
			expect(entry.xValues).toStrictEqual([1, 2, 3]);
		}
		// Each series owns a DIFFERENT size channel; the old heuristic could only
		// ever have produced one.
		expect(series[0].bubbleSizes).toStrictEqual([4, 9, 2]);
		expect(series[1].bubbleSizes).toStrictEqual([7, 3, 12]);
		expect(series[2].bubbleSizes).toStrictEqual([2, 8, 5]);
	});

	it('parses c:scatterStyle and the per-series a:ln/marker markup', async () => {
		const chart = chartOnSlide(await loadFixture(), 1);
		expect(chart.chartData?.chartType).toBe('scatter');
		expect(chart.chartData?.scatterStyle).toBe('lineMarker');
		const series = chart.chartData?.series ?? [];
		expect(series).toHaveLength(2);
		for (const entry of series) {
			// A drawn line plus suppressed markers: the combination that rendered
			// as an entirely invisible series.
			expect(entry.marker?.symbol).toBe('none');
			expect(entry.lineNoFill).toBeUndefined();
			expect(entry.xValues).toStrictEqual([0, 5, 10, 15]);
		}
		expect(series[0].values).toStrictEqual([1, 4, 9, 16]);
		expect(series[1].values).toStrictEqual([9, 7, 5, 2]);
	});

	it('keeps a blank category in place instead of shortening the axis', async () => {
		const chart = chartOnSlide(await loadFixture(), 2);
		// ptCount is 5 with idx 2 absent: the blank has to survive as a
		// placeholder or the fifth value never plots.
		expect(chart.chartData?.categories).toStrictEqual(['North', 'South', '', 'East', 'West']);
		expect(chart.chartData?.series[0]?.values).toStrictEqual([12, 25, 7, 31, 18]);
		expect(chart.chartData?.categories).toHaveLength(
			chart.chartData?.series[0]?.values.length ?? 0,
		);
	});

	it('parses the SERIES-level data-label content flags on a pie', async () => {
		const chart = chartOnSlide(await loadFixture(), 3);
		const options = chart.chartData?.series[0]?.dataLabelOptions;
		expect({
			showPercent: options?.showPercent,
			showCategory: options?.showCategory,
			showValue: options?.showValue,
			// PowerPoint wrote `<c:separator>, </c:separator>`: the trailing space
			// is what puts the gap in `Direct, 40%`, so it has to survive the
			// parse. The XML layer used to trim every text node except `a:t`,
			// which dropped it; see utils/xml-whitespace.
			separator: options?.separator,
		}).toStrictEqual({
			showPercent: true,
			showCategory: true,
			showValue: false,
			separator: ', ',
		});
		// The chart-type-level group PowerPoint writes next to it says nothing is
		// shown, which is why reading only that level reported "raw values".
		expect({ chartLevel: chart.chartData?.style?.dataLabels?.showPercent }).toStrictEqual({
			chartLevel: false,
		});
	});
});
