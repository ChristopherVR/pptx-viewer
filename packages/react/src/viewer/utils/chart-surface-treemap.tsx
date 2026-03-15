import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { computeValueRange, computeValueRangeForChart, paletteColor } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderTitle, renderLegend, renderChrome } from "./chart-chrome";

// ── Isometric projection utilities ───────────────────────────────

/** cos(30 degrees) used for isometric X projection. */
export const ISO_COS30 = Math.cos(Math.PI / 6);
/** sin(30 degrees) used for isometric Y projection. */
export const ISO_SIN30 = Math.sin(Math.PI / 6);

/**
 * Project a 3D (x, y, z) coordinate to 2D isometric screen coordinates.
 *
 * Uses the standard isometric formula:
 *   screenX = (x - y) * cos(30)
 *   screenY = (x + y) * sin(30) - z
 *
 * The z axis points upward (negative screen Y direction).
 */
export function isoProject(
  x: number,
  y: number,
  z: number,
): { screenX: number; screenY: number } {
  return {
    screenX: (x - y) * ISO_COS30,
    screenY: (x + y) * ISO_SIN30 - z,
  };
}

/**
 * Map a normalised data value (0..1) to the surface chart colour ramp.
 *
 * The same formula used by the flat renderer: blue at min, green at
 * midpoint, red at max.
 */
export function surfaceColor(
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: Math.round(30 + 200 * t),
    g: Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2)),
    b: Math.round(200 * (1 - t) + 30),
  };
}

/**
 * Build the four corner vertices of an isometric cell (parallelogram).
 *
 * Grid coordinates (col, row) map to the isometric X/Y plane, and the
 * data value at each corner determines its Z height.
 */
export function isoCellVertices(
  col: number,
  row: number,
  cellSize: number,
  zScale: number,
  getValue: (r: number, c: number) => number,
): Array<{ screenX: number; screenY: number }> {
  const corners: Array<[number, number]> = [
    [col, row],
    [col + 1, row],
    [col + 1, row + 1],
    [col, row + 1],
  ];
  return corners.map(([c, r]) => {
    const val = getValue(r, c);
    return isoProject(c * cellSize, r * cellSize, val * zScale);
  });
}

/** Darken an RGB colour by a factor (0 = black, 1 = unchanged). */
function darkenRgb(
  r: number,
  g: number,
  b: number,
  factor: number,
): string {
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/**
 * Render an isometric 3D-like surface chart using SVG parallelograms.
 *
 * Cells are drawn back-to-front (painter's algorithm) so that nearer
 * cells correctly overlap farther ones. Each cell is a parallelogram
 * coloured by the average data value of its four corners.
 */
function renderIsometricSurfaceChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    false,
    legendPos,
  );
  const range = computeValueRangeForChart(chartData.series, chartData.axes);
  const catCount = Math.max(categoryLabels.length, 1);
  const seriesCount = chartData.series.length;

  // Grid dimensions (cells, not vertices)
  const cols = catCount - 1;
  const rows = seriesCount - 1;

  // Isometric cell size — scale so the projected grid fits in the plot area.
  // The isometric bounding box of a (cols x rows) grid with cellSize s:
  //   width  = (cols + rows) * s * cos30
  //   height = (cols + rows) * s * sin30 + zRange * zScale
  // We allocate ~65% of plot height for the grid base, rest for z headroom.
  const gridSpan = cols + rows;
  const baseHeightBudget = layout.plotHeight * 0.65;
  const widthBudget = layout.plotWidth * 0.9;

  const cellByWidth = widthBudget / (gridSpan * ISO_COS30);
  const cellByHeight = baseHeightBudget / (gridSpan * ISO_SIN30);
  const cellSize = Math.min(cellByWidth, cellByHeight);

  // Z scale: remaining vertical budget for value displacement
  const zHeadroom = layout.plotHeight * 0.3;
  const zScale = range.span > 0 ? zHeadroom : 0;

  // Helper to clamp-read grid values as normalised 0..1
  const normValue = (r: number, c: number): number => {
    const ri = Math.min(r, seriesCount - 1);
    const ci = Math.min(c, catCount - 1);
    const val = chartData.series[ri]?.values[ci] ?? 0;
    return range.span > 0 ? (val - range.min) / range.span : 0;
  };

  // Compute isometric bounding box to centre the projection
  const allProjected: Array<{ screenX: number; screenY: number }> = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const nv = normValue(r, c);
      allProjected.push(isoProject(c * cellSize, r * cellSize, nv * zScale));
    }
  }
  const minSX = Math.min(...allProjected.map((p) => p.screenX));
  const maxSX = Math.max(...allProjected.map((p) => p.screenX));
  const minSY = Math.min(...allProjected.map((p) => p.screenY));
  const maxSY = Math.max(...allProjected.map((p) => p.screenY));
  const projW = maxSX - minSX;
  const projH = maxSY - minSY;

  // Translate so the projected grid is centred in the plot area
  const offsetX =
    layout.plotLeft + layout.plotWidth / 2 - (minSX + projW / 2);
  const offsetY =
    layout.plotTop + layout.plotHeight / 2 - (minSY + projH / 2);

  // Build cells sorted back-to-front (painter's algorithm).
  // In isometric view, cells with higher (row + col) are "closer" to the
  // viewer and must be drawn last.
  const cellEntries: Array<{
    row: number;
    col: number;
    depth: number;
  }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cellEntries.push({ row: r, col: c, depth: r + c });
    }
  }
  cellEntries.sort((a, b) => a.depth - b.depth);

  const polygons: React.ReactNode[] = [];

  for (const { row, col } of cellEntries) {
    const verts = isoCellVertices(col, row, cellSize, zScale, normValue);

    // Average value of four corners for colour
    const avgT =
      (normValue(row, col) +
        normValue(row, col + 1) +
        normValue(row + 1, col + 1) +
        normValue(row + 1, col)) /
      4;
    const { r, g, b } = surfaceColor(avgT);

    const points = verts
      .map(
        (v) =>
          `${(v.screenX + offsetX).toFixed(2)},${(v.screenY + offsetY).toFixed(2)}`,
      )
      .join(" ");

    // Face fill
    polygons.push(
      <polygon
        key={`${element.id}-iso-${row}-${col}`}
        points={points}
        fill={`rgb(${r},${g},${b})`}
        opacity={0.9}
      />,
    );

    // Subtle grid lines for depth perception
    polygons.push(
      <polygon
        key={`${element.id}-iso-edge-${row}-${col}`}
        points={points}
        fill="none"
        stroke={darkenRgb(r, g, b, 0.6)}
        strokeWidth={0.5}
        opacity={0.7}
      />,
    );
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x={0}
        y={0}
        width={layout.svgWidth}
        height={layout.svgHeight}
        fill="#0f172a11"
      />
      {renderTitle(element.id, style, chartData.title, layout.svgWidth)}
      {renderLegend(element.id, style, chartData.series, layout)}
      {polygons}
    </svg>
  );
}

/**
 * Render a flat 2D colour-mapped grid surface chart.
 *
 * This is the original renderer, kept as a fallback for grids that are
 * too small for meaningful isometric projection (fewer than 2 series or
 * 2 categories).
 */
export function renderFlatSurfaceChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const range = computeValueRangeForChart(chartData.series, chartData.axes);
  const catCount = Math.max(categoryLabels.length, 1);
  const seriesCount = chartData.series.length;
  const cellW = layout.plotWidth / Math.max(catCount - 1, 1);
  const cellH = layout.plotHeight / Math.max(seriesCount - 1, 1);

  const cells: React.ReactNode[] = [];
  for (let si = 0; si < seriesCount; si++) {
    for (let ci = 0; ci < catCount; ci++) {
      const val = chartData.series[si].values[ci] ?? 0;
      const t = range.span > 0 ? (val - range.min) / range.span : 0;
      const { r, g, b } = surfaceColor(t);
      cells.push(
        <rect
          key={`${element.id}-surf-${si}-${ci}`}
          x={layout.plotLeft + ci * cellW}
          y={layout.plotTop + si * cellH}
          width={cellW + 0.5}
          height={cellH + 0.5}
          fill={`rgb(${r},${g},${b})`}
          opacity={0.85}
        />,
      );
    }
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
      preserveAspectRatio="none"
    >
      <rect
        x={0}
        y={0}
        width={layout.svgWidth}
        height={layout.svgHeight}
        fill="#0f172a11"
      />
      {renderChrome(element.id, chartData, layout, range, categoryLabels, {
        categoryAxisStyle: "bar",
      })}
      {cells}
    </svg>
  );
}

/**
 * Render a surface chart.
 *
 * Uses an isometric 3D-like projection when the data grid is large enough
 * (at least 2 series and 2 categories). Falls back to the original flat
 * colour-mapped grid for smaller data sets.
 */
export function renderSurfaceChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const catCount = Math.max(categoryLabels.length, 1);
  const seriesCount = chartData.series.length;

  if (seriesCount >= 2 && catCount >= 2) {
    return renderIsometricSurfaceChart(element, chartData, categoryLabels);
  }
  return renderFlatSurfaceChart(element, chartData, categoryLabels);
}

/** Render a treemap chart — hierarchical rectangles. */
export function renderTreemapChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    false,
    legendPos,
  );
  const allValues = chartData.series.flatMap((s) => s.values);
  const totalAbs = allValues.reduce((sum, v) => sum + Math.abs(v), 0) || 1;

  const rects: React.ReactNode[] = [];
  let curX = layout.plotLeft;
  let curY = layout.plotTop;
  let remainW = layout.plotWidth;
  let remainH = layout.plotHeight;
  const remaining = allValues
    .map((v, i) => ({ value: Math.abs(v), index: i }))
    .sort((a, b) => b.value - a.value);
  let remainTotal = totalAbs;

  remaining.forEach((item) => {
    const fraction = remainTotal > 0 ? item.value / remainTotal : 0;
    const useWidth = remainW >= remainH;
    const w = useWidth ? remainW * fraction : remainW;
    const h = useWidth ? remainH : remainH * fraction;

    rects.push(
      <rect
        key={`${element.id}-tm-${item.index}`}
        x={curX}
        y={curY}
        width={Math.max(w - 1, 1)}
        height={Math.max(h - 1, 1)}
        fill={paletteColor(item.index, chartData.style?.styleId, chartData.colorPalette)}
        rx={2}
        opacity={0.85}
      />,
    );

    const label = categoryLabels[item.index] ?? `${item.index + 1}`;
    if (w > 30 && h > 14) {
      rects.push(
        <text
          key={`${element.id}-tm-lbl-${item.index}`}
          x={curX + Math.max(w - 1, 1) / 2}
          y={curY + Math.max(h - 1, 1) / 2 + 4}
          textAnchor="middle"
          fontSize={Math.min(10, h * 0.3)}
          fill="#fff"
          fontWeight={600}
        >
          {label}
        </text>,
      );
    }

    if (useWidth) {
      curX += w;
      remainW -= w;
    } else {
      curY += h;
      remainH -= h;
    }
    remainTotal -= item.value;
  });

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
      preserveAspectRatio="none"
    >
      <rect
        x={0}
        y={0}
        width={layout.svgWidth}
        height={layout.svgHeight}
        fill="#0f172a11"
      />
      {renderTitle(element.id, style, chartData.title, layout.svgWidth)}
      {renderLegend(element.id, style, chartData.series, layout)}
      {rects}
    </svg>
  );
}
