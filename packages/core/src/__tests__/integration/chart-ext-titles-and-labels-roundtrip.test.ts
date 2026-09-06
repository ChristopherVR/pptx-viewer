import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { ChartPptxElement, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * limitations.md "Office chart extensions (c15:/c16:/c16r3:)" row, the
 * three remaining passthrough-only members: `c15:filteredSeriesTitle` /
 * `c15:filteredCategoryTitle` (chart-ext-filtered-titles.pptx) and
 * `c15:datalabelsRange`/`c15:dlblRangeCache`/`c15:xForSave`
 * (chart-ext-datalabels-range.pptx). Neither was reproducible via
 * PowerPoint 2016 COM automation (see scripts/make-chart-ext-fixtures.ps1);
 * both fixtures start from a genuine COM-authored chart and have the
 * extension under test hand-authored into it per the published
 * [MS-ODRAWXML] schema, verified only via `pptx-com-open.ps1` (PowerPoint
 * opens the file with no repair and the same shape/slide counts as the
 * unedited base) rather than a PowerPoint re-save, because PowerPoint's own
 * SaveAs silently drops this foreign extLst content instead of preserving
 * it (see the manifest notes for both fixtures).
 */
const TITLES_FIXTURE = requireFixture(
	fileURLToPath(
		new URL('../../../../../e2e/fixtures/chart-ext-filtered-titles.pptx', import.meta.url),
	),
);
const DATALABELS_RANGE_FIXTURE = requireFixture(
	fileURLToPath(
		new URL('../../../../../e2e/fixtures/chart-ext-datalabels-range.pptx', import.meta.url),
	),
);

function loadFixtureBytes(path: string): Uint8Array {
	const buf = readFileSync(path);
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

describe('c15:filteredSeriesTitle / c15:filteredCategoryTitle round-trip', () => {
	it('parses both titles onto PptxChartData', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes(TITLES_FIXTURE)));
		const chart = chartOnSlide(data, 0);

		expect(chart.chartData?.filteredSeriesTitle).toBe('Series 3');
		expect(chart.chartData?.filteredCategoryTitle).toStrictEqual(['5', '6', '7']);
		// The pre-existing filteredSeries extension in the same ext must still
		// parse correctly alongside the new sibling extensions.
		expect(chart.chartData?.filteredSeries).toHaveLength(1);
	});

	it('leaves an untouched chart part byte-identical, including both new extensions', async () => {
		const originalBytes = loadFixtureBytes(TITLES_FIXTURE);
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(originalBytes));

		const savedBytes = await handler.save(data.slides);

		const originalXml = await readZipEntry(originalBytes, 'ppt/charts/chart1.xml');
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');
		expect(savedXml).toBe(originalXml);
		expect(savedXml).toContain('c15:filteredSeriesTitle');
		expect(savedXml).toContain('c15:filteredCategoryTitle');
	});
});

describe('c15:datalabelsRange / c15:dlblRangeCache / c15:xForSave round-trip', () => {
	it('parses the series-wide range formula, cache, and per-point xForSave', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes(DATALABELS_RANGE_FIXTURE)));
		const chart = chartOnSlide(data, 0);
		const series = chart.chartData?.series[0];

		expect(series?.dataLabelOptions?.dataLabelsRange).toStrictEqual({
			formula: 'Sheet1!$D$2:$D$5',
			cache: ['Low', 'Medium', 'High', 'Top'],
		});
		expect(series?.dataLabelOptions?.showDataLabelsRange).toBeTruthy();
		expect(series?.dataLabels?.find((l) => l.idx === 0)?.savedForCompatibilityOnly).toBeTruthy();
	});

	it('leaves an untouched chart part byte-identical, including all three extensions', async () => {
		const originalBytes = loadFixtureBytes(DATALABELS_RANGE_FIXTURE);
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(originalBytes));

		const savedBytes = await handler.save(data.slides);

		const originalXml = await readZipEntry(originalBytes, 'ppt/charts/chart1.xml');
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');
		expect(savedXml).toBe(originalXml);
		expect(savedXml).toContain('c15:datalabelsRange');
		expect(savedXml).toContain('c15:xForSave');
	});

	it('keeps c15:xForSave when the point is re-serialized after an unrelated edit', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes(DATALABELS_RANGE_FIXTURE)));
		const chart = chartOnSlide(data, 0);
		// Edit a DIFFERENT field on the same point so buildDLbl rebuilds the
		// node from the model instead of leaving it untouched.
		chart.chartData!.series[0]!.dataLabels = chart.chartData!.series[0]!.dataLabels!.map((label) =>
			label.idx === 0 ? { ...label, position: 'outEnd' } : label,
		);

		const savedBytes = await handler.save(data.slides);
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');
		expect(savedXml).toContain('c15:xForSave');

		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		const reloadedLabel = chartOnSlide(reloaded, 0).chartData?.series[0]?.dataLabels?.[0];
		expect(reloadedLabel?.savedForCompatibilityOnly).toBeTruthy();
		expect(reloadedLabel?.position).toBe('outEnd');
	});

	it('re-derives c15:dlblRangeCache when the editor changes a cached label', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes(DATALABELS_RANGE_FIXTURE)));
		const chart = chartOnSlide(data, 0);
		const series = chart.chartData!.series[0]!;
		const range = series.dataLabelOptions!.dataLabelsRange!;
		chart.chartData!.series[0] = {
			...series,
			dataLabelOptions: {
				...series.dataLabelOptions,
				dataLabelsRange: { ...range, cache: ['Low', 'Renamed', 'High', 'Top'] },
			},
		};

		const savedBytes = await handler.save(data.slides);
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart1.xml');
		expect(savedXml).toContain('<c:v>Renamed</c:v>');
		expect(savedXml).not.toContain('<c:v>Medium</c:v>');
		// The formula itself is untouched by this edit.
		expect(savedXml).toContain('Sheet1!$D$2:$D$5');

		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		const reloadedSeries = chartOnSlide(reloaded, 0).chartData?.series[0];
		expect(reloadedSeries?.dataLabelOptions?.dataLabelsRange).toStrictEqual({
			formula: 'Sheet1!$D$2:$D$5',
			cache: ['Low', 'Renamed', 'High', 'Top'],
		});
	});
});
