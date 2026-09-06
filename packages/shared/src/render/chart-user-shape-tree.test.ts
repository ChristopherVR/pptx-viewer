import type { PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	listChartUserShapeRows,
	withChartUserShapeRowRemoved,
	withChartUserShapeRowTextUpdated,
	withChartUserShapeRowUpdated,
} from './chart-user-shape-tree';

describe('listChartUserShapeRows', () => {
	it('returns an empty list for no overlays', () => {
		expect(listChartUserShapeRows(undefined)).toStrictEqual([]);
	});

	it('lists a top-level sp/cxnSp/pic as editable-appropriate rows, unchanged shape', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0.1, y: 0.1 },
				to: { x: 0.3, y: 0.2 },
				fill: '#FF0000',
				paragraphs: [{ text: 'Hello' }],
			},
			{ kind: 'pic', anchor: 'abs', from: { x: 0.5, y: 0.5 }, ext: { cx: 100, cy: 200 } },
		];
		const rows = listChartUserShapeRows(shapes);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			path: [0],
			depth: 0,
			kind: 'sp',
			isGroup: false,
			anchor: 'rel',
			text: 'Hello',
			editableVisuals: true,
			editablePosition: true,
			editableAltText: false,
		});
		expect(rows[1]).toMatchObject({
			path: [1],
			depth: 0,
			kind: 'pic',
			editableVisuals: false,
			editablePosition: true,
			editableAltText: true,
		});
	});

	it('flattens a grpSp into a group row plus indented child rows, recursing into nested groups', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [
					{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 }, fill: '#FF0000' },
					{
						kind: 'grpSp',
						off: { x: 500000, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						transform: {
							off: { x: 0, y: 0 },
							ext: { cx: 500000, cy: 1000000 },
							chOff: { x: 0, y: 0 },
							chExt: { cx: 500000, cy: 1000000 },
						},
						children: [
							{
								kind: 'cxnSp',
								off: { x: 0, y: 0 },
								ext: { cx: 500000, cy: 1000000 },
								stroke: '#0000FF',
							},
						],
					},
				],
			},
		];
		const rows = listChartUserShapeRows(shapes);
		expect(rows.map((r) => [r.path, r.depth, r.kind, r.isGroup])).toStrictEqual([
			[[0], 0, 'grpSp', true],
			[[0, 0], 1, 'sp', false],
			[[0, 1], 1, 'grpSp', true],
			[[0, 1, 0], 2, 'cxnSp', false],
		]);
		expect(rows[0]).toMatchObject({ editablePosition: true, editableVisuals: false });
		expect(rows[1]).toMatchObject({
			off: { x: 0, y: 0 },
			fill: '#FF0000',
			editableVisuals: true,
			editablePosition: true,
		});
		expect(rows[3]).toMatchObject({
			off: { x: 0, y: 0 },
			stroke: '#0000FF',
			editableVisuals: true,
			editablePosition: true,
		});
	});
});

describe('withChartUserShapeRowUpdated', () => {
	const grouped: PptxChartUserShape[] = [
		{
			kind: 'grpSp',
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 1, y: 1 },
			transform: {
				off: { x: 0, y: 0 },
				ext: { cx: 1000000, cy: 1000000 },
				chOff: { x: 0, y: 0 },
				chExt: { cx: 1000000, cy: 1000000 },
			},
			children: [
				{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 }, fill: '#FF0000' },
			],
			rawXml: { 'cdr:grpSpPr': {} },
		},
	];

	it('patches a top-level row directly', () => {
		const next = withChartUserShapeRowUpdated(grouped, [0], { fill: '#00FF00' });
		// grpSp has no `fill` field normally, but the patch mechanism is
		// generic; verify via a plain top-level sp instead for a meaningful field.
		const spShapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 }, fill: '#FF0000' },
		];
		const updated = withChartUserShapeRowUpdated(spShapes, [0], { fill: '#00FF00' });
		expect(updated[0]).toMatchObject({ fill: '#00FF00' });
		expect(next).toHaveLength(1);
	});

	it('patches a nested child by path and clears the ancestor grpSp rawXml', () => {
		const next = withChartUserShapeRowUpdated(grouped, [0, 0], {
			off: { x: 100000, y: 200000 },
			fill: '#0000FF',
		});
		expect(next[0].rawXml).toBeUndefined();
		expect(next[0].children![0]).toMatchObject({
			off: { x: 100000, y: 200000 },
			fill: '#0000FF',
		});
		// Original input is untouched.
		expect(grouped[0].rawXml).toBeDefined();
		expect(grouped[0].children![0].off).toStrictEqual({ x: 0, y: 0 });
	});

	it('patches a doubly-nested child, clearing every grpSp ancestor along the path', () => {
		const nested: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: grouped[0].transform,
				rawXml: { outer: true } as unknown as PptxChartUserShape['rawXml'],
				children: [
					{
						kind: 'grpSp',
						off: { x: 0, y: 0 },
						ext: { cx: 500000, cy: 500000 },
						transform: grouped[0].transform,
						rawXml: { inner: true } as unknown as PptxChartUserShape['rawXml'],
						children: [{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 100, cy: 100 } }],
					},
				],
			},
		];
		const next = withChartUserShapeRowUpdated(nested, [0, 0, 0], { fill: '#123456' });
		expect(next[0].rawXml).toBeUndefined();
		expect(next[0].children![0].rawXml).toBeUndefined();
		expect(next[0].children![0].children![0]).toMatchObject({ fill: '#123456' });
	});
});

describe('withChartUserShapeRowRemoved', () => {
	it('removes a nested child by path, leaving its siblings', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [
					{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 }, fill: '#FF0000' },
					{
						kind: 'sp',
						off: { x: 500000, y: 0 },
						ext: { cx: 500000, cy: 1000000 },
						fill: '#00FF00',
					},
				],
			},
		];
		const next = withChartUserShapeRowRemoved(shapes, [0, 0]);
		expect(next[0].children).toHaveLength(1);
		expect(next[0].children![0].fill).toBe('#00FF00');
	});

	it('removes a top-level row', () => {
		const shapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 } },
			{ kind: 'sp', anchor: 'rel', from: { x: 0.5, y: 0.5 }, to: { x: 0.7, y: 0.7 } },
		];
		expect(withChartUserShapeRowRemoved(shapes, [0])).toStrictEqual([shapes[1]]);
	});
});

describe('withChartUserShapeRowTextUpdated', () => {
	it('creates a first paragraph when the row has none', () => {
		const shapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 } },
		];
		const next = withChartUserShapeRowTextUpdated(shapes, [0], 'New label');
		expect(next[0].paragraphs).toStrictEqual([{ text: 'New label' }]);
	});

	it('preserves existing paragraph formatting and trailing paragraphs', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'sp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 0.2, y: 0.2 },
				paragraphs: [{ text: 'Old', bold: true, align: 'ctr' }, { text: 'Second line' }],
			},
		];
		const next = withChartUserShapeRowTextUpdated(shapes, [0], 'New');
		expect(next[0].paragraphs).toStrictEqual([
			{ text: 'New', bold: true, align: 'ctr' },
			{ text: 'Second line' },
		]);
	});

	it('edits a nested child row text by path', () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 1000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 1000000, cy: 1000000 },
				},
				children: [{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 } }],
			},
		];
		const next = withChartUserShapeRowTextUpdated(shapes, [0, 0], 'Grouped label');
		expect(next[0].children![0].paragraphs).toStrictEqual([{ text: 'Grouped label' }]);
	});
});
