import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { computeValueRange, computeValueRangeForChart, valueToY, formatAxisValue } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderChrome, renderOverlays } from "./chart-chrome";
import { renderChartDataTable } from "./chart-data-table";

/** Render a stock (HLC / OHLC) candlestick chart. */
export function renderStockChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const range = computeValueRangeForChart(chartData.series, chartData.axes);
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const catCount = Math.max(categoryLabels.length, 1);
  const barGroupWidth = layout.plotWidth / catCount;
  const candleWidth = barGroupWidth * 0.5;

  const hasFour = chartData.series.length >= 4;
  const openSeries = hasFour ? chartData.series[0] : undefined;
  const highSeries = chartData.series[hasFour ? 1 : 0];
  const lowSeries = chartData.series[hasFour ? 2 : 1];
  const closeSeries = chartData.series[hasFour ? 3 : 2];

  if (!highSeries || !lowSeries || !closeSeries) return null;

  const elements: React.ReactNode[] = [];
  const dlElements: React.ReactNode[] = [];

  for (let ci = 0; ci < catCount; ci++) {
    const high = highSeries.values[ci] ?? 0;
    const low = lowSeries.values[ci] ?? 0;
    const open = openSeries?.values[ci] ?? low;
    const close = closeSeries.values[ci] ?? high;
    const isUp = close >= open;

    const cx = layout.plotLeft + barGroupWidth * ci + barGroupWidth / 2;
    const highY = valueToY(high, range, layout.plotTop, layout.plotBottom);
    const lowY = valueToY(low, range, layout.plotTop, layout.plotBottom);
    const openY = valueToY(open, range, layout.plotTop, layout.plotBottom);
    const closeY = valueToY(close, range, layout.plotTop, layout.plotBottom);

    elements.push(
      <line
        key={`${element.id}-stock-wick-${ci}`}
        x1={cx}
        y1={highY}
        x2={cx}
        y2={lowY}
        stroke="#334155"
        strokeWidth={1}
      />,
    );

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
    elements.push(
      <rect
        key={`${element.id}-stock-body-${ci}`}
        x={cx - candleWidth / 2}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={isUp ? "#22c55e" : "#ef4444"}
        stroke={isUp ? "#16a34a" : "#dc2626"}
        strokeWidth={0.5}
        rx={1}
      />,
    );

    if (style?.hasDataLabels) {
      dlElements.push(
        <text
          key={`${element.id}-stock-dl-${ci}`}
          x={cx}
          y={highY - 4}
          textAnchor="middle"
          fontSize={7}
          fill="#334155"
        >
          {formatAxisValue(close)}
        </text>,
      );
    }
  }

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
          categoryAxisStyle: "bar",
        })}
        {elements}
        {dlElements}
        {renderOverlays(element.id, chartData, layout, range, "bar")}
      </svg>
      {renderChartDataTable(element.id, chartData, layout.svgWidth)}
    </>
  );
}
