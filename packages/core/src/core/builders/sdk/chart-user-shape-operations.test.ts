import { describe, expect, it } from 'vitest';

import type { PptxChartUserShape } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import {
	addChartUserShape,
	listChartUserShapes,
	removeChartUserShape,
	updateChartUserShape,
} from './chart-user-shape-operations';

function makeChartElement(userShapes?: PptxChartUserShape[]): ChartPptxElement {
	return {
		id: 'chart-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
			...(userShapes ? { userShapes } : {}),
		},
	} as ChartPptxElement;
}

const textBox: PptxChartUserShape = {
	kind: 'sp',
	anchor: 'rel',
	from: { x: 0.1, y: 0.1 },
	to: { x: 0.3, y: 0.2 },
	prst: 'rect',
	fill: '#FFFF00',
	paragraphs: [{ text: 'Note' }],
};

describe('chart-user-shape-operations', () => {
	it('listChartUserShapes returns an empty array when the chart has no overlays', () => {
		expect(listChartUserShapes(makeChartElement())).toStrictEqual([]);
	});

	it('addChartUserShape appends a shape, preserving the existing list', () => {
		const el = makeChartElement([textBox]);
		const added: PptxChartUserShape = {
			...textBox,
			from: { x: 0.5, y: 0.5 },
			to: { x: 0.7, y: 0.6 },
		};
		addChartUserShape(el, added);
		expect(el.chartData!.userShapes).toHaveLength(2);
		expect(el.chartData!.userShapes![1]).toStrictEqual(added);
	});

	it('addChartUserShape throws for a chart with no chartData', () => {
		const el = { id: 'x', type: 'chart', x: 0, y: 0, width: 1, height: 1 } as ChartPptxElement;
		expect(() => addChartUserShape(el, textBox)).toThrow(/no chartData/);
	});

	it('updateChartUserShape patches only the anchor at the given index (move/resize)', () => {
		const el = makeChartElement([textBox]);
		updateChartUserShape(el, 0, { from: { x: 0.2, y: 0.2 }, to: { x: 0.4, y: 0.4 } });
		expect(el.chartData!.userShapes![0]).toStrictEqual({
			...textBox,
			from: { x: 0.2, y: 0.2 },
			to: { x: 0.4, y: 0.4 },
		});
	});

	it('updateChartUserShape throws for an out-of-range index', () => {
		const el = makeChartElement([textBox]);
		expect(() => updateChartUserShape(el, 5, { fill: '#000000' })).toThrow(/out of range/);
	});

	it('removeChartUserShape drops the shape at the given index', () => {
		const el = makeChartElement([textBox, { ...textBox, fill: '#00FF00' }]);
		removeChartUserShape(el, 0);
		expect(el.chartData!.userShapes).toStrictEqual([{ ...textBox, fill: '#00FF00' }]);
	});
});
