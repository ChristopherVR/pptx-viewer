import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types/elements';

function chartElement(data: Awaited<ReturnType<PptxHandler['load']>>): ChartPptxElement {
	return data.slides[0].elements.find((element) => element.type === 'chart') as ChartPptxElement;
}

describe('classic date axis round-trip', () => {
	it('preserves numeric categories, date context, and calendar units', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addChart(
				'line',
				{
					categories: ['Jan', 'Feb', 'May'],
					series: [{ name: 'Revenue', values: [10, 20, 15] }],
				},
				{ x: 20, y: 20, width: 500, height: 300 },
			)
			.build();
		const chart = slide.elements.find((element) => element.type === 'chart') as ChartPptxElement;
		chart.chartData!.dateCategories = {
			values: [45292, 45323, 45414],
			date1904: false,
			formatCode: 'mmm-yy',
		};
		chart.chartData!.axes = [
			{
				axisType: 'dateAx',
				axisId: 111111111,
				baseTimeUnit: 'days',
				majorUnit: 1,
				majorTimeUnit: 'months',
				minorUnit: 7,
				minorTimeUnit: 'days',
			},
			{ axisType: 'valAx', axisId: 222222222 },
		];
		data.slides.push(slide);

		const saved = await handler.save(data.slides);
		const xml = await (await JSZip.loadAsync(saved)).file('ppt/charts/chart1.xml')!.async('string');
		expect(xml).toContain('<c:dateAx>');
		expect(xml).toContain('<c:numLit><c:formatCode>mmm-yy</c:formatCode>');
		expect(xml).toContain('<c:majorTimeUnit val="months"');

		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(saved.buffer as ArrayBuffer);
		const loadedChart = chartElement(loaded);
		expect(loadedChart.chartData?.dateCategories).toStrictEqual({
			values: [45292, 45323, 45414],
			date1904: false,
			formatCode: 'mmm-yy',
		});
		expect(loadedChart.chartData?.axes?.find((axis) => axis.axisType === 'dateAx')).toMatchObject({
			baseTimeUnit: 'days',
			majorUnit: 1,
			majorTimeUnit: 'months',
			minorUnit: 7,
			minorTimeUnit: 'days',
		});

		loadedChart.chartData!.dateCategories!.values[1] = 45354;
		loaded.slides[0].isDirty = true;
		const resaved = await loadedHandler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(resaved.buffer as ArrayBuffer);
		expect(chartElement(reloaded).chartData?.dateCategories?.values).toStrictEqual([
			45292, 45354, 45414,
		]);
	});
});
