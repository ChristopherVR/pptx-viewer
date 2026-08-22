import { describe, expect, it } from 'vitest';

import { computeChartLegendLayout } from './chart-legend-layout';
import type { ChartViewModel, LegendEntry } from './chart-view-model';

function baseViewModel(overrides: Partial<ChartViewModel>): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 12,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [],
		dataLabels: [],
		legend: [],
		legendX: 200,
		legendY: 292,
		legendAnchor: 'middle',
		...overrides,
	};
}

const legend: LegendEntry[] = [
	{ color: '#ff0000', label: 'Series A' },
	{ color: '#00ff00', label: 'Series B' },
	{ color: '#0000ff', label: 'Series C' },
];

const DEFAULT_TEXT = {
	fontSize: 9,
	fill: '#475569',
	fontWeight: 'normal',
	fontStyle: 'normal',
} as const;

describe('computeChartLegendLayout', () => {
	it('centres a horizontal row on legendX for a bottom/top legend', () => {
		const vm = baseViewModel({ legend, legendX: 200, legendY: 292, legendAnchor: 'middle' }),
			items = computeChartLegendLayout(vm);

		expect(items).toStrictEqual([
			{
				x: 200 - (3 * 80) / 2 + 0 * 80,
				y: 292,
				color: '#ff0000',
				label: 'Series A',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
			{
				x: 200 - (3 * 80) / 2 + 1 * 80,
				y: 292,
				color: '#00ff00',
				label: 'Series B',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
			{
				x: 200 - (3 * 80) / 2 + 2 * 80,
				y: 292,
				color: '#0000ff',
				label: 'Series C',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
		]);
		// Every entry shares the same y on a horizontal row.
		expect(new Set(items.map((i) => i.y)).size).toBe(1);
	});

	it('stacks a vertical column downward from legendY when legendAnchor is start', () => {
		const vm = baseViewModel({ legend, legendX: 325, legendY: 40, legendAnchor: 'start' }),
			items = computeChartLegendLayout(vm);

		expect(items).toStrictEqual([
			{
				x: 325,
				y: 40,
				color: '#ff0000',
				label: 'Series A',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
			{
				x: 325,
				y: 54,
				color: '#00ff00',
				label: 'Series B',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
			{
				x: 325,
				y: 68,
				color: '#0000ff',
				label: 'Series C',
				fontFamily: undefined,
				...DEFAULT_TEXT,
			},
		]);
		// Every entry shares the same x in a vertical stack.
		expect(new Set(items.map((i) => i.x)).size).toBe(1);
	});

	it('returns an empty array when the chart has no legend', () => {
		const vm = baseViewModel({ legend: [] });

		expect(computeChartLegendLayout(vm)).toStrictEqual([]);
	});

	it('resolves a per-entry c:legendEntry text-style override', () => {
		const styled: LegendEntry[] = [
				{
					color: '#ff0000',
					label: 'Series A',
					textStyle: {
						fontSize: 12,
						bold: true,
						italic: true,
						color: '#111827',
						fontFamily: 'Georgia',
					},
				},
				{ color: '#00ff00', label: 'Series B' },
			],
			vm = baseViewModel({
				legend: styled,
				legendX: 200,
				legendY: 292,
				legendAnchor: 'middle',
			}),
			items = computeChartLegendLayout(vm);

		expect(items[0]).toMatchObject({
			fontSize: 16, // 12pt * 4/3
			fill: '#111827',
			fontWeight: 'bold',
			fontStyle: 'italic',
			fontFamily: 'Georgia',
		});
		// The un-overridden entry keeps the historical defaults.
		expect(items[1]).toMatchObject(DEFAULT_TEXT);
	});
});
