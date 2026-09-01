/**
 * chart-manual-layout.test.ts: `c:manualLayout` edge / factor fractions must
 * resolve to pixels per ECMA-376 21.2.2.95, fall back to the automatic value
 * per field, and reach the chart view-model's plot rect, pie disc, title and
 * legend anchors.
 */

import type { PptxChartData, PptxChartManualLayout, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	chartFrameToViewOffset,
	hasManualLayoutFields,
	manualLayoutOf,
	manualLegendAnchor,
	manualTitleAnchor,
	resolveManualLayoutRect,
} from './chart-manual-layout';
import { buildChartViewModel, computePieLayout, computePlotLayout } from './chart-view-model';

const frame = { width: 400, height: 200 },
	auto = { x: 40, y: 20, width: 300, height: 150 };

const chart = (
	chartType: string,
	layouts: PptxChartData['layouts'],
	extra: Partial<PptxChartData> = {},
): PptxElement =>
	({
		type: 'chart',
		id: 'c1',
		x: 0,
		y: 0,
		width: frame.width,
		height: frame.height,
		chartData: {
			chartType,
			title: 'Sales',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
			style: { hasTitle: true, hasLegend: true, legendPosition: 'r' },
			layouts,
			...extra,
		},
	}) as unknown as PptxElement;

describe('hasManualLayoutFields / manualLayoutOf', () => {
	it('treats null, undefined and a field-less layout as absent', () => {
		expect(hasManualLayoutFields(undefined)).toBeFalsy();
		expect(hasManualLayoutFields(null)).toBeFalsy();
		expect(hasManualLayoutFields({ layoutTarget: 'inner' })).toBeFalsy();
		expect(hasManualLayoutFields({ x: 0 })).toBeTruthy();
		expect(manualLayoutOf(undefined, 'plotArea')).toBeUndefined();
		expect(manualLayoutOf({ layouts: {} }, 'legend')).toBeUndefined();
		expect(manualLayoutOf({ layouts: { legend: { y: 0.5 } } }, 'legend')).toStrictEqual({ y: 0.5 });
	});
});

describe('resolveManualLayoutRect', () => {
	it('returns undefined for a layout with no placement field', () => {
		expect(resolveManualLayoutRect(undefined, frame, auto)).toBeUndefined();
		expect(resolveManualLayoutRect({}, frame, auto)).toBeUndefined();
	});

	it('edge x/y is an absolute fraction of the frame; edge w/h is the far edge', () => {
		const layout: PptxChartManualLayout = {
			xMode: 'edge',
			yMode: 'edge',
			widthMode: 'edge',
			heightMode: 'edge',
			x: 0.1,
			y: 0.2,
			width: 0.9,
			height: 0.7,
		};
		expect(resolveManualLayoutRect(layout, frame, auto)).toStrictEqual({
			x: 40,
			y: 40,
			width: 320,
			height: 100,
		});
	});

	it('factor x/y (the default) offsets from the automatic position; factor w/h is a size', () => {
		const layout: PptxChartManualLayout = { x: 0.1, y: -0.05, width: 0.5, height: 0.25 };
		expect(resolveManualLayoutRect(layout, frame, auto)).toStrictEqual({
			x: 80,
			y: 10,
			width: 200,
			height: 50,
		});
	});

	it('falls back to the automatic value one field at a time', () => {
		expect(resolveManualLayoutRect({ xMode: 'edge', x: 0.25 }, frame, auto)).toStrictEqual({
			x: 100,
			y: 20,
			width: 300,
			height: 150,
		});
		expect(resolveManualLayoutRect({ height: 0.5 }, frame, auto)).toStrictEqual({
			x: 40,
			y: 20,
			width: 300,
			height: 100,
		});
	});

	it('never collapses a rect below one pixel', () => {
		const rect = resolveManualLayoutRect(
			{ xMode: 'edge', x: 0.9, widthMode: 'edge', width: 0.1 },
			frame,
			auto,
		);
		expect(rect?.width).toBe(1);
	});
});

describe('manualTitleAnchor / manualLegendAnchor / chartFrameToViewOffset', () => {
	it('moves the title text anchor by a factor offset and lands its left edge on an edge x', () => {
		const autoAnchor = { x: 200, y: 16 };
		expect(manualTitleAnchor({ y: 0.1 }, frame, 'Sales', autoAnchor)).toStrictEqual({
			x: 200,
			y: 36,
		});
		// 'Sales' is 5 glyphs * 12px * 0.6 = 36px wide: an edge x of 0.5 puts its
		// left edge at 200, so the centred anchor sits at 218.
		expect(manualTitleAnchor({ xMode: 'edge', x: 0.5 }, frame, 'Sales', autoAnchor)).toStrictEqual({
			x: 218,
			y: 16,
		});
		expect(manualTitleAnchor(undefined, frame, 'Sales', autoAnchor)).toBeUndefined();
	});

	it('anchors a vertical legend at its top-left and a horizontal one at its centre', () => {
		const layout: PptxChartManualLayout = { xMode: 'edge', yMode: 'edge', x: 0.5, y: 0.5 };
		expect(manualLegendAnchor(layout, frame, 3, true, { x: 10, y: 10 })).toStrictEqual({
			x: 200,
			y: 100,
		});
		// Horizontal: 3 entries * 80 wide, 14 tall; the anchor is the row's centre.
		expect(manualLegendAnchor(layout, frame, 3, false, { x: 10, y: 10 })).toStrictEqual({
			x: 320,
			y: 107,
		});
	});

	it('offsets a letterboxed square view-model to the element frame', () => {
		expect(chartFrameToViewOffset(frame, { svgWidth: 200, svgHeight: 200 })).toStrictEqual({
			x: 100,
			y: 0,
		});
		expect(chartFrameToViewOffset(frame, { svgWidth: 400, svgHeight: 200 })).toStrictEqual({
			x: 0,
			y: 0,
		});
	});
});

describe('computePlotLayout with a manual plot-area layout', () => {
	const data = { series: [], categories: [], style: { hasTitle: false, hasLegend: false } };

	it('is unchanged without one', () => {
		const withoutLayouts = computePlotLayout(400, 200, data as unknown as PptxChartData, false),
			emptyLayouts = computePlotLayout(
				400,
				200,
				{ ...data, layouts: { plotArea: {} } } as unknown as PptxChartData,
				false,
			);
		expect(emptyLayouts).toStrictEqual(withoutLayouts);
	});

	it('uses an inner-target rect as the plot proper', () => {
		const layout = computePlotLayout(
			400,
			200,
			{
				...data,
				layouts: {
					plotArea: {
						layoutTarget: 'inner',
						xMode: 'edge',
						yMode: 'edge',
						x: 0.25,
						y: 0.1,
						width: 0.5,
						height: 0.5,
					},
				},
			} as unknown as PptxChartData,
			true,
		);
		expect(layout).toMatchObject({ plotLeft: 100, plotTop: 20, plotRight: 300, plotBottom: 120 });
	});

	it('insets an outer-target rect by the axis label bands', () => {
		const autoLayout = computePlotLayout(400, 200, data as unknown as PptxChartData, true),
			// Without title / legend the automatic layout reserves exactly the
			// category band under the plot.
			categoryBand = 200 - autoLayout.plotBottom,
			layout = computePlotLayout(
				400,
				200,
				{
					...data,
					layouts: {
						plotArea: { xMode: 'edge', yMode: 'edge', x: 0.25, y: 0.1, width: 0.5, height: 0.5 },
					},
				} as unknown as PptxChartData,
				true,
			);
		// 40px for the value-axis labels on the left, the category band (less the
		// 8px margin the automatic layout already includes) at the bottom.
		expect(layout).toMatchObject({
			plotLeft: 140,
			plotTop: 20,
			plotRight: 300,
			plotBottom: 120 - (categoryBand - 8),
		});
	});
});

describe('buildChartViewModel honours chartData.layouts', () => {
	it('places the plot area of a bar chart', () => {
		const autoVm = buildChartViewModel(chart('bar', undefined)),
			vm = buildChartViewModel(
				chart('bar', {
					plotArea: {
						layoutTarget: 'inner',
						xMode: 'edge',
						yMode: 'edge',
						x: 0.5,
						y: 0.25,
						width: 0.25,
						height: 0.5,
					},
				}),
			);
		expect(autoVm.valueDrag?.plotTop).not.toBe(50);
		expect(vm.valueDrag).toMatchObject({ plotTop: 50, plotBottom: 150 });
		// Both bars sit inside the manual [200, 300] x-range, none outside it.
		const bars = vm.primitives.filter((p) => p.kind === 'rect' && p.part?.role === 'dataPoint');
		expect(bars).toHaveLength(2);
		for (const bar of bars) {
			if (bar.kind === 'rect') {
				expect(bar.x).toBeGreaterThanOrEqual(200);
				expect(bar.x + bar.w).toBeLessThanOrEqual(300);
			}
		}
	});

	it('re-centres a pie on its manual plot rect, measured on the element', () => {
		const layouts = {
				plotArea: { xMode: 'edge', yMode: 'edge', x: 0.5, y: 0, width: 0.5, height: 1 },
			} as const,
			autoPie = computePieLayout(frame.width, frame.height, { style: {} } as PptxChartData, false),
			pie = computePieLayout(
				frame.width,
				frame.height,
				{ style: {}, layouts } as PptxChartData,
				false,
			);
		expect(autoPie.cx).toBe(100);
		// The right half of a 400x200 element is centred at x=300; in the 200x200
		// square (offset 100) that is x=200, with a radius bounded by the height.
		expect(pie).toMatchObject({ cx: 200, cy: 100, outerR: 100, size: 200 });
	});

	it('moves the title and legend anchors', () => {
		const autoVm = buildChartViewModel(chart('bar', undefined)),
			vm = buildChartViewModel(
				chart('bar', {
					title: { xMode: 'edge', yMode: 'edge', x: 0.1, y: 0.5 },
					legend: { xMode: 'edge', yMode: 'edge', x: 0.05, y: 0.8 },
				}),
			);
		expect(vm.title).toBe('Sales');
		expect(vm.titleX).not.toBe(autoVm.titleX);
		// Edge x lands the 36px-wide title's left edge at 40, centre at 58.
		expect(vm.titleX).toBeCloseTo(58);
		expect(vm.titleY).toBeCloseTo(100 + 12);
		expect(vm.legend.length).toBeGreaterThan(0);
		expect(vm.legendAnchor).toBe('start');
		expect(vm.legendX).toBe(20);
		expect(vm.legendY).toBe(160);
		expect(autoVm.legendX).not.toBe(20);
	});

	it('leaves a chart without layouts byte-identical', () => {
		expect(buildChartViewModel(chart('bar', {}))).toStrictEqual(
			buildChartViewModel(chart('bar', undefined)),
		);
	});
});
