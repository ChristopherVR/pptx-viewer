import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getChartStylePalette } from '../chart-helpers';
import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';

function chart(chartType: PptxChartData['chartType'] = 'bar'): PptxElement {
	const chartData: PptxChartData = {
		chartType,
		categories: ['a', 'b'],
		series: [
			{ name: 'S1', values: [1, 2], color: '#111111' },
			{ name: 'S2', values: [2, 3], color: '#222222' },
		],
		style: { hasTitle: false, hasLegend: false },
		axes: [
			{ axisType: 'catAx', axisId: 1, axPos: 'b' },
			{ axisType: 'valAx', axisId: 2, axPos: 'l', majorGridlines: true },
		],
	};
	return { id: 'c1', type: 'chart', x: 0, y: 0, width: 300, height: 200, chartData } as PptxElement;
}

function patched(result: ReturnType<typeof applyRibbonGalleryItem>): PptxChartData {
	if (result?.kind !== 'element') {
		throw new Error('expected an element patch');
	}
	return (result.patch as { chartData: PptxChartData }).chartData;
}

describe('chart Styles gallery', () => {
	it('exposes the quick-action presets and pins their palette per series', () => {
		const descriptor = buildRibbonGallery('chartStyles', { element: chart() });
		expect(descriptor.sections[0].items.map((i) => i.id)).toStrictEqual([
			'colorful',
			'monochrome',
			'colorfulLight',
			'colorfulDark',
			'mutedDark',
			'pastel',
		]);
		const data = patched(applyRibbonGalleryItem('chartStyles', 'pastel', { element: chart() }));
		const palette = getChartStylePalette(42);
		expect(data.colorPalette).toStrictEqual(palette);
		expect(data.series.map((s) => s.color)).toStrictEqual([palette[0], palette[1]]);
		const again = buildRibbonGallery('chartStyles', {
			element: { ...chart(), chartData: data } as PptxElement,
		});
		expect(again.sections[0].items.find((i) => i.applied)?.id).toBe('pastel');
		expect(applyRibbonGalleryItem('chartStyles', 'nope', { element: chart() })).toBeNull();
	});
});

describe('chart Quick Layout gallery', () => {
	it('offers Layout 1-11 for bar / line charts only', () => {
		const descriptor = buildRibbonGallery('chartQuickLayout', { element: chart() });
		expect(descriptor.sections[0].items).toHaveLength(11);
		expect(descriptor.disabled).toBeFalsy();
		expect(buildRibbonGallery('chartQuickLayout', { element: chart('pie') }).disabled).toBeTruthy();
	});

	it('applies Layout 5: title, data table with keys, value axis title, no legend', () => {
		const data = patched(
			applyRibbonGalleryItem('chartQuickLayout', 'layout5', { element: chart() }),
		);
		expect(data.style?.hasTitle).toBeTruthy();
		expect(data.style?.hasLegend).toBeFalsy();
		expect(data.dataTable).toMatchObject({ showKeys: true, showHorzBorder: true });
		const valAx = data.axes?.find((a) => a.axisType === 'valAx');
		const catAx = data.axes?.find((a) => a.axisType === 'catAx');
		expect(valAx?.titleText).toBe('Axis Title');
		expect(catAx?.titleText).toBeUndefined();
		expect(valAx?.majorGridlines).toBeTruthy();
		expect(data.barGapWidth).toBe(150);
		const again = buildRibbonGallery('chartQuickLayout', {
			element: { ...chart(), chartData: data } as PptxElement,
		});
		expect(again.sections[0].items.filter((i) => i.applied).map((i) => i.id)).toStrictEqual([
			'layout5',
		]);
	});

	it('applies Layout 2: top legend, outside-end value labels, hidden value axis', () => {
		const data = patched(
			applyRibbonGalleryItem('chartQuickLayout', 'layout2', { element: chart() }),
		);
		expect(data.style?.legendPosition).toBe('t');
		expect(data.style?.hasDataLabels).toBeTruthy();
		expect(data.style?.dataLabels).toMatchObject({ showValue: true, position: 'outEnd' });
		expect(data.axes?.find((a) => a.axisType === 'valAx')?.deleted).toBeTruthy();
		expect(data.axes?.find((a) => a.axisType === 'valAx')?.majorGridlines).toBeFalsy();
		expect(data.dataTable).toBeNull();
		expect(data.barOverlap).toBe(-25);
	});

	it('leaves gap width alone on a line chart', () => {
		const data = patched(
			applyRibbonGalleryItem('chartQuickLayout', 'layout7', { element: chart('line') }),
		);
		expect(data.barGapWidth).toBeUndefined();
		expect(data.axes?.find((a) => a.axisType === 'valAx')?.minorGridlines).toBeTruthy();
	});
});
