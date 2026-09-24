/**
 * Isometric-projection view-model builder for the surface chart kind
 * (`c:surface3DChart`, PowerPoint's "3-D Surface" / "3-D Surface
 * (Wireframe)" types).
 *
 * Split out of `chart-surface-treemap.ts` (which re-exports the dispatcher
 * that calls this) to keep that file's several chart-kind builders each
 * under the repo's per-file line budget.
 *
 * COM-verified against `charts-com.pptx` slides 7-8 (surface types 83/84):
 * PowerPoint draws a static left-side numeric value axis, category labels
 * trailing the near-left receding edge, series labels trailing the
 * near-right one, and a value-band legend (never a per-series one). A
 * wireframe surface omits every facet's fill, drawing mesh edges only.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (renderIsometricSurfaceFallback)
 *
 * @module chart-surface-isometric
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { resolveChartTitleText } from './chart-auto-title';
import { buildSurfaceIsometricEdgeLabels, buildSurfaceValueAxis } from './chart-surface-axes';
import { buildSurfaceWallPanels, ISO_COS30, ISO_SIN30, isoProject } from './chart-surface-bands';
import { emptyChrome } from './chart-surface-common';
import {
	buildSurfaceLegend,
	buildSurfaceValueBands,
	surfaceBandColorAt,
} from './chart-surface-legend';
import type { ChartValueDrag, ChartViewModel, SvgPolygon } from './chart-view-model';
import { buildMarkTooltip, computePlotLayout, computeValueRange } from './chart-view-model';

/**
 * Build the view-model for a surface chart's isometric 3-D-like projection.
 *
 * Mirrors `renderIsometricSurfaceFallback` in React's `chart-surface-treemap.tsx`.
 */
export function buildIsometricSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const range = computeValueRange(chartData.series, layout.autoPlotHeight);
	const bands = buildSurfaceValueBands(range, chartData.bandFmts);
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;
	// See `chart-surface-flat.ts`'s `isWireframe` for why absent defaults to filled.
	const isWireframe = chartData.wireframe === true;

	// Grid cell count (vertices = cells + 1 in each dimension).
	const cols = Math.max(catCount - 1, 1);
	const rows = Math.max(seriesCount - 1, 1);

	const gridSpan = cols + rows;
	const cellByWidth = (layout.plotWidth * 0.9) / (gridSpan * ISO_COS30);
	const cellByHeight = (layout.plotHeight * 0.65) / (gridSpan * ISO_SIN30);
	const cellSize = Math.max(Math.min(cellByWidth, cellByHeight), 0.5);

	const zHeadroom = layout.plotHeight * 0.3;
	const zScale = range.span > 0 ? zHeadroom : 0;

	const normValue = (r: number, c: number): number => {
		const ri = Math.min(r, seriesCount - 1);
		const ci = Math.min(c, catCount - 1);
		const val = chartData.series[ri]?.values[ci] ?? 0;
		return range.span > 0 ? (val - range.min) / range.span : 0;
	};

	// Compute isometric bounding box to centre the projection.
	const projectedPoints: Array<{ screenX: number; screenY: number }> = [];
	for (let r = 0; r <= rows; r++) {
		for (let c = 0; c <= cols; c++) {
			projectedPoints.push(isoProject(c * cellSize, r * cellSize, normValue(r, c) * zScale));
		}
	}

	const minSX = Math.min(...projectedPoints.map((p) => p.screenX));
	const maxSX = Math.max(...projectedPoints.map((p) => p.screenX));
	const minSY = Math.min(...projectedPoints.map((p) => p.screenY));
	const maxSY = Math.max(...projectedPoints.map((p) => p.screenY));
	const projW = maxSX - minSX;
	const projH = maxSY - minSY;

	// Reserve a left-hand column for the value axis so the mesh does not draw
	// over its own tick labels; only the 3-D projection has one (a top-view
	// surface has no Z axis at all, see `chart-surface-flat.ts`).
	const axisReserve = 34;
	const meshLeft = layout.plotLeft + axisReserve;
	const meshWidth = layout.plotWidth - axisReserve;

	const offsetX = meshLeft + meshWidth / 2 - (minSX + projW / 2);
	const offsetY = layout.plotTop + layout.plotHeight / 2 - (minSY + projH / 2);
	const project = (col: number, row: number): { screenX: number; screenY: number } => {
		const p = isoProject(col * cellSize, row * cellSize, 0);
		return { screenX: p.screenX + offsetX, screenY: p.screenY + offsetY };
	};

	// Cells sorted back-to-front (painter's algorithm: lower row+col = farther).
	type CellEntry = { row: number; col: number; depth: number };
	const cells: CellEntry[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			cells.push({ row: r, col: c, depth: r + c });
		}
	}
	cells.sort((a, b) => a.depth - b.depth);

	const primitives: SvgPolygon[] = [];

	// Floor/wall backdrop panels, painted first so the mesh draws over them.
	// A wireframe surface has no backdrop at all, matching PowerPoint.
	if (!isWireframe) {
		primitives.push(
			...buildSurfaceWallPanels(cols, rows, cellSize, zScale, offsetX, offsetY, {
				floor: chartData.floor,
				sideWall: chartData.sideWall,
				backWall: chartData.backWall,
			}),
		);
	}

	for (const { row, col } of cells) {
		// Four corners of the isometric parallelogram.
		const corners: Array<[number, number]> = [
			[col, row],
			[col + 1, row],
			[col + 1, row + 1],
			[col, row + 1],
		];
		const verts = corners.map(([c, r]) => {
			const nv = normValue(r, c);
			return isoProject(c * cellSize, r * cellSize, nv * zScale);
		});

		const avgT =
			(normValue(row, col) +
				normValue(row, col + 1) +
				normValue(row + 1, col + 1) +
				normValue(row + 1, col)) /
			4;

		const color = surfaceBandColorAt(bands, avgT);
		const points = verts
			.map((v) => `${(v.screenX + offsetX).toFixed(2)},${(v.screenY + offsetY).toFixed(2)}`)
			.join(' ');

		// Face fill polygon, tagged with the grid vertex it is ANCHORED at (its
		// top-left corner). A mesh facet spans four data points, so there is no
		// one value it "is"; the anchor is the only unambiguous mapping, and
		// without it a surface chart is the one kind whose marks cannot be
		// selected on canvas at all. The final row/column of vertices anchors no
		// facet and therefore carries no mark, which is the honest consequence of
		// a mesh having one fewer cell than vertices per axis. The hover tooltip
		// (matching every other chart kind's `buildMarkTooltip`) reports that same
		// anchor value, so hover and click select the exact same data point.
		primitives.push({
			kind: 'polygon',
			points,
			fill: isWireframe ? 'none' : color,
			stroke: isWireframe ? color : 'none',
			strokeWidth: isWireframe ? 1 : 0,
			opacity: isWireframe ? 1 : 0.9,
			part: { role: 'dataPoint', seriesIndex: row, pointIndex: col },
			title: buildMarkTooltip(
				chartData.series[row]?.name,
				categoryLabels[col],
				chartData.series[row]?.values[col] ?? 0,
				chartData.series[row]?.numberFormat,
			),
		} satisfies SvgPolygon);

		// Subtle edge overlay for depth perception. A wireframe surface already
		// drew its only outline above (an unfilled facet), so it skips this.
		if (!isWireframe) {
			primitives.push({
				kind: 'polygon',
				points,
				fill: 'none',
				stroke: color,
				strokeWidth: 0.5,
				opacity: 0.7,
			} satisfies SvgPolygon);
		}
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildSurfaceLegend(
		bands,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = resolveChartTitleText(chartData);
	const { gridlines: axisGridlines, axisLabels } = buildSurfaceValueAxis(range, layout);
	const edgeLabels = buildSurfaceIsometricEdgeLabels(
		categoryLabels,
		chartData.series,
		cols,
		rows,
		project,
	);

	// Each cell is anchored at one (series, category) data point (see the
	// primitive-building loop above), so it drags vertically to a new value the
	// SAME way a line/bar mark does, through the shared `ChartValueDrag` path
	// (`chart-canvas-drag.ts`). The mesh does not visually reposition mid-drag
	// (its Y comes from the whole grid's shape, not one cell), but the pointer
	// delta -> value mapping still reads naturally: up increases, down decreases.
	const valueDrag: ChartValueDrag = {
		range,
		plotTop: layout.plotTop,
		plotBottom: layout.plotBottom,
	};

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		gridlines: axisGridlines,
		axisLabels,
		categoryLabels: edgeLabels,
		primitives,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
		valueDrag,
	};
}
