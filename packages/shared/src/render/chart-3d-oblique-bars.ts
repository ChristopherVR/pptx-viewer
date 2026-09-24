/**
 * Bars, gridlines and value-label text for the right-angle-axes 3D bar chart
 * (`chart-3d-oblique-layout.ts`), in the layout's world space.
 *
 * @module chart-3d-oblique-bars
 */
import type { PptxBar3DShape, PptxChartData } from 'pptx-viewer-core';

import type {
	ObliqueBar,
	ObliqueChartLayout,
	ObliqueGridline,
	ObliqueTaper,
} from './chart-3d-oblique-layout';
import { formatAxisValueWithUnits } from './chart-axis';
import { axisTickValues } from './chart-view-model-chrome';
import type { ChartViewModel } from './chart-view-model-types';

type Grouping = ObliqueChartLayout['grouping'];

/** Value-axis label text (`percentStacked` axes read as whole percents). */
export function formatValueLabel(chartData: PptxChartData, grouping: Grouping, v: number): string {
	if (grouping === 'percentStacked') {
		return `${Math.round(v * 100)}%`;
	}
	return formatAxisValueWithUnits(
		v,
		chartData.axes?.find((a) => a.axisType === 'valAx'),
	);
}

/**
 * A shaped bar's taper between world positions `lo` and `hi` along a value
 * axis `extent` long. A cone or pyramid comes to a point at its value end
 * (the far end from the baseline, so a negative bar points down); the
 * `...ToMax` shapes are slices of one solid whose apex sits at the axis end.
 */
export function obliqueBarTaper(
	shape: PptxBar3DShape,
	lo: number,
	hi: number,
	extent: number,
	value: number,
): ObliqueTaper {
	switch (shape) {
		case 'cone':
		case 'pyramid':
			return value >= 0 ? { bottom: 1, top: 0 } : { bottom: 0, top: 1 };
		case 'coneToMax':
		case 'pyramidToMax': {
			const at = (p: number): number => Math.min(1, Math.max(0, 1 - p / Math.max(extent, 1e-9)));
			return { bottom: at(lo), top: at(hi) };
		}
		default:
			return { bottom: 1, top: 1 };
	}
}

/** Axis position (world units along the value axis) of a value. */
function valuePos(layout: ObliqueChartLayout, v: number): number {
	return (v - layout.range.min) * layout.valueScale;
}

export function buildBars(
	chartData: PptxChartData,
	vm: ChartViewModel,
	layout: ObliqueChartLayout,
	dims: { nCat: number; slots: number; rows: number; gapWidth: number; gapDepth: number },
): ObliqueBar[] {
	const catExtent = layout.horizontal ? layout.box.h : layout.box.w;
	const catWidth = catExtent / dims.nCat;
	const barW = catWidth / (dims.slots + dims.gapWidth);
	const rowDepth = barW * (1 + dims.gapDepth);
	const colors = seriesColors(chartData, vm);
	const valueExtent = layout.horizontal ? layout.box.w : layout.box.h;
	const baseline = Math.min(Math.max(0, layout.range.min), layout.range.max);
	const bars: ObliqueBar[] = [];
	for (let c = 0; c < dims.nCat; c++) {
		let pos = baseline;
		let neg = baseline;
		const total = chartData.series.reduce((sum, s) => sum + Math.abs(s.values[c] ?? 0), 0);
		chartData.series.forEach((series, s) => {
			const raw = series.values[c];
			if (raw === undefined || Number.isNaN(raw)) {
				return;
			}
			const value = layout.grouping === 'percentStacked' ? (total ? raw / total : 0) : raw;
			let from = baseline;
			let to = value;
			if (layout.grouping === 'stacked' || layout.grouping === 'percentStacked') {
				from = value >= 0 ? pos : neg;
				to = from + value;
				if (value >= 0) {
					pos = to;
				} else {
					neg = to;
				}
			}
			const shape = series.shape ?? chartData.barShape ?? 'box';
			const slot = layout.grouping === 'clustered' ? s : 0;
			const row = layout.grouping === 'standard' ? s : 0;
			const catStart = c * catWidth + (dims.gapWidth * barW) / 2 + slot * barW;
			const lo = valuePos(layout, Math.max(Math.min(from, to), layout.range.min));
			const hi = valuePos(layout, Math.min(Math.max(from, to), layout.range.max));
			const z = row * rowDepth + (rowDepth - barW) / 2;
			const along = layout.horizontal
				? { x: lo, w: Math.max(hi - lo, 0), y: catStart, h: barW }
				: { x: catStart, w: barW, y: lo, h: Math.max(hi - lo, 0) };
			bars.push({
				...along,
				z,
				d: barW,
				color: colors[s],
				seriesIndex: s,
				categoryIndex: c,
				value: raw,
				shape,
				taper: obliqueBarTaper(shape, lo, hi, valueExtent, raw),
			});
		});
	}
	return bars;
}

/** Series colours as the flat chart resolved them (legend swatches carry them). */
function seriesColors(chartData: PptxChartData, vm: ChartViewModel): string[] {
	return chartData.series.map(
		(s, i) =>
			vm.legend.find((entry) => entry.label === s.name)?.color ?? vm.legend[i]?.color ?? '#4472c4',
	);
}

export function buildGridlines(layout: ObliqueChartLayout): ObliqueGridline[] {
	const { w, h, d } = layout.box;
	const lines: ObliqueGridline[] = [];
	const span = layout.range.max - layout.range.min;
	for (const v of axisTickValues({ ...layout.range, span })) {
		const p = valuePos(layout, v);
		if (layout.horizontal) {
			lines.push({ from: [p, 0, d], to: [p, h, d] }, { from: [p, 0, 0], to: [p, 0, d] });
		} else {
			lines.push({ from: [0, p, d], to: [w, p, d] }, { from: [0, p, 0], to: [0, p, d] });
		}
	}
	return lines;
}
