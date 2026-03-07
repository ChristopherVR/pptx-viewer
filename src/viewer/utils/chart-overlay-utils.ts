/**
 * Shared types and utility functions for chart overlay rendering.
 */
import type { PptxChartSeries } from "../../core";

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

export const PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];

export function sColor(series: PptxChartSeries, idx: number): string {
  return series.color || PALETTE[idx % PALETTE.length];
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
