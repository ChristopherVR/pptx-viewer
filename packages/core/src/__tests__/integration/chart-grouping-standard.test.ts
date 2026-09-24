/**
 * `c:grouping val="standard"` on a 3D bar chart: `grouping` folds it into
 * `'clustered'` (a 2D bar chart draws the two the same), `groupingStandard`
 * keeps the distinction for the 3D renderer (each series on its own depth
 * row), and a save writes `standard` back instead of silently turning the
 * chart into a clustered one.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement, PptxSlide } from '../../core/types';
import { requireFixture } from '../require-fixture';

const DECK = path.resolve(
	__dirname,
	'../../../../../e2e/fixtures/three-d-parity/three-d-charts.pptx',
);

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

function chartOn(slides: PptxSlide[], n: number): ChartPptxElement {
	return slides[n - 1].elements.find((e) => e.type === 'chart') as ChartPptxElement;
}

describe('c:grouping val="standard"', () => {
	it('loads as clustered with groupingStandard set, and only on the standard chart', async () => {
		const data = await new PptxHandler().load(toArrayBuffer(readFileSync(requireFixture(DECK))));
		const standard = chartOn(data.slides, 4).chartData!;
		expect(standard.grouping).toBe('clustered');
		expect(standard.groupingStandard).toBeTruthy();
		expect(chartOn(data.slides, 1).chartData!.groupingStandard).toBeUndefined();
	});

	it('writes standard back when the chart data is re-serialised', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(readFileSync(requireFixture(DECK))));
		const chart = chartOn(data.slides, 4);
		// Touch the data so the chart part is regenerated from chartData.
		chart.chartData = {
			...chart.chartData!,
			series: chart.chartData!.series.map((s, i) =>
				i === 0 ? { ...s, values: s.values.map((v) => v + 1) } : s,
			),
		};
		const zip = await JSZip.loadAsync(await handler.save(data.slides));
		const xml = await zip.file('ppt/charts/chart4.xml')!.async('string');
		expect(xml).toMatch(/<c:grouping val="standard"/u);

		const reloaded = await new PptxHandler().load(
			toArrayBuffer(await zip.generateAsync({ type: 'uint8array' })),
		);
		expect(chartOn(reloaded.slides, 4).chartData!.groupingStandard).toBeTruthy();
	});
});
