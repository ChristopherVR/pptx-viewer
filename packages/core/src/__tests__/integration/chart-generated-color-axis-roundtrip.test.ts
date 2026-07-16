import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { ChartPptxElement } from '../../core/types';

describe('generated chart color and axis metadata', () => {
	it('creates package parts and reloads palette method and axis positions', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank')
			.addChart(
				'bar',
				{
					series: [{ name: 'Revenue', values: [10, 20] }],
					categories: ['Q1', 'Q2'],
				},
				{ x: 50, y: 50, width: 500, height: 300 },
			)
			.build();
		const chart = slide.elements.find((element) => element.type === 'chart') as ChartPptxElement;
		chart.chartData!.colorPalette = ['#112233', '#AABBCC'];
		chart.chartData!.colorMethod = 'withinLinear';
		chart.chartData!.axes = [
			{ axisType: 'catAx', axisId: 111111111, axPos: 't' },
			{ axisType: 'valAx', axisId: 222222222, axPos: 'r' },
		];
		data.slides.push(slide);

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		expect(zip.file('ppt/charts/colors1.xml')).not.toBeNull();
		expect(zip.file('ppt/charts/_rels/chart1.xml.rels')).not.toBeNull();
		const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
		expect(contentTypes).toContain('application/vnd.ms-office.chartcolorstyle+xml');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const roundTrip = reloaded.slides[0].elements.find(
			(element) => element.type === 'chart',
		) as ChartPptxElement;
		expect(roundTrip.chartData!.colorPalette).toStrictEqual(['#112233', '#AABBCC']);
		expect(roundTrip.chartData!.colorMethod).toBe('withinLinear');
		expect(roundTrip.chartData!.axes!.find((axis) => axis.axisType === 'catAx')!.axPos).toBe('t');
		expect(roundTrip.chartData!.axes!.find((axis) => axis.axisType === 'valAx')!.axPos).toBe('r');
	});
});
