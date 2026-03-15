import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import {
  computeValueRange,
  computeValueRangeForChart,
  valueToY,
  seriesColor,
  formatAxisValue,
} from "./chart-helpers";
import {
  computeLayout,
  computeLayoutOptions,
  splitSeriesByAxis,
  getSecondaryValueAxis,
} from "./chart-layout";
import { renderChrome, renderOverlays } from "./chart-chrome";
import { renderChartDataTable } from "./chart-data-table";

/** Render a waterfall chart. */
export function renderWaterfallChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const values = chartData.series[0]?.values ?? [];
  const range = computeValueRangeForChart(chartData.series, chartData.axes);
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const catCount = Math.max(categoryLabels.length, values.length, 1);
  const barWidth = (layout.plotWidth / catCount) * 0.6;
  const gap = (layout.plotWidth / catCount) * 0.2;

  let runningTotal = 0;
  const bars: React.ReactNode[] = [];
  const dataLabels: React.ReactNode[] = [];

  values.forEach((val, i) => {
    const isLast = i === values.length - 1;
    const startVal = isLast ? 0 : runningTotal;
    const endVal = isLast ? runningTotal + val : runningTotal + val;
    const barStartY = valueToY(
      startVal,
      range,
      layout.plotTop,
      layout.plotBottom,
    );
    const barEndY = valueToY(endVal, range, layout.plotTop, layout.plotBottom);
    const x = layout.plotLeft + (layout.plotWidth / catCount) * i + gap;
    const y = Math.min(barStartY, barEndY);
    const h = Math.max(Math.abs(barEndY - barStartY), 1);
    const barColor = isLast ? "#6366f1" : val >= 0 ? "#22c55e" : "#ef4444";

    bars.push(
      <rect
        key={`${element.id}-wf-bar-${i}`}
        x={x}
        y={y}
        width={barWidth}
        height={h}
        fill={barColor}
        rx={1}
      />,
    );

    if (style?.hasDataLabels) {
      dataLabels.push(
        <text
          key={`${element.id}-wf-dl-${i}`}
          x={x + barWidth / 2}
          y={y - 4}
          textAnchor="middle"
          fontSize={7}
          fill="#334155"
        >
          {formatAxisValue(isLast ? endVal : val)}
        </text>,
      );
    }

    if (!isLast && i < values.length - 1) {
      const nextX =
        layout.plotLeft + (layout.plotWidth / catCount) * (i + 1) + gap;
      bars.push(
        <line
          key={`${element.id}-wf-conn-${i}`}
          x1={x + barWidth}
          y1={barEndY}
          x2={nextX}
          y2={barEndY}
          stroke="#94a3b8"
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />,
      );
    }

    if (!isLast) {
      runningTotal += val;
    }
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
      {renderChrome(element.id, chartData, layout, range, categoryLabels, {
        categoryAxisStyle: "bar",
      })}
      {bars}
      {dataLabels}
    </svg>
  );
}

/** Render a combo chart (first series as bars, rest as lines). */
export function renderComboChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";

  // Compute layout with secondary axis & data table awareness
  const layoutOpts = computeLayoutOptions(
    chartData.axes,
    chartData.dataTable,
    chartData.series.length,
  );
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
    layoutOpts,
  );

  // Split series by axis
  const { primary, secondary } = splitSeriesByAxis(chartData.series, chartData.axes);
  const primarySeries = primary.length > 0 ? primary.map((e) => e.series) : chartData.series;
  const secondarySeries = secondary.map((e) => e.series);

  const range = computeValueRangeForChart(primarySeries, chartData.axes);
  const secondaryRange = secondarySeries.length > 0 ? computeValueRange(secondarySeries) : undefined;
  const secondaryAxisFmt = getSecondaryValueAxis(chartData.axes);

  const catCount = Math.max(categoryLabels.length, 1);
  const barSeriesCount = 1;
  const barGroupWidth = layout.plotWidth / catCount;
  const barWidth = barGroupWidth * 0.5;
  const barOffset = (barGroupWidth - barWidth) / 2;

  const barSeries = chartData.series[0];
  const lineSeries = chartData.series.slice(1);

  const barElements: React.ReactNode[] = [];
  const lineElements: React.ReactNode[] = [];
  const dlElements: React.ReactNode[] = [];

  if (barSeries) {
    const isBarSecondary = secondary.some((e) => e.index === 0);
    const barRange = isBarSecondary && secondaryRange ? secondaryRange : range;

    barSeries.values.forEach((val, vi) => {
      const x = layout.plotLeft + barGroupWidth * vi + barOffset;
      const zeroY = valueToY(0, barRange, layout.plotTop, layout.plotBottom);
      const valY = valueToY(val, barRange, layout.plotTop, layout.plotBottom);
      const y = Math.min(zeroY, valY);
      const h = Math.max(Math.abs(zeroY - valY), 1);
      barElements.push(
        <rect
          key={`${element.id}-combo-bar-${vi}`}
          x={x}
          y={y}
          width={barWidth}
          height={h}
          fill={seriesColor(barSeries, 0, chartData.style?.styleId, chartData.colorPalette)}
          rx={1}
        />,
      );
      if (style?.hasDataLabels) {
        dlElements.push(
          <text
            key={`${element.id}-combo-bar-dl-${vi}`}
            x={x + barWidth / 2}
            y={val >= 0 ? y - 4 : y + h + 10}
            textAnchor="middle"
            fontSize={7}
            fill="#334155"
          >
            {formatAxisValue(val)}
          </text>,
        );
      }
    });
  }

  lineSeries.forEach((series, si) => {
    if (series.values.length === 0) return;
    const seriesIdx = si + barSeriesCount;
    const isSecondary = secondary.some((e) => e.index === seriesIdx);
    const activeRange = isSecondary && secondaryRange ? secondaryRange : range;

    const points = series.values.map((val, vi) => {
      const x = layout.plotLeft + barGroupWidth * vi + barGroupWidth / 2;
      const y = valueToY(val, activeRange, layout.plotTop, layout.plotBottom);
      return { x, y, val };
    });
    const c = seriesColor(series, seriesIdx, chartData.style?.styleId, chartData.colorPalette);
    lineElements.push(
      <polyline
        key={`${element.id}-combo-line-${si}`}
        fill="none"
        stroke={c}
        strokeWidth={2.4}
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
      />,
    );
    points.forEach((p, vi) => {
      lineElements.push(
        <circle
          key={`${element.id}-combo-dot-${si}-${vi}`}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill={c}
        />,
      );
      if (style?.hasDataLabels) {
        dlElements.push(
          <text
            key={`${element.id}-combo-line-dl-${si}-${vi}`}
            x={p.x}
            y={p.y - 7}
            textAnchor="middle"
            fontSize={7}
            fill="#334155"
          >
            {formatAxisValue(p.val)}
          </text>,
        );
      }
    });
  });

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
        {renderChrome(
          element.id,
          chartData,
          layout,
          range,
          categoryLabels,
          { categoryAxisStyle: "bar" },
          secondaryRange
            ? { secondaryRange, secondaryAxisFormatting: secondaryAxisFmt }
            : undefined,
        )}
        {barElements}
        {lineElements}
        {dlElements}
        {renderOverlays(element.id, chartData, layout, range, "bar")}
      </svg>
      {renderChartDataTable(element.id, chartData, layout.svgWidth)}
    </>
  );
}
