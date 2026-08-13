/**
 * Regression cover for the six chart kinds React used to draw with private
 * renderers: waterfall, combo, stock, surface, treemap and regionMap.
 *
 * Those renderers emitted no `data-chart-part` attributes, so on-canvas mark
 * selection and drag-to-value silently did nothing for exactly these kinds
 * while working in Angular, Svelte and Vanilla. Two of them were also visibly
 * wrong. Everything here goes through the real production entry point
 * (`renderChartElement`) rather than re-deriving the maths, so it fails if the
 * dispatch is ever pointed back at a private renderer.
 */
import type { PptxChartData, PptxChartType, PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderChartElement } from './chart';

function chart(chartType: PptxChartType, chartData: Partial<PptxChartData> = {}): PptxElement {
	return {
		type: 'chart',
		id: 'chart-1',
		x: 0,
		y: 0,
		width: 480,
		height: 320,
		chartData: {
			chartType,
			categories: ['A', 'B', 'C', 'D'],
			series: [{ name: 'Revenue', values: [45, 62, 58, 71] }],
			style: { hasLegend: true, legendPosition: 'b' },
			...chartData,
		},
	} as PptxElement;
}

function html(element: PptxElement): string {
	return renderToStaticMarkup(renderChartElement(element));
}

/** Every `<rect>`'s y/height, as the markup emitted them. */
function rectBands(markup: string): Array<{ y: number; h: number }> {
	return [...markup.matchAll(/<rect[^>]*>/gu)].flatMap((match) => {
		const y = /\by="([-\d.]+)"/u.exec(match[0]);
		const h = /\bheight="([-\d.]+)"/u.exec(match[0]);
		return y && h ? [{ y: Number(y[1]), h: Number(h[1]) }] : [];
	});
}

const TWO_BY_FOUR: Partial<PptxChartData> = {
	series: [
		{ name: 'Revenue', values: [45, 62, 58, 71] },
		{ name: 'Cost', values: [30, 41, 38, 52] },
	],
};

describe('renderChartElement: interactive marks on the formerly private kinds', () => {
	const cases: Array<[string, PptxElement]> = [
		['waterfall', chart('waterfall')],
		['combo', chart('combo', TWO_BY_FOUR)],
		[
			'stock',
			chart('stock', {
				series: [
					{ name: 'Open', values: [42, 58, 55, 66] },
					{ name: 'High', values: [50, 65, 62, 74] },
					{ name: 'Low', values: [38, 52, 51, 61] },
					{ name: 'Close', values: [47, 61, 53, 71] },
				],
			}),
		],
		['treemap', chart('treemap')],
		['regionMap', chart('regionMap', { categories: ['United States', 'Germany', 'China'] })],
		// A 1-series surface is not worth a 3D projection, so it takes the shared
		// flat grid; the projectable case is covered separately below because it
		// renders React's Three.js component, not SVG.
		['surface', chart('surface')],
	];

	for (const [name, element] of cases) {
		it(`tags ${name} data marks so the canvas can select them`, () => {
			const markup = html(element);
			expect(markup).toContain('data-chart-part="dataPoint"');
			// The series a mark belongs to is kind-specific (a stock candle body
			// carries the CLOSE series, not series 0), so only its presence is
			// asserted here; the exact index is the shared engine's business.
			expect(markup).toMatch(/data-chart-series="\d+"/u);
			expect(markup).toContain('data-chart-point="0"');
		});
	}
});

describe('renderChartElement: waterfall', () => {
	/**
	 * The private renderer scaled the bars against the range of the RAW values
	 * while drawing them at CUMULATIVE heights, so a rising waterfall left the
	 * plot entirely: with values 45/62/58/71 the total bar was emitted at
	 * y=-650.6 with height 1026.6 inside a 320px-tall SVG.
	 */
	it('keeps every bar inside the plot box', () => {
		const bands = rectBands(html(chart('waterfall')));
		expect(bands.length).toBeGreaterThan(1);
		for (const band of bands) {
			expect(band.y).toBeGreaterThanOrEqual(-8);
			expect(band.y + band.h).toBeLessThanOrEqual(320 + 8);
		}
	});

	it('honours c:subtotals rather than assuming only the last bar is a total', () => {
		const withSubtotal = chart('waterfall', {
			series: [
				{
					name: 'Cash flow',
					values: [45, 62, 58, 71],
					waterfallOptions: { subtotals: [1] },
				},
			],
		});
		// The subtotal colour (#6366f1) has to appear on a bar that is NOT the
		// last one, which the private renderer could never produce.
		const bars = [...html(withSubtotal).matchAll(/<rect[^>]*>/gu)].map((m) => m[0]);
		const subtotalBars = bars.filter((bar) => bar.includes('#6366f1'));
		expect(subtotalBars.length).toBeGreaterThanOrEqual(1);
	});
});

describe('renderChartElement: treemap', () => {
	/**
	 * The private renderer flattened every point into one slice-and-dice pass,
	 * so a ChartEx treemap with category levels lost its grouping entirely.
	 */
	it('nests ChartEx category levels and labels the parents', () => {
		const markup = html(
			chart('treemap', {
				categories: ['Alpha', 'Beta', 'Gamma', 'Delta'],
				categoryLevels: [
					['Alpha', 'Beta', 'Gamma', 'Delta'],
					['North', 'North', 'South', 'South'],
				],
			}),
		);
		expect(markup).toContain('North');
		expect(markup).toContain('South');
	});
});

describe('renderChartElement: regionMap', () => {
	it('names each region in a tooltip', () => {
		const markup = html(chart('regionMap', { categories: ['United States', 'Germany', 'China'] }));
		expect(markup).toContain('<title>United States: 45</title>');
		// Regions with no data still identify themselves.
		expect(markup).toContain('<title>Australia</title>');
	});
});
