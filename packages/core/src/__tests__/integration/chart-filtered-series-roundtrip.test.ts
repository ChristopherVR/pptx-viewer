import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { ChartPptxElement, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * PowerPoint "Chart Filters" (limitations.md "Office chart extensions
 * (c15:/c16:/c16r3:)" row): confirms a series hidden via `Series.IsFiltered`
 * (COM ground truth, `chart-filtered-series.pptx`) is (1) modelled into
 * {@link PptxChartData.filteredSeries} rather than silently invisible, (2)
 * never counted among the plotted series, (3) preserved byte-identical when
 * the chart is untouched, and (4) does not collide with a newly added
 * visible series' `c:idx` after an edit (see chart-filtered-series.ts).
 */
const FIXTURE = requireFixture(
	fileURLToPath(new URL('../../../../../e2e/fixtures/chart-filtered-series.pptx', import.meta.url)),
);

function loadFixtureBytes(): Uint8Array {
	const buf = readFileSync(FIXTURE);
	return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function readZipEntry(bytes: Uint8Array, path: string): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file(path);
	if (!file) {
		throw new Error(`missing ${path} in package`);
	}
	return file.async('string');
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

describe('chart filtered-series round-trip (c15:filteredBarSeries)', () => {
	it('parses the hidden series into filteredSeries without plotting it', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes()));
		const chart = chartOnSlide(data, 0);

		// Series A and Series C are visible; Series B was filtered.
		expect(chart.chartData?.series.map((s) => s.name)).toStrictEqual(['Series A', 'Series C']);

		const filtered = chart.chartData?.filteredSeries;
		expect(filtered).toHaveLength(1);
		expect(filtered?.[0]).toMatchObject({
			idx: 1,
			order: 1,
			name: 'Series B',
			categories: ['Cat1', 'Cat2', 'Cat4'],
			values: [20, 21, 23],
		});
		expect(filtered?.[0]?.uniqueId).toMatch(/^\{[0-9A-F-]{36}\}$/u);
	});

	it('leaves an untouched chart part byte-identical, including the filter extension', async () => {
		const originalBytes = loadFixtureBytes();
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(originalBytes));

		const savedBytes = await handler.save(data.slides);

		const originalXml = await readZipEntry(originalBytes, 'ppt/charts/chart1.xml');
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');
		expect(savedXml).toBe(originalXml);
		expect(savedXml).toContain('c15:filteredBarSeries');
	});

	it('gives a new series added after the edit a c:idx that does not collide with the filtered series', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes()));
		const chart = chartOnSlide(data, 0);

		// Two visible series (idx 0, 2) plus the filtered one (idx 1). Add a
		// fourth (visible) series: before the fix, this would have reassigned
		// idx 0/1 to the two existing visible series (positional 0..1), landing
		// idx 1 on top of the still-untouched filtered series.
		chart.chartData!.series.push({ name: 'Series D', values: [40, 41, 42] });

		const savedBytes = await handler.save(data.slides);
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');

		// The filtered series' own idx must still be exactly 1.
		const filteredSeriesXml = savedXml.slice(savedXml.indexOf('c15:filteredBarSeries'));
		expect(filteredSeriesXml).toContain('<c:idx val="1"');

		// Reload and confirm every VISIBLE c:ser has a distinct idx, none of
		// them 1 (reserved by the filtered series).
		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		const reloadedChart = chartOnSlide(reloaded, 0);
		expect(reloadedChart.chartData?.series.map((s) => s.name)).toStrictEqual([
			'Series A',
			'Series C',
			'Series D',
		]);
		// The filtered series must still round-trip untouched.
		expect(reloadedChart.chartData?.filteredSeries).toHaveLength(1);
		expect(reloadedChart.chartData?.filteredSeries?.[0]?.idx).toBe(1);

		const idxMatches = [...savedXml.matchAll(/<c:idx val="(\d+)"/gu)].map((m) => Number(m[1]));
		// Every c:idx value in the whole part (visible series + filtered
		// series) must be unique.
		expect(new Set(idxMatches).size).toBe(idxMatches.length);
	});
});
