import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

function chartFrom(slides: Awaited<ReturnType<PptxHandler['load']>>['slides']): ChartPptxElement {
	const chart = slides[0].elements.find((element) => element.type === 'chart');
	if (!chart || chart.type !== 'chart') {
		throw new Error('Expected chart element');
	}
	return chart;
}

describe('chart axis scaling round-trip', () => {
	it('persists reversed orientation with major and minor units', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'bar',
					{ categories: ['A', 'B'], series: [{ name: 'Values', values: [10, 30] }] },
					{ x: 20, y: 20, width: 500, height: 300 },
				)
				.build(),
		);

		const firstHandler = new PptxHandler();
		const first = await firstHandler.load((await handler.save(data.slides)).buffer as ArrayBuffer);
		const valueAxis = chartFrom(first.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'valAx',
		);
		Object.assign(valueAxis!, { orientation: 'maxMin', majorUnit: 10, minorUnit: 2 });

		const second = await new PptxHandler().load(
			(await firstHandler.save(first.slides)).buffer as ArrayBuffer,
		);
		expect(
			chartFrom(second.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx'),
		).toMatchObject({ orientation: 'maxMin', majorUnit: 10, minorUnit: 2 });
	});
});
