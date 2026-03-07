import React from "react";

import type { PptxElement, PptxChartData } from "../../core";
import {
  computeValueRange,
  valueToY,
  seriesColor,
  formatAxisValue,
} from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderChrome, renderOverlays } from "./chart-chrome";
import { renderChartDataTable } from "./chart-data-table";

/** Render an area chart (or area3D). */
export function renderAreaChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const range = computeValueRange(chartData.series);
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const catCount = Math.max(categoryLabels.length, 2);

  return (
    <>
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
          categoryAxisStyle: "line",
        })}
        {chartData.series.map((series, si) => {
          if (series.values.length === 0) return null;
          const pts = series.values.map((val, vi) => {
            const nx = catCount > 1 ? vi / (catCount - 1) : 0;
            const x = layout.plotLeft + layout.plotWidth * nx;
            const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
            return { x, y };
          });
          const linePath = pts.map((p) => `${p.x},${p.y}`).join(" ");
          const c = seriesColor(series, si);
          const baselineY = valueToY(
            0,
            range,
            layout.plotTop,
            layout.plotBottom,
          );
          return (
            <g key={`${element.id}-area-${si}`}>
              <polygon
                points={`${layout.plotLeft},${baselineY} ${linePath} ${pts[pts.length - 1].x},${baselineY}`}
                fill={c}
                opacity={0.25}
              />
              <polyline
                fill="none"
                stroke={c}
                strokeWidth={2}
                points={linePath}
              />
            </g>
          );
        })}
        {style?.hasDataLabels &&
          chartData.series.map((series, si) =>
            series.values.map((val, vi) => {
              const catCount2 = Math.max(categoryLabels.length, 2);
              const nx = catCount2 > 1 ? vi / (catCount2 - 1) : 0;
              const x = layout.plotLeft + layout.plotWidth * nx;
              const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
              return (
                <text
                  key={`${element.id}-area-dl-${si}-${vi}`}
                  x={x}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={7}
                  fill="#334155"
                >
                  {formatAxisValue(val)}
                </text>
              );
            }),
          )}
        {renderOverlays(element.id, chartData, layout, range, "line")}
      </svg>
      {renderChartDataTable(element.id, chartData, layout.svgWidth)}
    </>
  );
}

/** Render a line chart (or line3D). */
export function renderLineChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const range = computeValueRange(chartData.series);
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const catCount = Math.max(categoryLabels.length, 2);

  return (
    <>
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
          fill="#0f172a22"
        />
        {renderChrome(element.id, chartData, layout, range, categoryLabels, {
          categoryAxisStyle: "line",
        })}
        {chartData.series.map((series, seriesIndex) => {
          if (series.values.length === 0) return null;
          const points = series.values.map((value, valueIndex) => {
            const normalizedX = catCount > 1 ? valueIndex / (catCount - 1) : 0;
            const x = layout.plotLeft + layout.plotWidth * normalizedX;
            const y = valueToY(value, range, layout.plotTop, layout.plotBottom);
            return { x, y, value };
          });
          const c = seriesColor(series, seriesIndex);
          return (
            <g key={`${element.id}-line-g-${seriesIndex}`}>
              <polyline
                key={`${element.id}-series-line-${seriesIndex}`}
                fill="none"
                stroke={c}
                strokeWidth={2.4}
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              />
              {points.map((p, vi) => (
                <circle
                  key={`${element.id}-line-dot-${seriesIndex}-${vi}`}
                  cx={p.x}
                  cy={p.y}
                  r={2.5}
                  fill={c}
                />
              ))}
              {style?.hasDataLabels &&
                points.map((p, vi) => (
                  <text
                    key={`${element.id}-line-dl-${seriesIndex}-${vi}`}
                    x={p.x}
                    y={p.y - 7}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#334155"
                  >
                    {formatAxisValue(p.value)}
                  </text>
                ))}
            </g>
          );
        })}
        {renderOverlays(element.id, chartData, layout, range, "line")}
      </svg>
      {renderChartDataTable(element.id, chartData, layout.svgWidth)}
    </>
  );
}
