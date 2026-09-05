import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildBarChart3DData, buildBarChart3DDataForElement } from './bar-chart-3d-data';

function makeBarData(overrides: Partial<PptxChartData> = {}): PptxChartData {
	return {
		chartType: 'bar3D',
		categories: ['A', 'B', 'C'],
		series: [
			{ name: 'S1', values: [10, 20, 30] },
			{ name: 'S2', values: [15, 5, 25] },
		],
		...overrides,
	};
}

describe('buildBarChart3DData', () => {
	it('returns null when there are no series', () => {
		const data: PptxChartData = { chartType: 'bar3D', categories: ['A'], series: [] };
		expect(buildBarChart3DData(data, ['A'], { width: 400, height: 300 })).toBeNull();
	});

	it('returns null when there are no categories', () => {
		const data = makeBarData();
		expect(buildBarChart3DData(data, [], { width: 400, height: 300 })).toBeNull();
	});

	it('sizes cols/rows from categories/series and produces one box per cell (clustered)', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result).not.toBeNull();
		expect(result!.cols).toBe(3);
		expect(result!.rows).toBe(2);
		expect(result!.boxes).toHaveLength(6);
		expect(result!.grouping).toBe('clustered');
	});

	it('transposes every box center for a horizontal (barDir=bar) chart, matching transposeForHorizontalBar3D, while sizes stay in the unrotated local frame', () => {
		const vertical = makeBarData({ barDirection: 'col' });
		const horizontal = makeBarData({ barDirection: 'bar' });
		const verticalResult = buildBarChart3DData(vertical, vertical.categories, {
			width: 400,
			height: 300,
		})!;
		const horizontalResult = buildBarChart3DData(horizontal, horizontal.categories, {
			width: 400,
			height: 300,
		})!;
		expect(horizontalResult.horizontal).toBeTruthy();
		expect(verticalResult.horizontal).toBeUndefined();
		for (let i = 0; i < verticalResult.boxes.length; i++) {
			const v = verticalResult.boxes[i];
			const h = horizontalResult.boxes[i];
			expect(h.center).toStrictEqual([v.center[1], -v.center[0], v.center[2]]);
			// Sizes are NOT swapped: the scene rotates the mesh instead so
			// non-box shapes keep a true (non-elliptical) cross-section.
			expect(h.size).toStrictEqual(v.size);
		}
	});

	it('resolves each box shape from the series override, else the chart-level barShape', () => {
		const data = makeBarData({
			barShape: 'cylinder',
			series: [
				{ name: 'S1', values: [10, 20, 30] },
				{ name: 'S2', values: [15, 5, 25], shape: 'cone' },
			],
		});
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 })!;
		const shapesBySeries = new Map<number, Set<string | undefined>>();
		for (const box of result.boxes) {
			const set = shapesBySeries.get(box.seriesIndex) ?? new Set();
			set.add(box.shape);
			shapesBySeries.set(box.seriesIndex, set);
		}
		expect([...shapesBySeries.get(0)!]).toStrictEqual(['cylinder']);
		expect([...shapesBySeries.get(1)!]).toStrictEqual(['cone']);
	});

	it('leaves the box shape undefined when neither series nor chart declares one', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 })!;
		expect(result.boxes.every((box) => box.shape === undefined)).toBeTruthy();
	});

	it('gives every series its own Z (depth) position in clustered mode', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		const s1Boxes = result!.boxes.filter((b) => b.seriesIndex === 0);
		const s2Boxes = result!.boxes.filter((b) => b.seriesIndex === 1);
		// Every box within a series shares the same Z; the two series differ.
		const s1Z = new Set(s1Boxes.map((b) => b.center[2]));
		const s2Z = new Set(s2Boxes.map((b) => b.center[2]));
		expect(s1Z.size).toBe(1);
		expect(s2Z.size).toBe(1);
		expect([...s1Z][0]).not.toBeCloseTo([...s2Z][0]);
	});

	it('gives every box in clustered mode a distinct category X position', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		const s1Boxes = result!.boxes.filter((b) => b.seriesIndex === 0);
		const xs = s1Boxes.map((b) => b.center[0]);
		expect(new Set(xs).size).toBe(3);
		// Ascending category index -> ascending X.
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);
	});

	it('taller values get taller boxes (clustered)', () => {
		const data: PptxChartData = {
			chartType: 'bar3D',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [10, 100] }],
		};
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		const [boxA, boxB] = result!.boxes;
		expect(boxB.size[1]).toBeGreaterThan(boxA.size[1]);
	});

	it('positions a negative value box below the zero baseline', () => {
		const data: PptxChartData = {
			chartType: 'bar3D',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [-10, 10] }],
		};
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		const [negBox, posBox] = result!.boxes;
		expect(negBox.center[1]).toBeLessThan(posBox.center[1]);
	});

	it('stacked mode keeps every series coplanar (same Z) and stacks in Y', () => {
		const data = makeBarData({ grouping: 'stacked' });
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.grouping).toBe('stacked');
		const zs = new Set(result!.boxes.map((b) => b.center[2]));
		expect(zs.size).toBe(1);
		// Series 1 (bottom) sits below series 2 (top) for the same category.
		const catABoxes = result!.boxes
			.filter((b) => b.categoryIndex === 0)
			.sort((a, b) => a.seriesIndex - b.seriesIndex);
		expect(catABoxes[0].center[1]).toBeLessThan(catABoxes[1].center[1]);
	});

	it('percentStacked normalises each category to a 0-100 range but keeps authored values for display', () => {
		const data = makeBarData({ grouping: 'percentStacked' });
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.grouping).toBe('percentStacked');
		// Authored (non-percent) values are preserved on each box for tooltip/display.
		const values = result!.boxes.map((b) => b.value).sort((a, b) => a - b);
		expect(values).toStrictEqual([5, 10, 15, 20, 25, 30]);
	});

	it('resolves series colour from the palette when the series has none', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		for (const box of result!.boxes) {
			expect(box.color).toMatch(/^#/u);
		}
	});

	it('honours an explicit series colour', () => {
		const data: PptxChartData = {
			chartType: 'bar3D',
			categories: ['A'],
			series: [{ name: 'S1', values: [1], color: '#ABCDEF' }],
		};
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.boxes[0].color.toUpperCase()).toBe('#ABCDEF');
	});

	it('carries view3D rotX/rotY/perspective/depthPercent through to scene options', () => {
		const data = makeBarData({
			view3D: { rotX: 25, rotY: 130, perspective: 45, depthPercent: 60, rAngAx: false },
		});
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.view3D).toStrictEqual({
			rotX: 25,
			rotY: 130,
			rperspective: 45,
			depthPercent: 60,
			rAngAx: false,
		});
	});

	it('leaves view3D undefined when the chart has none authored', () => {
		const data = makeBarData();
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.view3D).toBeUndefined();
	});

	it('carries floor/sideWall/backWall fill colours through as wallColors', () => {
		const data = makeBarData({
			floor: { spPr: { fillColor: '#111111' } },
			sideWall: { spPr: { fillColor: '#222222' } },
		});
		const result = buildBarChart3DData(data, data.categories, { width: 400, height: 300 });
		expect(result!.wallColors).toStrictEqual({
			floor: '#111111',
			sideWall: '#222222',
			backWall: undefined,
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBarChart3DDataForElement - the single decision point every binding
// calls to gate the interactive 3D scene.
// ─────────────────────────────────────────────────────────────────────────────

function makeChartElement(
	chartData: PptxChartData | undefined,
	width = 400,
	height = 300,
): PptxElement {
	return {
		id: 'el-1',
		type: 'chart',
		x: 0,
		y: 0,
		width,
		height,
		chartData,
	} as unknown as PptxElement;
}

describe('buildBarChart3DDataForElement', () => {
	it('returns null for a non-chart element', () => {
		const element = { id: 'el-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(buildBarChart3DDataForElement(element, { width: 10, height: 10 })).toBeNull();
	});

	it('returns null when the chart has no data', () => {
		expect(
			buildBarChart3DDataForElement(makeChartElement(undefined), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for a plain (non-3D) bar chart, even though resolveChartKind folds both to "bar"', () => {
		const data: PptxChartData = {
			chartType: 'bar',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		expect(
			buildBarChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('returns null for any other 3D chart kind (pie3D)', () => {
		const data: PptxChartData = {
			chartType: 'pie3D',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
		};
		expect(
			buildBarChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).toBeNull();
	});

	it('resolves a horizontal (barDir=bar) 3-D Bar chart and flags it horizontal', () => {
		const data = makeBarData({ barDirection: 'bar' });
		const result = buildBarChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.horizontal).toBeTruthy();
		expect(result!.boxes).toHaveLength(6);
	});

	it('does not flag horizontal for a plain vertical (barDir=col) 3-D Bar chart', () => {
		const data = makeBarData({ barDirection: 'col' });
		const result = buildBarChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.horizontal).toBeUndefined();
	});

	it('resolves a bar3D chart', () => {
		const data = makeBarData();
		expect(
			buildBarChart3DDataForElement(makeChartElement(data), { width: 400, height: 300 }),
		).not.toBeNull();
	});

	it('falls back to 1-based index labels when categories are empty, matching buildChartViewModel', () => {
		const data = makeBarData({ categories: [] });
		const result = buildBarChart3DDataForElement(makeChartElement(data), {
			width: 400,
			height: 300,
		});
		expect(result).not.toBeNull();
		expect(result!.categoryLabels).toStrictEqual(['1', '2', '3']);
	});
});
