/**
 * Error bars, drop lines, and hi-low lines rendering for chart overlays.
 */
import React from "react";

import type { PptxChartData, PptxChartErrBars } from "../../core";
import type { ChartPlotLayout, ChartValueRange } from "./chart-overlay-utils";
import { valToY, xToPixel } from "./chart-overlay-utils";

// ── Error bar computation ──────────────────────────────────────────────

function computeErrorValue(
  errBars: PptxChartErrBars,
  values: number[],
  pointIndex: number,
  direction: "plus" | "minus",
): number {
  switch (errBars.valType) {
    case "fixedVal":
      return errBars.val ?? 0;
    case "percentage":
      return Math.abs(values[pointIndex]) * ((errBars.val ?? 0) / 100);
    case "stdDev": {
      const n = values.length;
      const mean = values.reduce((s, v) => s + v, 0) / n;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      return stdDev * (errBars.val ?? 1);
    }
    case "stdErr": {
      const n2 = values.length;
      const mean2 = values.reduce((s, v) => s + v, 0) / n2;
      const variance2 = values.reduce((s, v) => s + (v - mean2) ** 2, 0) / n2;
      return Math.sqrt(variance2 / n2);
    }
    case "cust": {
      if (direction === "plus") return errBars.customPlus?.[pointIndex] ?? 0;
      return errBars.customMinus?.[pointIndex] ?? 0;
    }
    default:
      return 0;
  }
}

// ── Render error bars ──────────────────────────────────────────────────

export function renderErrorBars(
  elementId: string,
  chartData: PptxChartData,
  layout: ChartPlotLayout,
  range: ChartValueRange,
  mode: "line" | "bar",
): React.ReactNode {
  const catCount = Math.max(chartData.categories.length, 1);
  const nodes: React.ReactNode[] = [];
  const capW = 4;

  chartData.series.forEach((series, si) => {
    if (!series.errBars || series.errBars.length === 0) return;

    series.errBars.forEach((eb) => {
      if (eb.direction !== "y") return; // only Y error bars for now

      series.values.forEach((val, vi) => {
        const cx = xToPixel(vi, catCount, layout, mode);
        const baseY = valToY(val, range, layout.plotTop, layout.plotBottom);

        if (eb.barType === "plus" || eb.barType === "both") {
          const plusErr = computeErrorValue(eb, series.values, vi, "plus");
          const topY = valToY(
            val + plusErr,
            range,
            layout.plotTop,
            layout.plotBottom,
          );
          nodes.push(
            <line
              key={`${elementId}-eb-p-${si}-${vi}`}
              x1={cx}
              y1={baseY}
              x2={cx}
              y2={topY}
              stroke="#334155"
              strokeWidth={1}
            />,
            <line
              key={`${elementId}-eb-pc-${si}-${vi}`}
              x1={cx - capW}
              y1={topY}
              x2={cx + capW}
              y2={topY}
              stroke="#334155"
              strokeWidth={1}
            />,
          );
        }

        if (eb.barType === "minus" || eb.barType === "both") {
          const minusErr = computeErrorValue(eb, series.values, vi, "minus");
          const botY = valToY(
            val - minusErr,
            range,
            layout.plotTop,
            layout.plotBottom,
          );
          nodes.push(
            <line
              key={`${elementId}-eb-m-${si}-${vi}`}
              x1={cx}
              y1={baseY}
              x2={cx}
              y2={botY}
              stroke="#334155"
              strokeWidth={1}
            />,
            <line
              key={`${elementId}-eb-mc-${si}-${vi}`}
              x1={cx - capW}
              y1={botY}
              x2={cx + capW}
              y2={botY}
              stroke="#334155"
              strokeWidth={1}
            />,
          );
        }
      });
    });
  });

  if (nodes.length === 0) return null;
  return <g key={`${elementId}-errorbars`}>{nodes}</g>;
}

// ── Render drop lines ──────────────────────────────────────────────────

export function renderDropLines(
  elementId: string,
  chartData: PptxChartData,
  layout: ChartPlotLayout,
  range: ChartValueRange,
  mode: "line" | "bar",
): React.ReactNode {
  if (!chartData.dropLines) return null;

  const catCount = Math.max(chartData.categories.length, 1);
  const style = chartData.dropLines;
  const baselineY = valToY(range.min, range, layout.plotTop, layout.plotBottom);
  const nodes: React.ReactNode[] = [];

  chartData.series.forEach((series, si) => {
    series.values.forEach((val, vi) => {
      const cx = xToPixel(vi, catCount, layout, mode);
      const dataY = valToY(val, range, layout.plotTop, layout.plotBottom);
      nodes.push(
        <line
          key={`${elementId}-dl-${si}-${vi}`}
          x1={cx}
          y1={dataY}
          x2={cx}
          y2={baselineY}
          stroke={style.color || "#94a3b8"}
          strokeWidth={style.width ?? 0.8}
          strokeDasharray={style.dashStyle === "dash" ? "4 3" : undefined}
        />,
      );
    });
  });

  if (nodes.length === 0) return null;
  return <g key={`${elementId}-droplines`}>{nodes}</g>;
}

// ── Render hi-low lines ────────────────────────────────────────────────

export function renderHiLowLines(
  elementId: string,
  chartData: PptxChartData,
  layout: ChartPlotLayout,
  range: ChartValueRange,
  mode: "line" | "bar",
): React.ReactNode {
  if (!chartData.hiLowLines) return null;
  if (chartData.series.length < 2) return null;

  const catCount = Math.max(chartData.categories.length, 1);
  const style = chartData.hiLowLines;
  const nodes: React.ReactNode[] = [];

  for (let vi = 0; vi < catCount; vi++) {
    let highVal = -Infinity;
    let lowVal = Infinity;
    for (const series of chartData.series) {
      const v = series.values[vi];
      if (v !== undefined) {
        highVal = Math.max(highVal, v);
        lowVal = Math.min(lowVal, v);
      }
    }
    if (!Number.isFinite(highVal) || !Number.isFinite(lowVal)) continue;

    const cx = xToPixel(vi, catCount, layout, mode);
    const highY = valToY(highVal, range, layout.plotTop, layout.plotBottom);
    const lowY = valToY(lowVal, range, layout.plotTop, layout.plotBottom);
    nodes.push(
      <line
        key={`${elementId}-hl-${vi}`}
        x1={cx}
        y1={highY}
        x2={cx}
        y2={lowY}
        stroke={style.color || "#334155"}
        strokeWidth={style.width ?? 1}
        strokeDasharray={style.dashStyle === "dash" ? "4 3" : undefined}
      />,
    );
  }

  if (nodes.length === 0) return null;
  return <g key={`${elementId}-hilowlines`}>{nodes}</g>;
}
