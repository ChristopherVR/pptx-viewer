/**
 * Data-label boxes, callouts and leader lines beyond bar charts (COM ground
 * truth: callouts-com.pptx, a 2026-09 limitations-wave deck of line, area,
 * pie, doughnut, scatter, bubble and radar charts whose series-1 labels carry
 * a `wedgeRectCallout` or `rect` box and one dragged label). Every kind now
 * paints the box under its label and a leader line back from the dragged one.
 */
import type { PptxChartData, PptxChartSeries } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildChartViewModel } from './chart-view-model';
import type { ChartViewModel, SvgPrimitive } from './chart-view-model';

const BOX = { fillColor: '#FFFFCC', strokeColor: '#C00000', strokeWidth: 1 };

function labelled(extra: Partial<PptxChartSeries> = {}, callout = true): PptxChartSeries {
	return {
		name: 'S1',
		values: [4.3, 2.5, 3.5, 4.5],
		dataLabelOptions: {
			showValue: true,
			labelShape: BOX,
			...(callout ? { calloutShape: 'wedgeRectCallout' } : {}),
			showLeaderLines: true,
		},
		// Point 2 dragged up and right, as in the COM deck.
		dataLabels: [{ idx: 1, layout: { x: 0.05, y: -0.12 } }],
		...extra,
	} as PptxChartSeries;
}

function vm(chartData: Partial<PptxChartData>): ChartViewModel {
	return buildChartViewModel({
		id: 'c',
		type: 'chart',
		x: 0,
		y: 0,
		width: 600,
		height: 400,
		chartData: {
			categories: ['A', 'B', 'C', 'D'],
			style: { hasDataLabels: true },
			...chartData,
		},
	} as never);
}

const boxes = (model: ChartViewModel) =>
	model.primitives.filter(
		(p): p is Extract<SvgPrimitive, { kind: 'polygon' }> =>
			p.kind === 'polygon' && p.fill === BOX.fillColor,
	);
const leaders = (model: ChartViewModel) =>
	model.primitives.filter((p) => p.kind === 'polyline' && p.stroke === '#A6A6A6');
/** A callout polygon has 7 points (4 corners + a 3-point pointer); a plain box 4. */
const pointerCount = (model: ChartViewModel) =>
	boxes(model).filter((box) => box.points.split(' ').length === 7).length;

describe('data-label callouts on every chart kind', () => {
	const cases: Array<[string, Partial<PptxChartData>]> = [
		['line', { chartType: 'line', series: [labelled()] }],
		['area', { chartType: 'area', series: [labelled()] }],
		['radar', { chartType: 'radar', series: [labelled()] }],
		['pie', { chartType: 'pie', series: [labelled()] }],
		['doughnut', { chartType: 'doughnut', series: [labelled()] }],
		[
			'scatter',
			{ chartType: 'scatter', categories: [], series: [labelled({ xValues: [1, 2, 3, 4] })] },
		],
		[
			'bubble',
			{
				chartType: 'bubble',
				categories: [],
				series: [labelled({ xValues: [1, 2, 3, 4], bubbleSizes: [5, 2, 4, 3] })],
			},
		],
	];

	it.each(cases)('%s: one box per label, drawn under the text', (_kind, data) => {
		const model = vm(data);
		expect(model.dataLabels).toHaveLength(4);
		expect(boxes(model)).toHaveLength(4);
	});

	it.each(cases.filter(([kind]) => kind !== 'pie'))(
		'%s: a leader line runs back from the dragged label only',
		(_kind, data) => {
			expect(leaders(vm(data))).toHaveLength(1);
		},
	);

	it('points the callout at the marker (line) but not at a centred area label', () => {
		expect(pointerCount(vm({ chartType: 'line', series: [labelled()] }))).toBe(4);
		// The three area labels PowerPoint centres on their band keep a plain box;
		// only the dragged one, now clear of its point, grows a pointer.
		expect(pointerCount(vm({ chartType: 'area', series: [labelled()] }))).toBe(1);
	});

	it('draws a plain box (no pointer) for a non-callout label shape', () => {
		expect(pointerCount(vm({ chartType: 'line', series: [labelled({}, false)] }))).toBe(0);
	});

	it('leaves an unshaped label undecorated', () => {
		const plain = { name: 'S1', values: [1, 2, 3, 4], dataLabelOptions: { showValue: true } };
		expect(boxes(vm({ chartType: 'line', series: [plain as PptxChartSeries] }))).toHaveLength(0);
	});
});

describe('default label placement with no c:dLblPos (COM)', () => {
	const plain = (extra: Partial<PptxChartSeries> = {}) =>
		({
			name: 'S1',
			values: [4.3, 2.5, 3.5, 4.5],
			dataLabelOptions: { showValue: true },
			...extra,
		}) as PptxChartSeries;

	it('line: right of the marker', () => {
		const model = vm({ chartType: 'line', series: [plain()] });
		expect(model.dataLabels.every((label) => label.textAnchor === 'start')).toBeTruthy();
	});

	it('area: centred in the band, halfway down to the axis', () => {
		const model = vm({ chartType: 'area', series: [plain()] });
		const [first] = model.dataLabels;
		expect(first.textAnchor).toBe('middle');
		expect(first.dominantBaseline).toBe('central');
	});

	it('radar: out along the spoke, and only for the series that shows labels', () => {
		const model = vm({
			chartType: 'radar',
			series: [
				plain(),
				{ name: 'S2', values: [1, 1, 1, 1], dataLabelOptions: { showValue: false } },
			],
		});
		expect(model.dataLabels).toHaveLength(4);
		// Category 0 sits at 12 o'clock, so its label is straight above centre.
		const [top] = model.dataLabels;
		expect(top.textAnchor).toBe('middle');
		expect(top.y).toBeLessThan(model.dataLabels[2].y);
	});
});
