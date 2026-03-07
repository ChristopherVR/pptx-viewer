import type { PptxChartSeries } from "../../core";

// ── Constants ────────────────────────────────────────────────────

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

// ── Value range helpers ──────────────────────────────────────────

export interface ValueRange {
  min: number;
  max: number;
  span: number;
}

/** Compute a Y-axis range that includes zero when appropriate. */
export function computeValueRange(
  series: ReadonlyArray<PptxChartSeries>,
): ValueRange {
  const allValues = series.flatMap((s) => s.values);
  if (allValues.length === 0) return { min: 0, max: 1, span: 1 };
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  // Always include zero so the baseline is visible
  const min = Math.min(dataMin, 0);
  const max = Math.max(dataMax, 0);
  const span = Math.max(max - min, 1);
  return { min, max, span };
}

/** Map a data value to a Y pixel coordinate (top = max, bottom = min). */
export function valueToY(
  val: number,
  range: ValueRange,
  topY: number,
  bottomY: number,
): number {
  const usable = bottomY - topY;
  return bottomY - ((val - range.min) / range.span) * usable;
}

export function formatAxisValue(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(1);
}

export function seriesColor(series: PptxChartSeries, index: number): string {
  return series.color || PALETTE[index % PALETTE.length];
}
