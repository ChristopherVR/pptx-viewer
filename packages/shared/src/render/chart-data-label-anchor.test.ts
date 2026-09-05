import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	resolveBarLabelAnchor,
	resolveBarLabelPlacement,
	resolveLabelPosition,
	resolveMarkerLabelAnchor,
	resolveMarkerLabelPlacement,
} from './chart-data-label-anchor';

const RECT = { x: 100, y: 40, width: 20, height: 60 };

describe('resolveBarLabelAnchor: vertical (bar/column)', () => {
	it('c:dLblPos="ctr" centres the label inside the bar', () => {
		const anchor = resolveBarLabelAnchor('ctr', RECT, 5, 'vertical');
		expect(anchor).toStrictEqual({
			x: 110,
			y: 70,
			textAnchor: 'middle',
			dominantBaseline: 'central',
		});
	});

	it('c:dLblPos="inBase" sits near the zero baseline for a positive bar', () => {
		const anchor = resolveBarLabelAnchor('inBase', RECT, 5, 'vertical');
		expect(anchor.y).toBe(RECT.y + RECT.height - 4);
	});

	it('c:dLblPos="inBase" sits near the zero baseline for a negative bar (top of the rect)', () => {
		const anchor = resolveBarLabelAnchor('inBase', RECT, -5, 'vertical');
		expect(anchor.y).toBe(RECT.y + 10);
	});

	it('c:dLblPos="inEnd" sits near the value end, opposite of inBase', () => {
		expect(resolveBarLabelAnchor('inEnd', RECT, 5, 'vertical').y).toBe(RECT.y + 10);
		expect(resolveBarLabelAnchor('inEnd', RECT, -5, 'vertical').y).toBe(RECT.y + RECT.height - 4);
	});

	it('c:dLblPos="outEnd" (and an absent position) sits beyond the value end', () => {
		expect(resolveBarLabelAnchor('outEnd', RECT, 5, 'vertical').y).toBe(RECT.y - 4);
		expect(resolveBarLabelAnchor(undefined, RECT, 5, 'vertical').y).toBe(RECT.y - 4);
		expect(resolveBarLabelAnchor(undefined, RECT, -5, 'vertical').y).toBe(
			RECT.y + RECT.height + 10,
		);
	});
});

describe('resolveBarLabelAnchor: horizontal (transposed bar)', () => {
	it('c:dLblPos="outEnd" sits beyond the right edge for a positive value', () => {
		const anchor = resolveBarLabelAnchor('outEnd', RECT, 5, 'horizontal');
		expect(anchor.x).toBe(RECT.x + RECT.width + 4);
		expect(anchor.textAnchor).toBe('start');
	});

	it('c:dLblPos="outEnd" sits beyond the left edge for a negative value', () => {
		const anchor = resolveBarLabelAnchor('outEnd', RECT, -5, 'horizontal');
		expect(anchor.x).toBe(RECT.x - 4);
		expect(anchor.textAnchor).toBe('end');
	});

	it('c:dLblPos="inBase" sits at the base (left) edge for a positive value', () => {
		const anchor = resolveBarLabelAnchor('inBase', RECT, 5, 'horizontal');
		expect(anchor.x).toBe(RECT.x + 4);
	});
});

describe('resolveMarkerLabelAnchor: line / scatter / bubble', () => {
	const point = { x: 50, y: 50 };

	it('defaults to above the marker (t / bestFit / absent)', () => {
		expect(resolveMarkerLabelAnchor(undefined, point).y).toBeLessThan(point.y);
		expect(resolveMarkerLabelAnchor('t', point).y).toBeLessThan(point.y);
	});

	it('places "b" below, "l" left, "r" right of the marker', () => {
		expect(resolveMarkerLabelAnchor('b', point).y).toBeGreaterThan(point.y);
		expect(resolveMarkerLabelAnchor('l', point).x).toBeLessThan(point.x);
		expect(resolveMarkerLabelAnchor('r', point).x).toBeGreaterThan(point.x);
	});

	it('"ctr" sits directly on the marker', () => {
		expect(resolveMarkerLabelAnchor('ctr', point)).toStrictEqual({
			x: 50,
			y: 50,
			textAnchor: 'middle',
			dominantBaseline: 'central',
		});
	});
});

function chart(series: Partial<PptxChartSeries>): PptxChartData {
	return {
		chartType: 'bar',
		categories: ['A'],
		series: [{ name: 'S', values: [5], ...series }],
	};
}

describe('resolveLabelPosition cascade', () => {
	it('a per-point c:dLbl position wins over the series and chart-type levels', () => {
		const data = chart({
			dataLabels: [{ idx: 0, position: 'ctr' }],
			dataLabelOptions: { position: 'inEnd' },
		});
		expect(resolveLabelPosition(data, data.series[0], 0)).toBe('ctr');
	});

	it('falls back to the series level, then the chart-type level', () => {
		const seriesLevel = chart({ dataLabelOptions: { position: 'inBase' } });
		expect(resolveLabelPosition(seriesLevel, seriesLevel.series[0], 0)).toBe('inBase');

		const chartLevel: PptxChartData = { ...chart({}), style: { dataLabels: { position: 'ctr' } } };
		expect(resolveLabelPosition(chartLevel, chartLevel.series[0], 0)).toBe('ctr');
	});
});

describe('resolveBarLabelPlacement: manual layout offset', () => {
	it('shifts the resolved anchor by a per-point c:dLbl/c:layout drag', () => {
		const data = chart({
			dataLabels: [
				{
					idx: 0,
					position: 'outEnd',
					layout: { x: 0.1, y: -0.05, xMode: 'factor', yMode: 'factor' },
				},
			],
		});
		const auto = resolveBarLabelAnchor('outEnd', RECT, 5, 'vertical');
		const placed = resolveBarLabelPlacement(data, data.series[0], 0, RECT, 5, 'vertical', {
			width: 400,
			height: 300,
		});
		expect(placed.x).toBeCloseTo(auto.x + 0.1 * 400, 5);
		expect(placed.y).toBeCloseTo(auto.y + -0.05 * 300, 5);
	});

	it('leaves the automatic anchor untouched when the label has no layout', () => {
		const data = chart({});
		const auto = resolveBarLabelAnchor(undefined, RECT, 5, 'vertical');
		const placed = resolveBarLabelPlacement(data, data.series[0], 0, RECT, 5, 'vertical', {
			width: 400,
			height: 300,
		});
		expect(placed.x).toBe(auto.x);
		expect(placed.y).toBe(auto.y);
	});
});

describe('resolveMarkerLabelPlacement: manual layout offset', () => {
	it('shifts a scatter/line label by its per-point manual drag', () => {
		const data = chart({
			dataLabels: [{ idx: 0, layout: { x: 0.02, xMode: 'factor', yMode: 'factor' } }],
		});
		const point = { x: 50, y: 50 };
		const placed = resolveMarkerLabelPlacement(data, data.series[0], 0, point, {
			width: 400,
			height: 300,
		});
		const auto = resolveMarkerLabelAnchor(undefined, point);
		expect(placed.x).toBeCloseTo(auto.x + 0.02 * 400, 5);
		expect(placed.y).toBeCloseTo(auto.y, 5);
	});
});

describe('resolveMarkerLabelPlacement: defaultPosition (stock close label)', () => {
	const point = { x: 50, y: 50 };
	const frame = { width: 400, height: 300 };

	it('uses defaultPosition when nothing at any cascade level authored a c:dLblPos', () => {
		const data = chart({});
		const placed = resolveMarkerLabelPlacement(data, data.series[0], 0, point, frame, 6, 'r');
		expect(placed).toStrictEqual(resolveMarkerLabelAnchor('r', point, 6));
	});

	it('lets an authored c:dLblPos win over defaultPosition', () => {
		const data = chart({ dataLabelOptions: { position: 'b' } });
		const placed = resolveMarkerLabelPlacement(data, data.series[0], 0, point, frame, 6, 'r');
		expect(placed.textAnchor).toBe(resolveMarkerLabelAnchor('b', point, 6).textAnchor);
	});

	it('keeps the historical "above the point" default when defaultPosition is omitted', () => {
		const data = chart({});
		const placed = resolveMarkerLabelPlacement(data, data.series[0], 0, point, frame);
		expect(placed).toStrictEqual(resolveMarkerLabelAnchor(undefined, point, 7));
	});
});
