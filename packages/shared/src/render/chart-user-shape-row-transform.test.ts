import type { PptxChartUserShape } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	withChartUserShapeRowFlipUpdated,
	withChartUserShapeRowRotationUpdated,
} from './chart-user-shape-row-transform';
import { listChartUserShapeRows } from './chart-user-shape-tree';

const GROUP_TRANSFORM = {
	off: { x: 0, y: 0 },
	ext: { cx: 1000000, cy: 1000000 },
	chOff: { x: 0, y: 0 },
	chExt: { cx: 1000000, cy: 1000000 },
};

describe('rotation on ChartUserShapeRow / withChartUserShapeRowRotationUpdated', () => {
	it("reads a grpSp row's rotation from its own transform, not a flat field", () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: { ...GROUP_TRANSFORM, rotation: 15 },
				children: [
					{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 }, rotation: 7.5 },
				],
			},
		];
		const rows = listChartUserShapeRows(shapes);
		expect(rows[0]!.rotation).toBe(15);
		expect(rows[1]!.rotation).toBe(7.5);
	});

	it('patches a leaf row rotation directly', () => {
		const shapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 } },
		];
		const next = withChartUserShapeRowRotationUpdated(shapes, [0], 30);
		expect(next[0]).toMatchObject({ rotation: 30 });
		const cleared = withChartUserShapeRowRotationUpdated(next, [0], undefined);
		expect(cleared[0]!.rotation).toBeUndefined();
	});

	it("patches a grpSp row's rotation into its transform, not a flat field", () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: { ...GROUP_TRANSFORM },
				children: [],
			},
		];
		const next = withChartUserShapeRowRotationUpdated(shapes, [0], 45);
		expect(next[0]).not.toHaveProperty('rotation');
		expect(next[0]!.transform!.rotation).toBe(45);
		const cleared = withChartUserShapeRowRotationUpdated(next, [0], 0);
		expect(cleared[0]!.transform!.rotation).toBeUndefined();
	});
});

describe('flip on ChartUserShapeRow / withChartUserShapeRowFlipUpdated', () => {
	it("reads a grpSp row's flip from its own transform, not a flat field", () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: { ...GROUP_TRANSFORM, flipH: true },
				children: [
					{ kind: 'sp', off: { x: 0, y: 0 }, ext: { cx: 500000, cy: 1000000 }, flipV: true },
				],
			},
		];
		const rows = listChartUserShapeRows(shapes);
		expect(rows[0]).toMatchObject({ flipH: true, flipV: undefined });
		expect(rows[1]).toMatchObject({ flipH: undefined, flipV: true });
	});

	it('patches a leaf row flip directly, one axis at a time', () => {
		const shapes: PptxChartUserShape[] = [
			{ kind: 'sp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 0.2, y: 0.2 } },
		];
		const flippedH = withChartUserShapeRowFlipUpdated(shapes, [0], { flipH: true });
		expect(flippedH[0]).toMatchObject({ flipH: true });
		expect(flippedH[0]).not.toHaveProperty('flipV');

		const flippedBoth = withChartUserShapeRowFlipUpdated(flippedH, [0], { flipV: true });
		expect(flippedBoth[0]).toMatchObject({ flipH: true, flipV: true });

		const clearedH = withChartUserShapeRowFlipUpdated(flippedBoth, [0], { flipH: false });
		expect(clearedH[0]).not.toHaveProperty('flipH');
		expect(clearedH[0]).toMatchObject({ flipV: true });
	});

	it("patches a grpSp row's flip into its transform, not a flat field", () => {
		const shapes: PptxChartUserShape[] = [
			{
				kind: 'grpSp',
				anchor: 'rel',
				from: { x: 0, y: 0 },
				to: { x: 1, y: 1 },
				transform: { ...GROUP_TRANSFORM },
				children: [],
			},
		];
		const next = withChartUserShapeRowFlipUpdated(shapes, [0], { flipH: true, flipV: true });
		expect(next[0]).not.toHaveProperty('flipH');
		expect(next[0]!.transform).toMatchObject({ flipH: true, flipV: true });
		const cleared = withChartUserShapeRowFlipUpdated(next, [0], { flipH: false, flipV: false });
		expect(cleared[0]!.transform).not.toHaveProperty('flipH');
		expect(cleared[0]!.transform).not.toHaveProperty('flipV');
	});

	it('does nothing to a grpSp row with no transform', () => {
		const shapes: PptxChartUserShape[] = [
			{ kind: 'grpSp', anchor: 'rel', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, children: [] },
		];
		const next = withChartUserShapeRowFlipUpdated(shapes, [0], { flipH: true });
		expect(next[0]!.transform).toBeUndefined();
	});
});
