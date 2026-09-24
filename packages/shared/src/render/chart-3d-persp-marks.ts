/**
 * Marks of the perspective 3D line / area charts (`chart-3d-persp-layout.ts`)
 * as box-space prisms: a polygon in the category/value (x/y) plane extruded
 * through a depth range, which is how PowerPoint draws both families
 * (`gt/chart-10..13`):
 *
 * - 3-D Area: one slab per series, the area polygon down to the baseline,
 *   `markDepth` deep and centred in its row. Stacked groupings share one row
 *   and stack each series on the running sum (`percentStacked` normalised).
 * - 3-D Line: one ribbon per series in its own row, the polyline thickened
 *   by a hairline so the tape has an edge to see.
 *
 * @module chart-3d-persp-marks
 */
import type { PptxChartData } from 'pptx-viewer-core';

import type { PerspChartLayout } from './chart-3d-persp-layout';

/** Ribbon thickness, as a fraction of the box height. */
const RIBBON_THICKNESS = 0.012;

export interface PerspPrism {
	seriesIndex: number;
	color: string;
	/** Polygon in box x/y, counter-clockwise. */
	outline: Array<[number, number]>;
	z0: number;
	z1: number;
}

type LayoutCore = Pick<
	PerspChartLayout,
	| 'kind'
	| 'grouping'
	| 'view'
	| 'range'
	| 'valueScale'
	| 'categoryX'
	| 'rowDepth'
	| 'markDepth'
	| 'colors'
>;

/** Box y of a value, clipped to the axis. */
export function perspValueY(layout: Pick<LayoutCore, 'range' | 'valueScale'>, v: number): number {
	const clamped = Math.min(Math.max(v, layout.range.min), layout.range.max);
	return (clamped - layout.range.min) * layout.valueScale;
}

/** Depth range of a row's mark. */
export function perspRowSpan(
	layout: Pick<LayoutCore, 'rowDepth' | 'markDepth'>,
	row: number,
): [number, number] {
	const z0 = row * layout.rowDepth + (layout.rowDepth - layout.markDepth) / 2;
	return [z0, z0 + layout.markDepth];
}

function finite(v: number | undefined): number {
	return v !== undefined && Number.isFinite(v) ? v : 0;
}

/** Values series by series, `percentStacked` normalised to category totals. */
function plottedValues(chartData: PptxChartData, layout: LayoutCore, nCat: number): number[][] {
	const raw = chartData.series.map((s) =>
		Array.from({ length: nCat }, (_, c) => finite(s.values[c])),
	);
	if (layout.grouping !== 'percentStacked') {
		return raw;
	}
	const totals = Array.from({ length: nCat }, (_, c) =>
		raw.reduce((t, s) => t + Math.abs(s[c]), 0),
	);
	return raw.map((s) => s.map((v, c) => (totals[c] ? v / totals[c] : 0)));
}

/**
 * The prisms for a line or area chart; `override` replaces one point's value
 * (a live drag preview).
 */
export function buildPerspPrisms(
	chartData: PptxChartData,
	layout: LayoutCore,
	override?: { seriesIndex: number; pointIndex: number; value: number },
): PerspPrism[] {
	const nCat = layout.categoryX.length;
	const values = plottedValues(chartData, layout, nCat);
	if (override) {
		const row = values[override.seriesIndex];
		if (row && override.pointIndex < nCat) {
			row[override.pointIndex] = override.value;
		}
	}
	const xs = layout.categoryX;
	const baseY = perspValueY(layout, Math.max(0, layout.range.min));
	const prisms: PerspPrism[] = [];
	if (layout.kind === 'line') {
		const t = (layout.view.box.h * RIBBON_THICKNESS) / 2;
		values.forEach((series, s) => {
			const ys = series.map((v) => perspValueY(layout, v));
			const [z0, z1] = perspRowSpan(layout, s);
			prisms.push({
				seriesIndex: s,
				color: layout.colors[s],
				outline: [
					...xs.map((x, c): [number, number] => [x, ys[c] - t]),
					...xs.map((x, c): [number, number] => [x, ys[c] + t]).reverse(),
				],
				z0,
				z1,
			});
		});
		return prisms;
	}
	const stacked = layout.grouping !== 'standard';
	const running = new Array<number>(nCat).fill(0);
	values.forEach((series, s) => {
		const lower = stacked ? running.map((v) => perspValueY(layout, v)) : xs.map(() => baseY);
		const upper = series.map((v, c) => perspValueY(layout, stacked ? running[c] + v : v));
		if (stacked) {
			series.forEach((v, c) => {
				running[c] += v;
			});
		}
		const [z0, z1] = perspRowSpan(layout, stacked ? 0 : s);
		prisms.push({
			seriesIndex: s,
			color: layout.colors[s],
			outline: [
				...xs.map((x, c): [number, number] => [x, lower[c]]),
				...xs.map((x, c): [number, number] => [x, upper[c]]).reverse(),
			],
			z0,
			z1,
		});
	});
	return prisms;
}
