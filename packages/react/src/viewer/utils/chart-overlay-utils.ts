/**
 * Shared types and utility functions for chart overlay rendering.
 */
import type { PptxChartSeries } from "pptx-viewer-core";
import { PALETTE, seriesColor } from "./chart-helpers";

// ── Shared layout types ────────────────────────────────────────────────

export interface ChartPlotLayout {
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  plotWidth: number;
  plotHeight: number;
  svgWidth: number;
  svgHeight: number;
}

export interface ChartValueRange {
  min: number;
  max: number;
  span: number;
}

// ── Palette & helpers ──────────────────────────────────────────────────

export { PALETTE };

export function sColor(series: PptxChartSeries, idx: number): string {
  return seriesColor(series, idx);
}

export function valToY(
  val: number,
  range: ChartValueRange,
  topY: number,
  bottomY: number,
): number {
  const usable = bottomY - topY;
  return bottomY - ((val - range.min) / range.span) * usable;
}

export function xToPixel(
  xVal: number,
  catCount: number,
  layout: ChartPlotLayout,
  mode: "line" | "bar",
): number {
  if (mode === "bar") {
    const slotWidth = layout.plotWidth / Math.max(catCount, 1);
    return layout.plotLeft + slotWidth * xVal + slotWidth / 2;
  }
  const maxIdx = Math.max(catCount - 1, 1);
  return layout.plotLeft + (xVal / maxIdx) * layout.plotWidth;
}
