/**
 * Column bars of a `bar3D` chart WITHOUT right-angle axes
 * (`c:view3D/@rAngAx=0`) on the perspective box (`chart-3d-persp-layout.ts`),
 * as box-space prisms. The bar sizing follows the right-angle-axes layout
 * (`chart-3d-oblique-bars.ts`), whose conventions PowerPoint shares: a bar's
 * depth equals its width, `clustered` series sit side by side in one row,
 * `stacked` ones share a bar, and `standard` gives each series its own row.
 *
 * @module chart-3d-persp-bars
 */
import type { PptxChartData } from 'pptx-viewer-core';

import type { PerspChartLayout } from './chart-3d-persp-layout';
import type { PerspPrism } from './chart-3d-persp-marks';

const DEFAULT_GAP_WIDTH = 150;

type LayoutCore = Pick<
	PerspChartLayout,
	'grouping' | 'range' | 'valueScale' | 'categoryX' | 'rowDepth' | 'colors'
>;

function valueY(layout: Pick<LayoutCore, 'range' | 'valueScale'>, v: number): number {
	const clamped = Math.min(Math.max(v, layout.range.min), layout.range.max);
	return (clamped - layout.range.min) * layout.valueScale;
}

/** One prism per bar; `override` replaces one point's value (a drag preview). */
export function buildPerspBarPrisms(
	chartData: PptxChartData,
	layout: LayoutCore,
	override?: { seriesIndex: number; pointIndex: number; value: number },
): PerspPrism[] {
	const nCat = layout.categoryX.length;
	const nSer = chartData.series.length;
	const slot = nCat > 0 ? 1 / nCat : 1;
	const gapWidth = (chartData.barGapWidth ?? DEFAULT_GAP_WIDTH) / 100;
	const slots = layout.grouping === 'clustered' ? nSer : 1;
	const barW = slot / (slots + gapWidth);
	const depth = Math.min(barW, layout.rowDepth);
	const stacked = layout.grouping === 'stacked' || layout.grouping === 'percentStacked';
	const baseline = Math.min(Math.max(0, layout.range.min), layout.range.max);
	const prisms: PerspPrism[] = [];
	for (let c = 0; c < nCat; c++) {
		const valueOf = (s: number): number => {
			if (override && override.seriesIndex === s && override.pointIndex === c) {
				return override.value;
			}
			const v = chartData.series[s]?.values[c];
			return v !== undefined && Number.isFinite(v) ? v : 0;
		};
		const total = chartData.series.reduce((t, _s, s) => t + Math.abs(valueOf(s)), 0);
		let pos = baseline;
		let neg = baseline;
		for (let s = 0; s < nSer; s++) {
			const raw = valueOf(s);
			const value = layout.grouping === 'percentStacked' ? (total ? raw / total : 0) : raw;
			let from = baseline;
			let to = value;
			if (stacked) {
				from = value >= 0 ? pos : neg;
				to = from + value;
				if (value >= 0) {
					pos = to;
				} else {
					neg = to;
				}
			}
			const slotIndex = layout.grouping === 'clustered' ? s : 0;
			const row = layout.grouping === 'standard' ? s : 0;
			const x0 = c * slot + (gapWidth * barW) / 2 + slotIndex * barW;
			const y0 = valueY(layout, Math.min(from, to));
			const y1 = Math.max(valueY(layout, Math.max(from, to)), y0 + 1e-6);
			const z0 = row * layout.rowDepth + (layout.rowDepth - depth) / 2;
			prisms.push({
				seriesIndex: s,
				pointIndex: c,
				color: layout.colors[s],
				outline: [
					[x0, y0],
					[x0 + barW, y0],
					[x0 + barW, y1],
					[x0, y1],
				],
				z0,
				z1: z0 + depth,
			});
		}
	}
	return prisms;
}
