import type { PptxChartSeries } from "pptx-viewer-core";
import {
  getChartStylePalette,
  DEFAULT_CHART_PALETTE,
} from "./chart-style-palettes";

// ── Constants ────────────────────────────────────────────────────

export const PALETTE = DEFAULT_CHART_PALETTE;

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

export function seriesColor(
  series: PptxChartSeries,
  index: number,
  styleId?: number,
): string {
  if (series.color) return series.color;
  const palette = getChartStylePalette(styleId);
  return palette[index % palette.length];
}

/**
 * Return the palette colour for an index given an optional chart style ID.
 * Use this when there is no series object (e.g. per-category colouring in
 * pie / funnel / treemap charts).
 */
export function paletteColor(index: number, styleId?: number): string {
  const palette = getChartStylePalette(styleId);
  return palette[index % palette.length];
}
