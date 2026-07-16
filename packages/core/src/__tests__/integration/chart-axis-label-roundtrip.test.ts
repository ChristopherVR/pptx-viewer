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

describe('chartML axis label formatting round-trip', () => {
	it('generates, parses, edits, and dirty-saves category-axis label controls', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		data.slides.push(
			createSlide('Blank')
				.addChart(
					'bar',
					{ categories: ['Q1', 'Q2'], series: [{ name: 'Revenue', values: [10, 20] }] },
					{ x: 50, y: 50, width: 500, height: 300 },
				)
				.build(),
		);
		chartFrom(data.slides).chartData!.axes = [
			{
				axisType: 'catAx',
				crosses: 'max',
				majorTickMark: 'out',
				minorTickMark: 'in',
				tickLblPos: 'low',
				auto: false,
				labelAlignment: 'r',
				labelOffset: 160,
				noMultiLevelLabels: true,
			},
			{ axisType: 'valAx', crossesAt: 12, crossBetween: 'midCat' },
		];

		const firstHandler = new PptxHandler();
		const first = await firstHandler.load((await handler.save(data.slides)).buffer as ArrayBuffer);
		const loadedAxis = chartFrom(first.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'catAx',
		);
		expect(loadedAxis).toMatchObject({
			crosses: 'max',
			majorTickMark: 'out',
			minorTickMark: 'in',
			tickLblPos: 'low',
			auto: false,
			labelAlignment: 'r',
			labelOffset: 160,
			noMultiLevelLabels: true,
		});
		expect(
			chartFrom(first.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx'),
		).toMatchObject({ crossesAt: 12, crossBetween: 'midCat' });

		Object.assign(loadedAxis!, {
			crosses: undefined,
			crossesAt: 2,
			majorTickMark: 'cross',
			minorTickMark: 'none',
			auto: true,
			labelAlignment: 'ctr',
			labelOffset: 90,
			noMultiLevelLabels: false,
		});
		const loadedValueAxis = chartFrom(first.slides).chartData!.axes?.find(
			(axis) => axis.axisType === 'valAx',
		);
		Object.assign(loadedValueAxis!, { crossesAt: undefined, crosses: 'min' });
		const secondBytes = await firstHandler.save(first.slides);
		const second = await new PptxHandler().load(secondBytes.buffer as ArrayBuffer);
		expect(
			chartFrom(second.slides).chartData!.axes?.find((axis) => axis.axisType === 'catAx'),
		).toMatchObject({
			crossesAt: 2,
			majorTickMark: 'cross',
			minorTickMark: 'none',
			auto: true,
			labelAlignment: 'ctr',
			labelOffset: 90,
			noMultiLevelLabels: false,
		});
		expect(
			chartFrom(second.slides).chartData!.axes?.find((axis) => axis.axisType === 'valAx'),
		).toMatchObject({ crosses: 'min', crossBetween: 'midCat' });
	});
});
