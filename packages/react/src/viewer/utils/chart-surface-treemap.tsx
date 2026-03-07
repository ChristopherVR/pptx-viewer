import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { PALETTE, computeValueRange } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderTitle, renderLegend, renderChrome } from "./chart-chrome";

/** Render a surface (colour-mapped grid) chart. */
export function renderSurfaceChart(
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
  const range = computeValueRange(chartData.series);
  const catCount = Math.max(categoryLabels.length, 1);
  const seriesCount = chartData.series.length;
  const cellW = layout.plotWidth / Math.max(catCount - 1, 1);
  const cellH = layout.plotHeight / Math.max(seriesCount - 1, 1);

  const cells: React.ReactNode[] = [];
  for (let si = 0; si < seriesCount; si++) {
    for (let ci = 0; ci < catCount; ci++) {
      const val = chartData.series[si].values[ci] ?? 0;
      const t = range.span > 0 ? (val - range.min) / range.span : 0;
      const r = Math.round(30 + 200 * t);
      const g = Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2));
      const b = Math.round(200 * (1 - t) + 30);
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
        fill={PALETTE[item.index % PALETTE.length]}
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
