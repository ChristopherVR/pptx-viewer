/**
 * Load -> edit -> save -> re-parse coverage for chart title rich text
 * (`PptxChartData.titleRuns`): `c:title/c:tx/c:rich` can carry more than one
 * run, each with its own bold/italic/size/color, but the pre-existing flat
 * `title: string` field only ever captured the first run's text and dropped
 * every per-run formatting attribute. Proves the typed multi-run field
 * round-trips, and that the flat `title` path still works when `titleRuns`
 * is absent.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeAll } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';
import type { PptxData } from '../../core/types/presentation';

function findChart(data: PptxData): ChartPptxElement {
	const el = data.slides[0]!.elements.find((e) => e.type === 'chart');
	if (!el || el.type !== 'chart') {
		throw new Error('chart not found');
	}
	return el;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function readChartXml(bytes: ArrayBuffer | Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const part = zip.file('ppt/charts/chart1.xml');
	if (!part) {
		throw new Error('chart part not found');
	}
	return part.async('string');
}

const ATTRIBUTED_TITLE_XML =
	'<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p>' +
	'<a:r><a:rPr lang="en-GB" b="1" sz="1800"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr>' +
	'<a:t xml:space="preserve">Sales </a:t></a:r>' +
	'<a:r><a:rPr lang="fr-FR" i="1" sz="1400"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:rPr>' +
	'<a:t>Overview</a:t></a:r>' +
	'</a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>';

const EMPTY_ATTRIBUTED_FIRST_RUN_TITLE_XML =
	'<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p>' +
	'<a:r><a:rPr b="1"/><a:t xml:space="preserve"></a:t></a:r>' +
	'<a:r><a:rPr i="1"/><a:t>Fallback</a:t></a:r>' +
	'</a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>';

async function buildAttributedTitleSeed(titleXml = ATTRIBUTED_TITLE_XML): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(await buildSeed());
	const part = zip.file('ppt/charts/chart1.xml');
	if (!part) {
		throw new Error('chart part not found');
	}
	const original = await part.async('string');
	const replaced = original.replace(/<c:title>[\s\S]*?<\/c:title>/u, titleXml);
	if (replaced === original) {
		throw new Error('generated chart title was not found');
	}
	zip.file('ppt/charts/chart1.xml', replaced);
	return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }));
}

async function buildSeed(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create({ initialSlideCount: 0 });
	const slide = createSlide('Blank')
		.addChart(
			'bar',
			{
				series: [{ name: 'Revenue', values: [1, 2, 3] }],
				categories: ['Jan', 'Feb', 'Mar'],
				title: 'Q4 Sales',
			},
			{ x: 50, y: 50, width: 500, height: 300 },
		)
		.build();
	data.slides.push(slide);
	const seed = await handler.save(data.slides);
	return seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength) as ArrayBuffer;
}

async function buildStyledSingleRunSeed(): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(await buildSeed());
	const path = 'ppt/charts/chart1.xml';
	const part = zip.file(path);
	if (!part) {
		throw new Error(`missing part ${path}`);
	}
	const xml = await part.async('string');
	const plainRun = '<a:r><a:t>Q4 Sales</a:t></a:r>';
	const styledRun =
		'<a:r><a:rPr lang="en-AU" altLang="fr-FR" dirty="0"><a:solidFill><a:schemeClr val="accent2"><a:lumMod val="75000"/></a:schemeClr></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>Q4 Sales</a:t></a:r>';
	expect(xml, 'styled-title fixture precondition').toContain(plainRun);
	zip.file(path, xml.replace(plainRun, styledRun));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('chart title rich text (titleRuns): load -> edit -> save -> re-parse', () => {
	it('keeps an attributed empty first leaf as the flat compatibility title', async () => {
		const data = await new PptxHandler().load(
			await buildAttributedTitleSeed(EMPTY_ATTRIBUTED_FIRST_RUN_TITLE_XML),
		);
		const chart = findChart(data);
		expect(chart.chartData?.title).toBe('');
		expect(chart.chartData?.titleRuns).toStrictEqual([
			{ text: '', bold: true },
			{ text: 'Fallback', italic: true },
		]);
	});

	it('preserves an attributed first run through dirty and repeated saves', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildAttributedTitleSeed());
		const chart = findChart(data);
		expect(chart.chartData?.title).toBe('Sales ');
		expect(chart.chartData?.titleRuns).toStrictEqual([
			{ text: 'Sales ', bold: true, color: '#FF0000', fontSize: 18 },
			{ text: 'Overview', italic: true, color: '#0000FF', fontSize: 14 },
		]);

		// Force an unrelated slide-tree edit so the chart passes through the save
		// path without changing its title model.
		chart.x += 1;
		const firstSaved = await handler.save(data.slides);
		const firstXml = await readChartXml(firstSaved);
		expect(firstXml).toContain('<a:t xml:space="preserve">Sales </a:t>');
		expect(firstXml).toContain('lang="en-GB"');
		expect(firstXml).toContain('<a:latin typeface="Aptos"');

		const secondSaved = await handler.save(data.slides);
		const secondXml = await readChartXml(secondSaved);
		expect(secondXml).toContain('<a:t xml:space="preserve">Sales </a:t>');
		expect(secondXml).toContain('lang="en-GB"');
		expect(secondXml).toContain('<a:latin typeface="Aptos"');

		const reloader = new PptxHandler();
		const reloaded = await reloader.load(toArrayBuffer(firstSaved));
		const reloadedChart = findChart(reloaded);
		expect(reloadedChart.chartData?.title).toBe('Sales ');
		expect(reloadedChart.chartData?.titleRuns).toStrictEqual([
			{ text: 'Sales ', bold: true, color: '#FF0000', fontSize: 18 },
			{ text: 'Overview', italic: true, color: '#0000FF', fontSize: 14 },
		]);

		const resaved = await reloader.save(reloaded.slides);
		await expect(readChartXml(resaved)).resolves.toContain(
			'<a:t xml:space="preserve">Sales </a:t>',
		);
	});

	it('keeps the existing flat-title replacement policy for an attributed title', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildAttributedTitleSeed());
		const chart = findChart(data);
		chart.chartData!.title = 'Annual Summary';

		const saved = await handler.save(data.slides);
		const xml = await readChartXml(saved);
		expect(xml).toContain('<a:t>Annual Summary</a:t>');
		expect(xml).not.toContain('Sales ');
		expect(xml).not.toContain('Overview');

		const reparsed = await new PptxHandler().load(toArrayBuffer(saved));
		const finalChart = findChart(reparsed);
		expect(finalChart.chartData?.title).toBe('Annual Summary');
		expect(finalChart.chartData?.titleRuns).toStrictEqual([
			{ text: 'Annual Summary', bold: true, color: '#FF0000', fontSize: 18 },
		]);
	});

	it('parses a single-run authored title into a matching one-entry titleRuns', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());
		const chart = findChart(data);
		expect(chart.chartData?.title).toBe('Q4 Sales');
		expect(chart.chartData?.titleRuns).toStrictEqual([{ text: 'Q4 Sales' }]);
	});

	it('keeps unmodeled single-run formatting when only the flat title is edited', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildStyledSingleRunSeed());
		const chart = findChart(data);
		expect(chart.chartData?.title).toBe('Q4 Sales');
		expect(chart.chartData?.titleRuns?.map((run) => run.text)).toStrictEqual(['Q4 Sales']);

		chart.chartData!.title = 'Annual Summary';
		expect(chart.chartData!.titleRuns?.[0]?.text).toBe('Q4 Sales');
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/charts/chart1.xml')!.async('string');
		expect(xml).toContain('lang="en-AU"');
		expect(xml).toContain('altLang="fr-FR"');
		expect(xml).toContain('dirty="0"');
		expect(xml).toContain('<a:schemeClr val="accent2"><a:lumMod val="75000">');
		expect(xml).toContain('<a:latin typeface="+mj-lt">');
		expect(xml).toContain('<a:t>Annual Summary</a:t>');
		expect(xml).not.toContain('<a:t>Q4 Sales</a:t>');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedChart = findChart(reloaded);
		expect(reloadedChart.chartData?.title).toBe('Annual Summary');
		expect(reloadedChart.chartData?.titleRuns?.map((run) => run.text)).toStrictEqual([
			'Annual Summary',
		]);
	});

	describe('editing titleRuns to two differently-styled runs', () => {
		let reloaded: PptxData;
		let firstSaveHandler: PptxHandler;

		beforeAll(async () => {
			const handler = new PptxHandler();
			const data = await handler.load(await buildSeed());
			const chart = findChart(data);
			// `title` mirrors what the parser always sets it to: the FIRST run's
			// text only (matching `titleRuns[0].text`), never the joined text of
			// every run.
			chart.chartData!.title = 'Q4 Sales';
			chart.chartData!.titleRuns = [
				{ text: 'Q4 Sales', bold: true, color: '#FF0000', fontSize: 18 },
				{ text: 'Report', italic: true },
			];

			const saved = await handler.save(data.slides);
			firstSaveHandler = new PptxHandler();
			reloaded = await firstSaveHandler.load(
				saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
			);
		});

		it('re-parses both runs with their own formatting', () => {
			const chart = findChart(reloaded);
			expect(chart.chartData?.titleRuns).toStrictEqual([
				{ text: 'Q4 Sales', bold: true, color: '#FF0000', fontSize: 18 },
				{ text: 'Report', italic: true },
			]);
		});

		it('keeps reproducing both runs on a further save with no explicit edit', async () => {
			const saved = await firstSaveHandler.save(reloaded.slides);
			const rereloaded = new PptxHandler();
			const data = await rereloaded.load(
				saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
			);
			const chart = findChart(data);
			expect(chart.chartData?.titleRuns).toStrictEqual([
				{ text: 'Q4 Sales', bold: true, color: '#FF0000', fontSize: 18 },
				{ text: 'Report', italic: true },
			]);
		});
	});

	it('collapses a stale multi-run title to one run on an unrelated flat-title rewrite', async () => {
		// Seed a chart with two differently-styled runs (same shape as the
		// "editing titleRuns to two differently-styled runs" block above), then
		// edit only the flat `title` to text that shares nothing with either
		// run's old text: no alignment survives, so this is the "unrelated
		// rewrite" case `distributeTitleRunsText` cannot realign. PowerPoint's
		// own behaviour when you retype a title is to collapse to a single run
		// in the first run's formatting; the pre-fix fallback instead patched
		// only the first run's TEXT in place and left the second run ("Report")
		// trailing, stale, on the slide.
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());
		const chart = findChart(data);
		chart.chartData!.title = 'Q4 Sales';
		chart.chartData!.titleRuns = [
			{ text: 'Q4 Sales', bold: true, color: '#FF0000', fontSize: 18 },
			{ text: 'Report', italic: true },
		];
		const seeded = await handler.save(data.slides);
		const seededHandler = new PptxHandler();
		const seededData = await seededHandler.load(
			seeded.buffer.slice(seeded.byteOffset, seeded.byteOffset + seeded.byteLength) as ArrayBuffer,
		);

		// Now the unrelated rewrite: only `title` changes, `titleRuns` stays the
		// stale two-run array load produced.
		const seededChart = findChart(seededData);
		seededChart.chartData!.title = 'Annual Summary';

		const saved = await seededHandler.save(seededData.slides);
		const reloaded = new PptxHandler();
		const reparsed = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const finalChart = findChart(reparsed);
		expect(finalChart.chartData?.title).toBe('Annual Summary');
		// One run, carrying the FIRST run's formatting (bold/red/18pt) and the
		// whole new text; the second run ("Report", italic) is dropped rather
		// than left trailing.
		expect(finalChart.chartData?.titleRuns).toStrictEqual([
			{ text: 'Annual Summary', bold: true, color: '#FF0000', fontSize: 18 },
		]);
	});

	it('falls back to the flat title path when titleRuns is never set', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());
		const chart = findChart(data);
		// Only edit the flat title, exactly as a caller ignorant of titleRuns
		// would; titleRuns stays whatever load populated it with (one entry).
		chart.chartData!.title = 'Renamed Title';
		delete chart.chartData!.titleRuns;

		const saved = await handler.save(data.slides);
		const reloaded = new PptxHandler();
		const reparsed = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const chart2 = findChart(reparsed);
		expect(chart2.chartData?.title).toBe('Renamed Title');
		expect(chart2.chartData?.titleRuns).toStrictEqual([{ text: 'Renamed Title' }]);
	});
});
