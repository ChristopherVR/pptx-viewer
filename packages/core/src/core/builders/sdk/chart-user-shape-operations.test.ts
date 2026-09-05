import { describe, expect, it } from 'vitest';

import type { PptxChartUserShape, PptxChartUserShapeGroupChild } from '../../types/chart';
import type { ChartPptxElement } from '../../types/elements';
import {
	addChartUserShape,
	addChartUserShapeGroupChild,
	getChartUserShapeAtPath,
	listChartUserShapes,
	removeChartUserShape,
	removeChartUserShapeAtPath,
	updateChartUserShape,
	updateChartUserShapeAtPath,
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

	// W5-I: path-based operations reach a shape nested inside a `grpSp`, which
	// the index-based operations above cannot address at all.
	describe('*AtPath operations (groups)', () => {
		function makeGroupChild(
			overrides: Partial<PptxChartUserShapeGroupChild> = {},
		): PptxChartUserShapeGroupChild {
			return {
				kind: 'sp',
				off: { x: 0, y: 0 },
				ext: { cx: 500000, cy: 500000 },
				prst: 'rect',
				...overrides,
			};
		}

		function makeGroupElement(): ChartPptxElement {
			const group: PptxChartUserShape = {
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.5, y: 0.5 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [
					makeGroupChild({ prst: 'rect' }),
					makeGroupChild({ prst: 'ellipse', off: { x: 500000, y: 0 } }),
				],
				rawXml: { '@_untouched': 'true' },
			};
			return makeChartElement([
				group,
				{ ...textBox, from: { x: 0.6, y: 0.6 }, to: { x: 0.8, y: 0.8 } },
			]);
		}

		it('getChartUserShapeAtPath reads a top-level shape and a nested child', () => {
			const el = makeGroupElement();
			expect(getChartUserShapeAtPath(el, [0])?.kind).toBe('grpSp');
			expect(getChartUserShapeAtPath(el, [0, 1])).toMatchObject({ kind: 'sp', prst: 'ellipse' });
			expect(getChartUserShapeAtPath(el, [0, 5])).toBeUndefined();
			expect(getChartUserShapeAtPath(el, [1, 0])).toBeUndefined(); // index 1 is not a group
		});

		it('updateChartUserShapeAtPath moves a child inside a group and clears the group rawXml', () => {
			const el = makeGroupElement();
			updateChartUserShapeAtPath(el, [0, 1], { off: { x: 700000, y: 200000 } });
			const group = el.chartData!.userShapes![0];
			expect(group.rawXml).toBeUndefined();
			expect(group.children![0]).toMatchObject({ prst: 'rect', off: { x: 0, y: 0 } });
			expect(group.children![1]).toMatchObject({ prst: 'ellipse', off: { x: 700000, y: 200000 } });
			// The sibling top-level shape is untouched (structural sharing).
			expect(el.chartData!.userShapes![1]).toStrictEqual(el.chartData!.userShapes![1]);
		});

		it('removeChartUserShapeAtPath drops a nested child and clears the group rawXml', () => {
			const el = makeGroupElement();
			removeChartUserShapeAtPath(el, [0, 0]);
			const group = el.chartData!.userShapes![0];
			expect(group.rawXml).toBeUndefined();
			expect(group.children).toHaveLength(1);
			expect(group.children![0]).toMatchObject({ prst: 'ellipse' });
		});

		it('removeChartUserShapeAtPath can remove a whole top-level group', () => {
			const el = makeGroupElement();
			removeChartUserShapeAtPath(el, [0]);
			expect(el.chartData!.userShapes).toHaveLength(1);
			expect(el.chartData!.userShapes![0].kind).toBe('sp');
		});

		it('addChartUserShapeGroupChild appends a child and clears the group rawXml', () => {
			const el = makeGroupElement();
			addChartUserShapeGroupChild(
				el,
				[0],
				makeGroupChild({ prst: 'triangle', off: { x: 0, y: 500000 } }),
			);
			const group = el.chartData!.userShapes![0];
			expect(group.rawXml).toBeUndefined();
			expect(group.children).toHaveLength(3);
			expect(group.children![2]).toMatchObject({ prst: 'triangle' });
		});

		it('addChartUserShapeGroupChild throws when the path does not resolve to a grpSp', () => {
			const el = makeGroupElement();
			expect(() => addChartUserShapeGroupChild(el, [1], makeGroupChild())).toThrow(/grpSp/);
		});

		it('updateChartUserShapeAtPath throws for an out-of-range top-level index', () => {
			const el = makeGroupElement();
			expect(() => updateChartUserShapeAtPath(el, [5], { fill: '#000000' })).toThrow(
				/out of range/,
			);
		});

		it('updateChartUserShapeAtPath throws when descending through a non-group', () => {
			const el = makeGroupElement();
			expect(() => updateChartUserShapeAtPath(el, [1, 0], { fill: '#000000' })).toThrow(
				/does not resolve/,
			);
		});

		it('reaches a doubly-nested child (a group inside a group)', () => {
			const el = makeGroupElement();
			const nestedGroup: PptxChartUserShapeGroupChild = {
				kind: 'grpSp',
				off: { x: 0, y: 0 },
				ext: { cx: 500000, cy: 1000000 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 500000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 500000, cy: 1000000 },
				},
				children: [makeGroupChild({ prst: 'triangle' })],
				rawXml: { '@_untouched-nested': 'true' },
			};
			const outerGroup = el.chartData!.userShapes![0];
			el.chartData!.userShapes = [{ ...outerGroup, children: [nestedGroup], rawXml: undefined }];
			updateChartUserShapeAtPath(el, [0, 0, 0], { fill: '#123456' });
			const outer = el.chartData!.userShapes![0];
			const nested = outer.children![0];
			expect(nested.rawXml).toBeUndefined();
			expect(nested.children![0]).toMatchObject({ prst: 'triangle', fill: '#123456' });
		});
	});
});
