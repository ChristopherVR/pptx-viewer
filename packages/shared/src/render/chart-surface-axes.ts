/**
 * Axis chrome for the surface chart kind: category/series edge labels for
 * both projections, plus the value (Z) axis the 3-D isometric one alone
 * draws. COM-verified against `charts-com.pptx` slides 7-10 (surface types
 * 83-86): every one of the four surface subtypes labels its category and
 * series axes, and the two 3-D ones additionally draw a left-side numeric
 * value axis; the two top-view ("Contour") ones draw no value axis at all,
 * since a top-view surface has no Z dimension to show a scale for.
 *
 * Split out of `chart-surface-flat.ts` / `chart-surface-isometric.ts` to keep
 * each view-model builder under the repo's ~300-LOC budget.
 *
 * @module chart-surface-axes
 */
import type { PptxChartSeries } from 'pptx-viewer-core';

import { DEFAULT_CHART_TEXT_PX } from './chart-font';
import { AXIS_LABEL_COLOR, buildGridlinesAndLabels } from './chart-view-model-chrome';
import type { ValueRange } from './chart-view-model-scale';
import type { PlotLayout, SvgLine, SvgText } from './chart-view-model-types';

/** Category-axis (bottom) + series-axis (right) labels for the 2-D top-view grid. */
export function buildSurfaceTopViewAxisLabels(
	categoryLabels: ReadonlyArray<string>,
	series: ReadonlyArray<PptxChartSeries>,
	layout: PlotLayout,
): SvgText[] {
	const catCount = Math.max(categoryLabels.length, 1);
	const cellW = layout.plotWidth / catCount;
	const labels: SvgText[] = categoryLabels.map((label, i) => ({
		kind: 'text',
		x: layout.plotLeft + cellW * (i + 0.5),
		y: layout.plotBottom + 14,
		text: label,
		fontSize: DEFAULT_CHART_TEXT_PX,
		fill: AXIS_LABEL_COLOR,
		textAnchor: 'middle',
	}));

	const seriesCount = Math.max(series.length, 1);
	const cellH = layout.plotHeight / seriesCount;
	series.forEach((s, i) => {
		labels.push({
			kind: 'text',
			x: layout.plotRight + 6,
			y: layout.plotTop + cellH * (i + 0.5),
			text: s.name,
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'start',
			dominantBaseline: 'central',
		});
	});
	return labels;
}

/** Project a grid point at the given cell/row and z=0 to offset screen space. */
type Project = (col: number, row: number) => { screenX: number; screenY: number };

/**
 * Category/series edge labels for the isometric 3-D mesh, placed along the
 * two front-bottom receding edges the way PowerPoint draws them: category
 * labels trail the near-left edge (row = `rows`), series labels trail the
 * near-right edge (col = `cols`).
 */
export function buildSurfaceIsometricEdgeLabels(
	categoryLabels: ReadonlyArray<string>,
	series: ReadonlyArray<PptxChartSeries>,
	cols: number,
	rows: number,
	project: Project,
): SvgText[] {
	const labels: SvgText[] = [];
	const catCount = Math.max(categoryLabels.length, 1);
	for (let c = 0; c < catCount; c++) {
		const label = categoryLabels[c];
		if (!label) {
			continue;
		}
		const p = project(Math.min(c, cols), rows);
		labels.push({
			kind: 'text',
			x: p.screenX,
			y: p.screenY + 14,
			text: label,
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'middle',
		});
	}

	series.forEach((s, i) => {
		const p = project(cols, Math.min(i, rows));
		labels.push({
			kind: 'text',
			x: p.screenX + 8,
			y: p.screenY + 6,
			text: s.name,
			fontSize: DEFAULT_CHART_TEXT_PX,
			fill: AXIS_LABEL_COLOR,
			textAnchor: 'start',
		});
	});
	return labels;
}

/**
 * Left-side numeric value (Z) axis for the isometric 3-D surface, drawn as a
 * plain vertical ladder (not iso-skewed, matching PowerPoint's own static
 * left axis) spanning the plot's full height with one tick per
 * `range.majorUnit`. 3-D surface only; a top-view surface has no value axis.
 */
export function buildSurfaceValueAxis(
	range: ValueRange,
	layout: PlotLayout,
): { gridlines: SvgLine[]; axisLabels: SvgText[] } {
	const { axisLabels } = buildGridlinesAndLabels(range, layout, false);
	const gridlines: SvgLine[] = [
		{
			kind: 'line',
			x1: layout.plotLeft,
			y1: layout.plotTop,
			x2: layout.plotLeft,
			y2: layout.plotBottom,
			stroke: AXIS_LABEL_COLOR,
			strokeWidth: 1,
		},
	];
	return { gridlines, axisLabels };
}
