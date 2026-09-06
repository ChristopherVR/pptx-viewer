import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { ChartPptxElement, PptxChartSeries, PptxData } from '../../index';
import { requireFixture } from '../require-fixture';

/**
 * `c15:`/`c16:`/`c16r3:` chart extension round-trip (limitations.md "Office
 * extension chart markup"): confirms an UNTOUCHED chart keeps these
 * extensions byte-identical on save, and that a chart EDIT (adding a new
 * series by cloning an existing one as a template) does not duplicate the
 * template's `c16:uniqueId` onto the new series (see
 * chart-series-identity.ts).
 */
const FIXTURE = requireFixture(
	fileURLToPath(new URL('../../../../../e2e/fixtures/chart-data-fidelity.pptx', import.meta.url)),
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

describe('chart extension round-trip (c15/c16/c16r3)', () => {
	it('leaves an untouched chart part byte-identical, including every extLst', async () => {
		const originalBytes = loadFixtureBytes();
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(originalBytes));

		// No edits at all - a plain load/save round trip.
		const savedBytes = await handler.save(data.slides);

		const originalXml = await readZipEntry(originalBytes, 'ppt/charts/chart4.xml');
		const savedXml = await readZipEntry(savedBytes, 'ppt/charts/chart4.xml');
		expect(savedXml).toBe(originalXml);

		// Spelled out explicitly too, so a future refactor that happens to keep
		// the file byte-identical for the wrong reason still gets caught if any
		// of these specific extension fragments regress.
		expect(savedXml).toContain(
			'<c:extLst><c:ext uri="{C3380CC4-5D6E-409C-BE32-E72D297353CC}" xmlns:c16="http://schemas.microsoft.com/office/drawing/2014/chart"><c16:uniqueId val="{00000000-9E1A-42B0-83D9-C8460AD0BBCB}"/></c:ext></c:extLst>',
		);
		expect(savedXml).toContain(
			'<c:leaderLines><c:spPr><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="35000"/><a:lumOff val="65000"/></a:schemeClr></a:solidFill><a:round/></a:ln><a:effectLst/></c:spPr></c:leaderLines>',
		);
		expect(savedXml).toContain(
			'<c:extLst><c:ext uri="{56B9EC1D-385E-4148-901F-78D8002777C0}" xmlns:c16r3="http://schemas.microsoft.com/office/drawing/2017/03/chart"><c16r3:dataDisplayOptions16><c16r3:dispNaAsBlank val="1"/></c16r3:dataDisplayOptions16></c:ext></c:extLst>',
		);
	});

	it('gives a series added by cloning an existing one a DIFFERENT c16:uniqueId', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(toArrayBuffer(loadFixtureBytes()));
		// Slide 1's bubble chart: three series, each with its own c16:uniqueId
		// (see chart-data-fidelity integration test for the parsed values).
		const chart = chartOnSlide(data, 0);
		const templateUniqueId = chart.chartData?.series[0]?.uniqueId;
		expect(templateUniqueId).toBeDefined();

		const clonedSeries: PptxChartSeries = {
			name: 'Series 4',
			values: [1, 2, 3],
			xValues: [1, 2, 3],
			bubbleSizes: [1, 1, 1],
		};
		chart.chartData!.series.push(clonedSeries);

		const savedBytes = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(toArrayBuffer(savedBytes));
		const reloadedChart = chartOnSlide(reloaded, 0);
		const uniqueIds = reloadedChart.chartData?.series.map((series) => series.uniqueId) ?? [];

		expect(uniqueIds).toHaveLength(4);
		expect(uniqueIds.every((id) => id !== undefined)).toBeTruthy();
		// No two series share an identity, and the new (4th) series specifically
		// did not inherit the template's (1st series') id.
		expect(new Set(uniqueIds).size).toBe(4);
		expect(uniqueIds[3]).not.toBe(templateUniqueId);
	});
});
