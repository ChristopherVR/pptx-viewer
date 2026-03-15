import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { formatAxisValue, paletteColor } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderTitle, renderLegend } from "./chart-chrome";

/** Render a sunburst chart — concentric ring arcs. */
export function renderSunburstChart(
  element: PptxElement,
  chartData: PptxChartData,
  _categoryLabels: ReadonlyArray<string>,
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
  const cx = layout.plotLeft + layout.plotWidth / 2;
  const cy = layout.plotTop + layout.plotHeight / 2;
  const maxR = Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4;
  const seriesCount = Math.max(chartData.series.length, 1);
  const ringWidth = maxR / (seriesCount + 0.5);

  const arcs: React.ReactNode[] = [];

  chartData.series.forEach((series, si) => {
    const iR = ringWidth * (si + 0.5);
    const oR = ringWidth * (si + 1.5);
    const total = series.values.reduce((s, v) => s + Math.abs(v), 0) || 1;
    let startAngle = -Math.PI / 2;

    series.values.forEach((val, vi) => {
      const sweep = (Math.abs(val) / total) * Math.PI * 2;
      const endAngle = startAngle + sweep;
      const largeArc = sweep > Math.PI ? 1 : 0;

      const x1 = cx + oR * Math.cos(startAngle);
      const y1 = cy + oR * Math.sin(startAngle);
      const x2 = cx + oR * Math.cos(endAngle);
      const y2 = cy + oR * Math.sin(endAngle);
      const x3 = cx + iR * Math.cos(endAngle);
      const y3 = cy + iR * Math.sin(endAngle);
      const x4 = cx + iR * Math.cos(startAngle);
      const y4 = cy + iR * Math.sin(startAngle);

      arcs.push(
        <path
          key={`${element.id}-sb-${si}-${vi}`}
          d={`M ${x1} ${y1} A ${oR} ${oR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${iR} ${iR} 0 ${largeArc} 0 ${x4} ${y4} Z`}
          fill={paletteColor(vi, chartData.style?.styleId)}
          stroke="#fff"
          strokeWidth={1}
          opacity={0.9 - si * 0.1}
        />,
      );

      startAngle = endAngle;
    });
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
      {arcs}
    </svg>
  );
}

/** Render a funnel chart — descending trapezoids. */
export function renderFunnelChart(
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
  const values = chartData.series[0]?.values ?? [];
  const maxVal = Math.max(...values.map(Math.abs), 1);
  const count = values.length;
  const segH = layout.plotHeight / Math.max(count, 1);
  const centerX = layout.plotLeft + layout.plotWidth / 2;

  const shapes: React.ReactNode[] = [];

  values.forEach((val, i) => {
    const topW = (Math.abs(val) / maxVal) * layout.plotWidth;
    const nextVal =
      i + 1 < count ? Math.abs(values[i + 1]) : Math.abs(val) * 0.3;
    const botW = (nextVal / maxVal) * layout.plotWidth;
    const y = layout.plotTop + i * segH;

    shapes.push(
      <path
        key={`${element.id}-fn-${i}`}
        d={`M ${centerX - topW / 2} ${y} L ${centerX + topW / 2} ${y} L ${centerX + botW / 2} ${y + segH} L ${centerX - botW / 2} ${y + segH} Z`}
        fill={paletteColor(i, chartData.style?.styleId)}
        stroke="#fff"
        strokeWidth={1}
        opacity={0.85}
      />,
    );

    const label = categoryLabels[i] ?? formatAxisValue(val);
    shapes.push(
      <text
        key={`${element.id}-fn-lbl-${i}`}
        x={centerX}
        y={y + segH / 2 + 4}
        textAnchor="middle"
        fontSize={Math.min(10, segH * 0.4)}
        fill="#fff"
        fontWeight={600}
      >
        {label}
      </text>,
    );
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
      {shapes}
    </svg>
  );
}
