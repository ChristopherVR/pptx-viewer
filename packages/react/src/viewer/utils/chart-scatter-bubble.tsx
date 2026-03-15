import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import {
  computeValueRange,
  valueToY,
  seriesColor,
  formatAxisValue,
} from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import {
  renderTitle,
  renderGridlines,
  renderValueAxis,
  renderZeroLine,
  renderLegend,
  renderOverlays,
} from "./chart-chrome";
import { renderChartDataTable } from "./chart-data-table";

/** Render a scatter (XY) chart. */
export function renderScatterChart(
  element: PptxElement,
  chartData: PptxChartData,
  _categoryLabels: ReadonlyArray<string>,
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
  const allX = chartData.series.flatMap((s) => s.values.map((_v, i) => i));
  const maxX = Math.max(1, ...allX);

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
        {renderTitle(element.id, style, chartData.title, layout.svgWidth)}
        {renderGridlines(element.id, style, range, layout)}
        {renderValueAxis(element.id, range, layout)}
        {renderZeroLine(element.id, range, layout)}
        {renderLegend(element.id, style, chartData.series, layout)}
        {chartData.series.map((series, si) =>
          series.values.map((val, vi) => {
            const px =
              layout.plotLeft + (maxX > 0 ? vi / maxX : 0) * layout.plotWidth;
            const py = valueToY(val, range, layout.plotTop, layout.plotBottom);
            return (
              <circle
                key={`${element.id}-scatter-${si}-${vi}`}
                cx={px}
                cy={py}
                r={4}
                fill={seriesColor(series, si, chartData.style?.styleId)}
                opacity={0.85}
              />
            );
          }),
        )}
        {style?.hasDataLabels &&
          chartData.series.map((series, si) =>
            series.values.map((val, vi) => {
              const px =
                layout.plotLeft + (maxX > 0 ? vi / maxX : 0) * layout.plotWidth;
              const py = valueToY(
                val,
                range,
                layout.plotTop,
                layout.plotBottom,
              );
              return (
                <text
                  key={`${element.id}-scatter-dl-${si}-${vi}`}
                  x={px}
                  y={py - 6}
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

/** Render a bubble chart. */
export function renderBubbleChart(
  element: PptxElement,
  chartData: PptxChartData,
  _categoryLabels: ReadonlyArray<string>,
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
  const allX = chartData.series.flatMap((s) => s.values.map((_v, i) => i));
  const maxX = Math.max(1, ...allX);

  const bubbleSizeSeries =
    chartData.series.length >= 3 ? chartData.series[2] : undefined;
  const maxBubble = bubbleSizeSeries
    ? Math.max(1, ...bubbleSizeSeries.values.map(Math.abs))
    : 1;
  const medianRadius = Math.min(layout.plotWidth, layout.plotHeight) * 0.04;

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
      {renderGridlines(element.id, style, range, layout)}
      {renderValueAxis(element.id, range, layout)}
      {renderZeroLine(element.id, range, layout)}
      {renderLegend(element.id, style, chartData.series, layout)}
      {chartData.series.slice(0, 2).map((series, si) =>
        series.values.map((val, vi) => {
          const px =
            layout.plotLeft + (maxX > 0 ? vi / maxX : 0) * layout.plotWidth;
          const py = valueToY(val, range, layout.plotTop, layout.plotBottom);
          const bubbleVal = bubbleSizeSeries?.values[vi];
          const r =
            bubbleVal !== undefined
              ? medianRadius * 0.5 +
                (Math.abs(bubbleVal) / maxBubble) * medianRadius * 1.5
              : medianRadius;
          return (
            <circle
              key={`${element.id}-bubble-${si}-${vi}`}
              cx={px}
              cy={py}
              r={r}
              fill={seriesColor(series, si, chartData.style?.styleId)}
              opacity={0.6}
              stroke={seriesColor(series, si, chartData.style?.styleId)}
              strokeWidth={1}
            />
          );
        }),
      )}
      {style?.hasDataLabels &&
        chartData.series.slice(0, 2).map((series, si) =>
          series.values.map((val, vi) => {
            const px =
              layout.plotLeft + (maxX > 0 ? vi / maxX : 0) * layout.plotWidth;
            const py = valueToY(val, range, layout.plotTop, layout.plotBottom);
            return (
              <text
                key={`${element.id}-bubble-dl-${si}-${vi}`}
                x={px}
                y={py - 10}
                textAnchor="middle"
                fontSize={7}
                fill="#334155"
              >
                {formatAxisValue(val)}
              </text>
            );
          }),
        )}
    </svg>
  );
}
