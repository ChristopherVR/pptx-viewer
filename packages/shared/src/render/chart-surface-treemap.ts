/**
 * View-model builders for surface and treemap chart kinds.
 *
 * Ported from:
 *   packages/react/src/viewer/utils/chart-surface-treemap.tsx  (surface + treemap)
 *
 * Produces a `ChartViewModel` (SVG primitives only, zero Angular dependencies)
 * that the Angular ChartRendererComponent template iterates over.
 *
 * Surface – isometric projection when the grid has ≥2 series and ≥2 categories,
 *            flat colour-mapped grid otherwise.
 * Treemap  – slice-and-dice rectangles sorted largest-first with inline labels.
 *
 * @module chart-surface-treemap
 */

import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { buildHierarchicalTreemapPrimitives } from './chart-treemap-hierarchy';
import type { ChartViewModel, LegendEntry, SvgPolygon, SvgRect } from './chart-view-model';
import {
	buildLegend,
	computePlotLayout,
	computeValueRange,
	paletteColor,
} from './chart-view-model';

// ─────────────────────────────────────────────────────────────────────────────
// Isometric projection constants (mirrors React's ISO_COS30 / ISO_SIN30)
// ─────────────────────────────────────────────────────────────────────────────

const ISO_COS30 = Math.cos(Math.PI / 6);
const ISO_SIN30 = Math.sin(Math.PI / 6);

/** Project a 3-D (x, y, z) grid coordinate to 2-D isometric screen space. */
function isoProject(x: number, y: number, z: number): { screenX: number; screenY: number } {
	return {
		screenX: (x - y) * ISO_COS30,
		screenY: (x + y) * ISO_SIN30 - z,
	};
}

/** Map a normalised value t in [0..1] to a surface colour ramp (blue→green→red). */
function surfaceColor(t: number): { r: number; g: number; b: number } {
	return {
		r: Math.round(30 + 200 * t),
		g: Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2)),
		b: Math.round(200 * (1 - t) + 30),
	};
}

/** Darken an rgb triplet by a factor in [0..1]. */
function darkenRgb(r: number, g: number, b: number, factor: number): string {
	return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared empty-chrome helper
// ─────────────────────────────────────────────────────────────────────────────

function emptyChrome(): Pick<
	ChartViewModel,
	'gridlines' | 'axisLabels' | 'zeroLine' | 'categoryLabels' | 'dataLabels'
> {
	return {
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		dataLabels: [],
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface: isometric renderer (≥2 series, ≥2 categories)
// ─────────────────────────────────────────────────────────────────────────────

function buildIsometricSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const range = computeValueRange(chartData.series);
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;

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

	const offsetX = layout.plotLeft + layout.plotWidth / 2 - (minSX + projW / 2);
	const offsetY = layout.plotTop + layout.plotHeight / 2 - (minSY + projH / 2);

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

		const { r, g, b } = surfaceColor(avgT);
		const points = verts
			.map((v) => `${(v.screenX + offsetX).toFixed(2)},${(v.screenY + offsetY).toFixed(2)}`)
			.join(' ');

		// Face fill polygon.
		primitives.push({
			kind: 'polygon',
			points,
			fill: `rgb(${r},${g},${b})`,
			stroke: 'none',
			strokeWidth: 0,
			opacity: 0.9,
		} satisfies SvgPolygon);

		// Subtle edge overlay for depth perception.
		primitives.push({
			kind: 'polygon',
			points,
			fill: 'none',
			stroke: darkenRgb(r, g, b, 0.6),
			strokeWidth: 0.5,
			opacity: 0.7,
		} satisfies SvgPolygon);
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface: flat colour-mapped grid (fallback)
// ─────────────────────────────────────────────────────────────────────────────

function buildFlatSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const range = computeValueRange(chartData.series);
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;
	const cellW = layout.plotWidth / Math.max(catCount - 1, 1);
	const cellH = layout.plotHeight / Math.max(seriesCount - 1, 1);

	const primitives: SvgRect[] = [];

	for (let si = 0; si < seriesCount; si++) {
		for (let ci = 0; ci < catCount; ci++) {
			const val = chartData.series[si]?.values[ci] ?? 0;
			const t = range.span > 0 ? (val - range.min) / range.span : 0;
			const { r, g, b } = surfaceColor(t);
			primitives.push({
				kind: 'rect',
				x: layout.plotLeft + ci * cellW,
				y: layout.plotTop + si * cellH,
				w: cellW + 0.5,
				h: cellH + 0.5,
				fill: `rgb(${r},${g},${b})`,
				opacity: 0.85,
			} satisfies SvgRect);
		}
	}

	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		legend: chartData.style?.hasLegend ? legend : [],
		legendX,
		legendY,
		legendAnchor,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildSurfaceViewModel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the view-model for a surface chart.
 *
 * Renders an isometric 3-D-like projection when the grid has ≥2 series and
 * ≥2 categories; falls back to a flat colour-mapped grid otherwise.
 * Mirrors `renderSurfaceChart` / `renderIsometricSurfaceFallback` in React's
 * `chart-surface-treemap.tsx`.
 */
export function buildSurfaceViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const catCount = Math.max(categoryLabels.length, 1);
	const seriesCount = chartData.series.length;

	if (seriesCount >= 2 && catCount >= 2) {
		return buildIsometricSurfaceViewModel(element, chartData, categoryLabels);
	}
	return buildFlatSurfaceViewModel(element, chartData, categoryLabels);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: buildTreemapViewModel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the view-model for a treemap chart.
 *
 * Uses a slice-and-dice layout (alternate horizontal/vertical splits) with
 * items sorted largest-first.  Inline labels are added when the cell is wide
 * enough.  Mirrors `renderTreemapChart` in React's `chart-surface-treemap.tsx`.
 */
export function buildTreemapViewModel(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): ChartViewModel {
	const layout = computePlotLayout(element.width, element.height, chartData, false);
	const primitives = buildHierarchicalTreemapPrimitives(chartData, categoryLabels, {
		x: layout.plotLeft,
		y: layout.plotTop,
		w: layout.plotWidth,
		h: layout.plotHeight,
	});

	// Legend: one entry per series (matching React: no per-item legend).
	const legendPos = chartData.style?.legendPosition ?? 'b';
	const { legend, legendX, legendY, legendAnchor } = buildLegend(
		chartData.series,
		chartData.colorPalette,
		layout.svgWidth,
		legendPos,
		layout.svgHeight,
		layout.plotTop,
	);

	// Build per-category legend entries mirroring the React treemap colour
	// assignments: one swatch per category/value index.
	const catLegend: LegendEntry[] = categoryLabels.map((cat, i) => ({
		color: paletteColor(i, chartData.colorPalette),
		label: cat,
	}));

	const title = chartData.style?.hasTitle && chartData.title ? chartData.title : undefined;

	return {
		svgWidth: layout.svgWidth,
		svgHeight: layout.svgHeight,
		title,
		titleX: layout.svgWidth / 2,
		titleY: 14,
		...emptyChrome(),
		primitives,
		// Prefer per-category legend over per-series legend for treemap.
		legend: chartData.style?.hasLegend ? (catLegend.length > 0 ? catLegend : legend) : [],
		legendX,
		legendY,
		legendAnchor,
	};
}
