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

describe('chartML data-table round-trip', () => {
	it('generates, parses, edits, and removes c:dTable through save cycles', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addChart(
				'bar',
				{ categories: ['Q1', 'Q2'], series: [{ name: 'Revenue', values: [10, 20] }] },
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build();
		data.slides.push(slide);
		const created = chartFrom(data.slides);
		created.chartData!.dataTable = {
			showHorzBorder: true,
			showVertBorder: false,
			showOutline: true,
			showKeys: true,
		};

		const firstBytes = await handler.save(data.slides);
		const firstHandler = new PptxHandler();
		const first = await firstHandler.load(firstBytes.buffer as ArrayBuffer);
		const loaded = chartFrom(first.slides);
		expect(loaded.chartData!.dataTable).toStrictEqual(created.chartData!.dataTable);

		loaded.chartData!.dataTable = {
			...loaded.chartData!.dataTable,
			showHorzBorder: false,
			showKeys: false,
		};
		const editedBytes = await firstHandler.save(first.slides);
		const secondHandler = new PptxHandler();
		const second = await secondHandler.load(editedBytes.buffer as ArrayBuffer);
		expect(chartFrom(second.slides).chartData!.dataTable).toMatchObject({
			showHorzBorder: false,
			showKeys: false,
		});

		chartFrom(second.slides).chartData!.dataTable = null;
		const removedBytes = await secondHandler.save(second.slides);
		const third = await new PptxHandler().load(removedBytes.buffer as ArrayBuffer);
		expect(chartFrom(third.slides).chartData!.dataTable).toBeUndefined();
	});
});
