/**
 * Load -> edit -> save -> re-parse coverage for chart title rich text
 * (`PptxChartData.titleRuns`): `c:title/c:tx/c:rich` can carry more than one
 * run, each with its own bold/italic/size/color, but the pre-existing flat
 * `title: string` field only ever captured the first run's text and dropped
 * every per-run formatting attribute. Proves the typed multi-run field
 * round-trips, and that the flat `title` path still works when `titleRuns`
 * is absent.
 */
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

describe('chart title rich text (titleRuns): load -> edit -> save -> re-parse', () => {
	it('parses a single-run authored title into a matching one-entry titleRuns', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed());
		const chart = findChart(data);
		expect(chart.chartData?.title).toBe('Q4 Sales');
		expect(chart.chartData?.titleRuns).toStrictEqual([{ text: 'Q4 Sales' }]);
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
