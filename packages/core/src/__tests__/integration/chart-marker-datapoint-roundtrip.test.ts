import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

function chartFrom(slides: Awaited<ReturnType<PptxHandler['load']>>['slides']): ChartPptxElement {
	const element = slides[0].elements.find((candidate) => candidate.type === 'chart');
	if (!element || element.type !== 'chart') {
		throw new Error('Expected chart element');
	}
	return element;
}

describe('chartML marker and data-point round-trip', () => {
	it('generates, parses, edits, and dirty-saves marker and bubble properties', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'line',
					{ categories: ['Q1', 'Q2'], series: [{ name: 'Revenue', values: [10, 20] }] },
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);
		const generatedSeries = chartFrom(data.slides).chartData!.series[0];
		generatedSeries.marker = { symbol: 'circle', size: 8 };
		generatedSeries.dataPoints = [
			{
				idx: 1,
				invertIfNegative: false,
				marker: { symbol: 'diamond', size: 10 },
				bubble3D: true,
				explosion: 12,
			},
		];

		const firstHandler = new PptxHandler();
		const first = await firstHandler.load((await handler.save(data.slides)).buffer as ArrayBuffer);
		const loadedSeries = chartFrom(first.slides).chartData!.series[0];
		expect(loadedSeries.marker).toMatchObject({ symbol: 'circle', size: 8 });
		expect(loadedSeries.dataPoints).toStrictEqual([
			{
				idx: 1,
				invertIfNegative: false,
				marker: { symbol: 'diamond', size: 10 },
				bubble3D: true,
				explosion: 12,
			},
		]);

		Object.assign(loadedSeries.dataPoints![0], {
			marker: { symbol: 'star', size: 14 },
			bubble3D: false,
			explosion: 20,
		});
		const second = await new PptxHandler().load(
			(await firstHandler.save(first.slides)).buffer as ArrayBuffer,
		);
		expect(chartFrom(second.slides).chartData!.series[0].dataPoints![0]).toMatchObject({
			marker: { symbol: 'star', size: 14 },
			bubble3D: false,
			explosion: 20,
		});
	});
});
