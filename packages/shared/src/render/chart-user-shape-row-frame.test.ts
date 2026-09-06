import type { PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	createDefaultChartUserShapeGroupChild,
	withChartUserShapeGroupChildAdded,
} from './chart-user-shape-group-child';
import {
	getChartUserShapeGroupTransform,
	getChartUserShapeRowChartBox,
	withChartUserShapeRowChartBoxUpdated,
} from './chart-user-shape-row-frame';

/** Top grpSp spans the whole chart; left-half `sp`, right-half nested grpSp containing one full-bleed `cxnSp`. */
const NESTED: PptxChartUserShape[] = [
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
			{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 } },
			{
				kind: 'grpSp',
				off: { x: 500000, y: 0 },
				ext: { cx: 500000, cy: 1000000 },
				transform: {
					off: { x: 500000, y: 0 },
					ext: { cx: 500000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 500000, cy: 1000000 },
				},
				children: [{ kind: 'cxnSp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 } }],
			},
		],
	},
];

describe('getChartUserShapeRowChartBox', () => {
	it('returns undefined for a top-level row (no group ancestor)', () => {
		expect(getChartUserShapeRowChartBox(NESTED, [0])).toBeUndefined();
	});

	it('reads a directly nested leaf as the chart-relative left half', () => {
		expect(getChartUserShapeRowChartBox(NESTED, [0, 0])).toStrictEqual({
			anchor: 'rel',
			from: { x: 0, y: 0 },
			to: { x: 0.5, y: 1 },
		});
	});

	it('reads a nested group header as the chart-relative right half', () => {
		expect(getChartUserShapeRowChartBox(NESTED, [0, 1])).toStrictEqual({
			anchor: 'rel',
			from: { x: 0.5, y: 0 },
			to: { x: 1, y: 1 },
		});
	});

	it('composes through a doubly-nested child to the same box as its parent group', () => {
		expect(getChartUserShapeRowChartBox(NESTED, [0, 1, 0])).toStrictEqual({
			anchor: 'rel',
			from: { x: 0.5, y: 0 },
			to: { x: 1, y: 1 },
		});
	});

	it('presents an abs-rooted nested row as a fraction of the anchor box', () => {
		const abs: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'abs',
				from: { x: 0.2, y: 0.2 },
				ext: { cx: 2000000, cy: 1000000 },
				transform: {
					off: { x: 0, y: 0 },
					ext: { cx: 2000000, cy: 1000000 },
					chOff: { x: 0, y: 0 },
					chExt: { cx: 2000000, cy: 1000000 },
				},
				children: [{ kind: 'sp', off: { x: 1000000, y: 0 }, ext: { cx: 1000000, cy: 1000000 } }],
			},
		];
		expect(getChartUserShapeRowChartBox(abs, [0, 0])).toStrictEqual({
			anchor: 'abs',
			from: { x: 0.5, y: 0 },
			to: { x: 1, y: 1 },
		});
	});
});

describe('withChartUserShapeRowChartBoxUpdated', () => {
	it('converts a new chart-relative box back to EMU off/ext for a leaf child', () => {
		const next = withChartUserShapeRowChartBoxUpdated(NESTED, [0, 0], {
			from: { x: 0.1, y: 0.2 },
			to: { x: 0.4, y: 0.6 },
		});
		expect(next[0]!.children![0]).toMatchObject({
			off: { x: 100000, y: 200000 },
			ext: { cx: 300000, cy: 400000 },
		});
	});

	it('round-trips a nested group header, syncing transform.off/ext with the child-level off/ext', () => {
		const box = getChartUserShapeRowChartBox(NESTED, [0, 1])!;
		const next = withChartUserShapeRowChartBoxUpdated(NESTED, [0, 1], box);
		const group = next[0]!.children![1]!;
		expect(group).toMatchObject({ off: { x: 500000, y: 0 }, ext: { cx: 500000, cy: 1000000 } });
		expect(group.transform).toMatchObject({
			off: { x: 500000, y: 0 },
			ext: { cx: 500000, cy: 1000000 },
			chOff: { x: 0, y: 0 },
			chExt: { cx: 500000, cy: 1000000 },
		});
	});

	it('resizing a nested group keeps chExt fixed so children keep their relative fraction', () => {
		// Double the nested group's width (from 0.5..1 to 0.5..1.5 is out of
		// range, so instead shrink it to a quarter: 0.5..0.75).
		const next = withChartUserShapeRowChartBoxUpdated(NESTED, [0, 1], {
			from: { x: 0.5, y: 0 },
			to: { x: 0.75, y: 1 },
		});
		const group = next[0]!.children![1]!;
		expect(group.ext).toStrictEqual({ cx: 250000, cy: 1000000 });
		expect(group.transform!.chExt).toStrictEqual({ cx: 500000, cy: 1000000 });
		// The untouched grandchild still fills the whole (now-smaller) group.
		expect(getChartUserShapeRowChartBox(next, [0, 1, 0])).toStrictEqual({
			anchor: 'rel',
			from: { x: 0.5, y: 0 },
			to: { x: 0.75, y: 1 },
		});
	});
});

describe('group-child insertion', () => {
	it('sizes a default child inside the group own child coordinate space', () => {
		const transform = getChartUserShapeGroupTransform(NESTED, [0])!;
		const child = createDefaultChartUserShapeGroupChild(transform);
		expect(child).toMatchObject({
			kind: 'sp',
			off: { x: 350000, y: 400000 },
			ext: { cx: 300000, cy: 150000 },
		});
	});

	it('appends a new child into an existing group, clearing its stale rawXml', () => {
		const withRaw: PptxChartUserShape[] = [
			{ ...NESTED[0]!, rawXml: { 'cdr:grpSpPr': {} } as PptxChartUserShape['rawXml'] },
		];
		const transform = getChartUserShapeGroupTransform(withRaw, [0])!;
		const child = createDefaultChartUserShapeGroupChild(transform);
		const next = withChartUserShapeGroupChildAdded(withRaw, [0], child);
		expect(next[0]!.rawXml).toBeUndefined();
		expect(next[0]!.children).toHaveLength(3);
		expect(next[0]!.children![2]).toMatchObject({ kind: 'sp', off: { x: 350000, y: 400000 } });
	});

	it('appends into a nested group by path', () => {
		const transform = getChartUserShapeGroupTransform(NESTED, [0, 1])!;
		const child = createDefaultChartUserShapeGroupChild(transform);
		const next = withChartUserShapeGroupChildAdded(NESTED, [0, 1], child);
		expect(next[0]!.children![1]!.children).toHaveLength(2);
	});

	it('returns undefined transform for a non-group path', () => {
		expect(getChartUserShapeGroupTransform(NESTED, [0, 0])).toBeUndefined();
	});
});
