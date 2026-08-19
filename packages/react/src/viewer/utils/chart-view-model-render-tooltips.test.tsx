import type { ChartViewModel, SvgPrimitive, SvgRect } from 'pptx-viewer-shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderChartViewModel } from './chart-view-model-render';

/**
 * Regression coverage for hover-tooltip text on chart marks.
 *
 * Only the region map's `path` primitives used to carry a `title`. Every
 * other mark kind (bar/line/area/scatter/bubble/pie/radar) rendered no hover
 * tooltip at all, because the projector only emitted a `<title>` child inside
 * the `path` branch. This asserts every mark-bearing primitive kind
 * (rect / circle / polygon) now does the same.
 */

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

describe('renderChartViewModel: mark tooltips', () => {
	it('emits a <title> child for a titled rect (bar mark)', () => {
		const rect: SvgRect = {
				kind: 'rect',
				x: 0,
				y: 0,
				w: 10,
				h: 10,
				fill: '#4472C4',
				title: 'Revenue, Q1: 100',
			},
			html = renderToStaticMarkup(
				renderChartViewModel('c1', baseViewModel({ primitives: [rect] })),
			);
		expect(html).toContain('<title>Revenue, Q1: 100</title>');
	});

	it('emits a <title> child for a titled circle (line/scatter/bubble mark)', () => {
		const circle: SvgPrimitive = {
				kind: 'circle',
				cx: 5,
				cy: 5,
				r: 3,
				fill: '#4472C4',
				title: 'Trend, Jan: 10',
			},
			html = renderToStaticMarkup(
				renderChartViewModel('c1', baseViewModel({ primitives: [circle] })),
			);
		expect(html).toContain('<title>Trend, Jan: 10</title>');
	});

	it('emits a <title> child for a titled polygon (radar series mark)', () => {
		const polygon: SvgPrimitive = {
				kind: 'polygon',
				points: '0,0 10,0 5,10',
				fill: '#4472C4',
				stroke: '#4472C4',
				strokeWidth: 1,
				title: 'Player 1',
			},
			html = renderToStaticMarkup(
				renderChartViewModel('c1', baseViewModel({ primitives: [polygon] })),
			);
		expect(html).toContain('<title>Player 1</title>');
	});

	it('omits <title> when a primitive has no title', () => {
		const rect: SvgRect = { kind: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#4472C4' },
			html = renderToStaticMarkup(
				renderChartViewModel('c1', baseViewModel({ primitives: [rect] })),
			);
		expect(html).not.toContain('<title>');
	});
});
