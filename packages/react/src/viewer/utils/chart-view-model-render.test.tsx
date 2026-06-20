import type { ChartViewModel, SvgLine, SvgPrimitive, SvgRect, SvgText } from 'pptx-viewer-shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderChartViewModel } from './chart-view-model-render';

/**
 * Projector tests for the React chart view-model renderer.
 *
 * These verify the new (post shared-engine-convergence) ChartViewModel fields
 * that the cartesian builder emits: `secondaryGridlines`, `secondaryAxisLabels`,
 * overlay primitives, and data-table primitives. Overlays / data-table are
 * appended to `primitives` by the shared builder, so they project through the
 * primitive switch; the secondary axis fields project explicitly.
 *
 * Rendering uses react-dom/server `renderToStaticMarkup` (no DOM env needed),
 * matching the repo's component-test pattern.
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

function secondaryLine(y: number): SvgLine {
	return {
		kind: 'line',
		x1: 8,
		y1: y,
		x2: 392,
		y2: y,
		stroke: '#e2e8f0',
		strokeWidth: 0.5,
		dashArray: '2 3',
		opacity: 0.5,
	};
}

function secondaryLabel(y: number, text: string): SvgText {
	return {
		kind: 'text',
		x: 396,
		y,
		text,
		fontSize: 8,
		fill: '#64748b',
		textAnchor: 'start',
		dominantBaseline: 'central',
	};
}

describe('renderChartViewModel: secondary value axis', () => {
	it('emits a dashed right-side line per secondary gridline', () => {
		const vm = baseViewModel({
			secondaryGridlines: [secondaryLine(50), secondaryLine(150), secondaryLine(250)],
		});
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		const dashed = html.match(/stroke-dasharray="2 3"/gu) ?? [];
		expect(dashed).toHaveLength(3);
		expect(html).toContain('opacity="0.5"');
	});

	it('emits a right-anchored label per secondary axis tick', () => {
		const vm = baseViewModel({
			secondaryAxisLabels: [secondaryLabel(50, '10'), secondaryLabel(250, '90')],
		});
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		const starts = html.match(/text-anchor="start"/gu) ?? [];
		expect(starts).toHaveLength(2);
		expect(html).toContain('>10</text>');
		expect(html).toContain('>90</text>');
	});

	it('honours a rotate transform on a secondary axis title label', () => {
		const titled: SvgText = {
			kind: 'text',
			x: 428,
			y: 150,
			text: 'Growth %',
			fontSize: 9,
			fill: '#64748b',
			textAnchor: 'middle',
			transform: 'rotate(-90, 428, 150)',
		};
		const vm = baseViewModel({ secondaryAxisLabels: [titled] });
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		expect(html).toContain('transform="rotate(-90, 428, 150)"');
		expect(html).toContain('>Growth %</text>');
	});

	it('omits secondary axis output when the fields are absent', () => {
		const html = renderToStaticMarkup(renderChartViewModel('c1', baseViewModel({})));
		expect(html).not.toContain('stroke-dasharray');
		expect(html).not.toContain('text-anchor="start"');
	});
});

describe('renderChartViewModel: overlays and data table (via primitives)', () => {
	it('projects overlay primitives (trendline path + error-bar line)', () => {
		const overlays: SvgPrimitive[] = [
			{ kind: 'path', d: 'M0,0 L100,100', fill: 'none', stroke: '#4472C4', strokeWidth: 1.5 },
			{ kind: 'line', x1: 10, y1: 20, x2: 10, y2: 60, stroke: '#334155', strokeWidth: 1 },
		];
		const vm = baseViewModel({ primitives: overlays, overlays });
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		expect(html).toContain('d="M0,0 L100,100"');
		expect(html).toContain('stroke="#4472C4"');
		expect(html).toContain('x1="10"');
	});

	it('projects data-table primitives (rect + line + text block)', () => {
		const rect: SvgRect = { kind: 'rect', x: 8, y: 260, w: 384, h: 14, fill: '#f1f5f9' };
		const line: SvgLine = {
			kind: 'line',
			x1: 8,
			y1: 274,
			x2: 392,
			y2: 274,
			stroke: '#cbd5e1',
			strokeWidth: 1,
		};
		const text: SvgText = {
			kind: 'text',
			x: 12,
			y: 270,
			text: 'Series 1',
			fontSize: 7,
			fill: '#334155',
			textAnchor: 'start',
		};
		const dataTable: SvgPrimitive[] = [rect, line, text];
		const vm = baseViewModel({ primitives: dataTable, dataTable });
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		expect(html).toContain('fill="#f1f5f9"');
		expect(html).toContain('>Series 1</text>');
		expect(html).toContain('y1="274"');
	});

	it('honours per-path opacity on overlay primitives', () => {
		const overlays: SvgPrimitive[] = [
			{
				kind: 'path',
				d: 'M0,0 L50,50',
				fill: '#4472C4',
				stroke: 'none',
				strokeWidth: 0,
				opacity: 0.3,
			},
		];
		const vm = baseViewModel({ primitives: overlays, overlays });
		const html = renderToStaticMarkup(renderChartViewModel('c1', vm));
		expect(html).toContain('fill-opacity="0.3"');
	});
});
