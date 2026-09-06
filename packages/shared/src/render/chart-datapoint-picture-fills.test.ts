import type { PptxChartData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyDataPointPictureFills } from './chart-datapoint-picture-fills';
import type { SvgPrimitive, SvgRect } from './chart-view-model-types';

// C2-G9 (render half): the <pattern>/<defs> wiring that paints a data point's
// c:dPt/c:pictureOptions picture fill onto its bar rect.
describe('applyDataPointPictureFills', () => {
	const dataPointRect: SvgRect = {
		kind: 'rect',
		x: 10,
		y: 20,
		w: 30,
		h: 40,
		fill: '#4472C4',
		part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 },
	};

	function chartDataWithPicture(
		format: 'stretch' | 'stack' | 'stackScale' | undefined,
		pictureStackUnit?: number,
	): PptxChartData {
		return {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [
				{
					name: 'Series 1',
					values: [1, 2],
					dataPoints: [
						{
							idx: 1,
							picture: {
								imageUrl: 'data:image/png;base64,AAA',
								...(format !== undefined ? { pictureFormat: format } : {}),
								...(pictureStackUnit !== undefined ? { pictureStackUnit } : {}),
							},
						},
					],
				},
			],
		};
	}

	it('leaves primitives untouched and returns no defs when no point has a picture', () => {
		const primitives: SvgPrimitive[] = [dataPointRect];
		const chartData: PptxChartData = {
			chartType: 'bar',
			categories: ['A'],
			series: [{ name: 'S', values: [1] }],
		};
		const result = applyDataPointPictureFills(chartData, 'chart-1', primitives);
		expect(result.defs).toStrictEqual([]);
		expect(result.primitives[0]).toBe(dataPointRect);
	});

	it('rewrites the fill to url(#id) and emits one stretch pattern sized to the rect', () => {
		const chartData = chartDataWithPicture('stretch');
		const result = applyDataPointPictureFills(chartData, 'chart-1', [dataPointRect]);
		expect(result.defs).toHaveLength(1);
		const rect = result.primitives[0] as SvgRect;
		expect(rect.fill).toBe(`url(#${result.defs[0].id})`);
		expect(result.defs[0]).toStrictEqual({
			kind: 'pattern',
			id: 'chart-1-chart-dpt-pic-0-1',
			href: 'data:image/png;base64,AAA',
			patternUnits: 'userSpaceOnUse',
			x: 10,
			y: 20,
			width: 30,
			height: 40,
			preserveAspectRatio: 'none',
		});
	});

	it('prefixes the pattern id with the element id, so two charts never collide', () => {
		const chartData = chartDataWithPicture('stretch');
		const a = applyDataPointPictureFills(chartData, 'chart-a', [dataPointRect]);
		const b = applyDataPointPictureFills(chartData, 'chart-b', [dataPointRect]);
		expect(a.defs[0].id).toBe('chart-a-chart-dpt-pic-0-1');
		expect(b.defs[0].id).toBe('chart-b-chart-dpt-pic-0-1');
	});

	it('tiles a stack fill at the resolved tile height instead of the whole rect', () => {
		// 36pt -> 48px (chartFontPx's 4/3 points-to-px ratio).
		const chartData = chartDataWithPicture('stack', 36);
		const result = applyDataPointPictureFills(chartData, 'chart-1', [dataPointRect]);
		expect(result.defs[0].height).toBeCloseTo(48, 5);
		expect(result.defs[0].width).toBe(30);
		expect(result.defs[0].preserveAspectRatio).toBe('xMidYMid slice');
	});

	it('falls back to the rect height for stack with no c:pictureStackUnit (one tile)', () => {
		const chartData = chartDataWithPicture('stack');
		const result = applyDataPointPictureFills(chartData, 'chart-1', [dataPointRect]);
		expect(result.defs[0].height).toBe(40);
	});

	// C2-G9 3-D face-targeting half: c:applyToFront gates the FRONT rect only
	// for bar3D (a plain 2-D bar has no face concept and always paints once resolved).
	it('leaves the front rect on its solid fill when applyToFront=false on a bar3D chart', () => {
		const chartData: PptxChartData = {
			...chartDataWithPicture('stretch'),
			chartType: 'bar3D',
			series: [
				{
					name: 'Series 1',
					values: [1, 2],
					dataPoints: [
						{
							idx: 1,
							picture: {
								imageUrl: 'data:image/png;base64,AAA',
								applyToFront: false,
								applyToSides: true,
							},
						},
					],
				},
			],
		};
		const result = applyDataPointPictureFills(chartData, 'chart-1', [dataPointRect]);
		expect(result.defs).toStrictEqual([]);
		expect(result.primitives[0]).toBe(dataPointRect);
	});

	it('still paints the front rect on a bar3D chart when applyToFront is unset (COM: absent = all faces)', () => {
		const chartData = { ...chartDataWithPicture('stretch'), chartType: 'bar3D' as const };
		const result = applyDataPointPictureFills(chartData, 'chart-1', [dataPointRect]);
		expect(result.defs).toHaveLength(1);
		expect((result.primitives[0] as SvgRect).fill).toBe(`url(#${result.defs[0].id})`);
	});

	it('ignores non-rect and non-dataPoint primitives', () => {
		const line: SvgPrimitive = {
			kind: 'line',
			x1: 0,
			y1: 0,
			x2: 1,
			y2: 1,
			stroke: '#000',
			strokeWidth: 1,
		};
		const seriesRect: SvgRect = { ...dataPointRect, part: { role: 'series', seriesIndex: 0 } };
		const chartData = chartDataWithPicture('stretch');
		const result = applyDataPointPictureFills(chartData, 'chart-1', [line, seriesRect]);
		expect(result.defs).toStrictEqual([]);
		expect(result.primitives).toStrictEqual([line, seriesRect]);
	});
});
