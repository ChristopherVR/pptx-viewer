import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { ChartPptxElement, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * Closes the "edited chart data never rewrites the embedded workbook" gap:
 * a PowerPoint chart caches its data twice (`c:numCache`/`c:strCache` in the
 * chart part, and a real `.xlsx` under `ppt/embeddings/`), and only the
 * first copy used to be touched on save. These tests pin the write-back
 * against a deck authored by real PowerPoint (`chart-data-fidelity.pptx`,
 * slide 3's bar chart, whose series/category ranges are real `c:f`
 * references into `Microsoft_Excel_Worksheet2.xlsx`), not a fabricated one.
 */
const FIXTURE = requireFixture(
	fileURLToPath(new URL('../../../../../e2e/fixtures/chart-data-fidelity.pptx', import.meta.url)),
);
const EMBEDDING_PATH = 'ppt/embeddings/Microsoft_Excel_Worksheet2.xlsx';

function loadFixtureBytes(): Uint8Array {
	const buf = readFileSync(FIXTURE);
	return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function barChart(data: PptxData): ChartPptxElement {
	const chart = data.slides[2]?.elements.find(
		(element): element is ChartPptxElement => element.type === 'chart',
	);
	if (!chart) {
		throw new Error('expected a chart element on slide 3');
	}
	return chart;
}

async function readEmbeddedSheetXml(pptxBytes: Uint8Array, embeddingPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(pptxBytes);
	const xlsxFile = zip.file(embeddingPath);
	if (!xlsxFile) {
		throw new Error(`missing ${embeddingPath} in saved package`);
	}
	const xlsxZip = await JSZip.loadAsync(await xlsxFile.async('uint8array'));
	const sheetFile = xlsxZip.file('xl/worksheets/sheet1.xml');
	if (!sheetFile) {
		throw new Error('missing xl/worksheets/sheet1.xml in embedded workbook');
	}
	return sheetFile.async('string');
}

function numericCellValue(sheetXml: string, ref: string): string | undefined {
	const match = new RegExp(`<c r="${ref}"[^>]*><v>([^<]*)</v></c>`, 'u').exec(sheetXml);
	return match?.[1];
}

describe('embedded chart workbook write-back', () => {
	it('rewrites the linked xlsx cells an edited series references', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes()));
		const chart = barChart(data);

		// Ground truth from the real PowerPoint-authored file: c:val references
		// Sheet1!$B$2:$B$6 in Microsoft_Excel_Worksheet2.xlsx.
		expect(chart.chartData?.series[0].values).toStrictEqual([12, 25, 7, 31, 18]);

		chart.chartData!.series[0].values = [100, 200, 300, 400, 500];

		const savedBytes = await handler.save(data.slides);
		const sheetXml = await readEmbeddedSheetXml(savedBytes, EMBEDDING_PATH);
		expect(numericCellValue(sheetXml, 'B2')).toBe('100');
		expect(numericCellValue(sheetXml, 'B3')).toBe('200');
		expect(numericCellValue(sheetXml, 'B4')).toBe('300');
		expect(numericCellValue(sheetXml, 'B5')).toBe('400');
		expect(numericCellValue(sheetXml, 'B6')).toBe('500');

		// The chart cache round-trips the same edit, so "Edit Data in Excel"
		// and the rendered chart now agree.
		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		expect(barChart(reloaded).chartData?.series[0].values).toStrictEqual([100, 200, 300, 400, 500]);
	});

	it('leaves an untouched chart embedded workbook byte-identical', async () => {
		const originalBytes = loadFixtureBytes();
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(originalBytes));

		// No edits to any chart's data - a plain load/save round trip.
		const savedBytes = await handler.save(data.slides);

		const originalZip = await JSZip.loadAsync(originalBytes);
		const savedZip = await JSZip.loadAsync(savedBytes);
		const originalXlsx = await originalZip.file(EMBEDDING_PATH)?.async('uint8array');
		const savedXlsx = await savedZip.file(EMBEDDING_PATH)?.async('uint8array');
		expect(originalXlsx).toBeDefined();
		expect(Buffer.from(savedXlsx!).equals(Buffer.from(originalXlsx!))).toBeTruthy();
	});

	it('degrades safely and reports a warning when the linked workbook cannot be found', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes()));
		const chart = barChart(data);

		// Point the external-data reference at a workbook the package does not
		// contain, simulating a broken/relocated link.
		chart.chartData!.externalData = {
			relId: 'rId3',
			targetPath: '../embeddings/DoesNotExist.xlsx',
			autoUpdate: false,
		};
		chart.chartData!.series[0].values = [1, 2, 3, 4, 5];

		const savedBytes = await handler.save(data.slides);

		// Cache-only degradation: the chart's own cached values still round-trip.
		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		expect(barChart(reloaded).chartData?.series[0].values).toStrictEqual([1, 2, 3, 4, 5]);

		const warnings = handler.getCompatibilityWarnings();
		expect(
			warnings.some(
				(warning) => warning.code === 'CHART_EMBEDDED_WORKBOOK_MISSING' && warning.scope === 'save',
			),
		).toBeTruthy();
	});
});
