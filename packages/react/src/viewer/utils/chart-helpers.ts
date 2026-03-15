import type { PptxChartSeries, PptxChartAxisFormatting } from "pptx-viewer-core";
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
  /** When true, the range represents log-scaled values. */
  logScale?: boolean;
  /** Logarithmic base (e.g. 10, 2, Math.E). Only meaningful when logScale is true. */
  logBase?: number;
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

/**
 * Compute a logarithmic value range for axes with logScale enabled.
 * Values <= 0 are clamped to a small positive number since log(0) is undefined.
 * The returned min/max are in data-space (not log-space) so that tick generation
 * can produce clean power-of-base labels.
 */
export function computeLogValueRange(
  series: ReadonlyArray<PptxChartSeries>,
  logBase: number,
): ValueRange {
  const allValues = series.flatMap((s) => s.values).filter((v) => v > 0);
  if (allValues.length === 0) {
    return { min: 1, max: logBase, span: 1, logScale: true, logBase };
  }

  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  // Snap to nearest power-of-base boundaries for clean ticks
  const logMin = Math.floor(Math.log(dataMin) / Math.log(logBase));
  const logMax = Math.ceil(Math.log(dataMax) / Math.log(logBase));

  const min = Math.pow(logBase, logMin);
  const max = Math.pow(logBase, Math.max(logMax, logMin + 1));
  const logSpan = Math.log(max) / Math.log(logBase) - Math.log(min) / Math.log(logBase);

  return {
    min,
    max,
    span: Math.max(logSpan, 1),
    logScale: true,
    logBase,
  };
}

/** Map a data value to a Y pixel coordinate (top = max, bottom = min). */
export function valueToY(
  val: number,
  range: ValueRange,
  topY: number,
  bottomY: number,
): number {
  const usable = bottomY - topY;

  if (range.logScale && range.logBase) {
    return valueToYLog(val, range, topY, bottomY);
  }

  return bottomY - ((val - range.min) / range.span) * usable;
}

/**
 * Map a data value to a Y pixel coordinate using logarithmic scaling.
 * Values <= 0 are clamped to range.min.
 */
export function valueToYLog(
  val: number,
  range: ValueRange,
  topY: number,
  bottomY: number,
): number {
  const usable = bottomY - topY;
  const base = range.logBase ?? 10;
  const clampedVal = Math.max(val, range.min);
  const logVal = Math.log(clampedVal) / Math.log(base);
  const logMin = Math.log(range.min) / Math.log(base);

  return bottomY - ((logVal - logMin) / range.span) * usable;
}

/**
 * Generate logarithmically-spaced tick values for a log-scale axis.
 * Returns tick values at each power of the base within the range.
 */
export function generateLogTicks(range: ValueRange): number[] {
  if (!range.logScale || !range.logBase) return [];

  const base = range.logBase;
  const logMin = Math.log(range.min) / Math.log(base);
  const logMax = Math.log(range.max) / Math.log(base);

  const ticks: number[] = [];
  for (let exp = Math.round(logMin); exp <= Math.round(logMax); exp++) {
    ticks.push(Math.pow(base, exp));
  }

  return ticks;
}

/**
 * Find the value axis formatting from the axes array, looking for
 * a valAx with logScale enabled.
 */
export function findLogAxis(
  axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
  return axes?.find((a) => a.axisType === 'valAx' && a.logScale);
}

/**
 * Compute the appropriate value range for a chart, automatically using
 * logarithmic scaling when a log-scale value axis is present.
 */
export function computeValueRangeForChart(
  series: ReadonlyArray<PptxChartSeries>,
  axes?: PptxChartAxisFormatting[],
): ValueRange {
  const logAxis = findLogAxis(axes);
  if (logAxis?.logBase) {
    return computeLogValueRange(series, logAxis.logBase);
  }
  return computeValueRange(series);
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
  colorPalette?: string[],
): string {
  if (series.color) return series.color;
  // Prefer the parsed chart color style palette when available
  if (colorPalette && colorPalette.length > 0) {
    return colorPalette[index % colorPalette.length];
  }
  const palette = getChartStylePalette(styleId);
  return palette[index % palette.length];
}

/**
 * Return the palette colour for an index given an optional chart style ID.
 * Use this when there is no series object (e.g. per-category colouring in
 * pie / funnel / treemap charts).
 *
 * When a `colorPalette` array is provided (from the chart's parsed color
 * style part), it takes priority over the style-id-derived palette.
 */
export function paletteColor(
  index: number,
  styleId?: number,
  colorPalette?: string[],
): string {
  if (colorPalette && colorPalette.length > 0) {
    return colorPalette[index % colorPalette.length];
  }
  const palette = getChartStylePalette(styleId);
  return palette[index % palette.length];
}

// ---------------------------------------------------------------------------
// Display units helpers (GAP-S2)
// ---------------------------------------------------------------------------

const DISPLAY_UNIT_DIVISORS: Record<string, number> = {
  hundreds: 100,
  thousands: 1_000,
  tenThousands: 10_000,
  hundredThousands: 100_000,
  millions: 1_000_000,
  tenMillions: 10_000_000,
  hundredMillions: 100_000_000,
  billions: 1_000_000_000,
  trillions: 1_000_000_000_000,
};

const DISPLAY_UNIT_LABELS: Record<string, string> = {
  hundreds: "Hundreds",
  thousands: "Thousands",
  tenThousands: "Ten Thousands",
  hundredThousands: "Hundred Thousands",
  millions: "Millions",
  tenMillions: "Ten Millions",
  hundredMillions: "Hundred Millions",
  billions: "Billions",
  trillions: "Trillions",
};

/** Get the numeric divisor for a built-in display unit name. */
export function getDisplayUnitDivisor(
  unit: string | undefined,
  customValue?: number,
): number {
  if (!unit) return 1;
  if (unit === "custom" && customValue) return customValue;
  return DISPLAY_UNIT_DIVISORS[unit] ?? 1;
}

/** Get the human-readable label for a display unit (custom label overrides built-in). */
export function getDisplayUnitLabel(
  unit: string | undefined,
  customLabel?: string,
): string {
  if (customLabel) return customLabel;
  if (!unit || unit === "custom") return "";
  return DISPLAY_UNIT_LABELS[unit] ?? "";
}

/** Format an axis value with display unit scaling applied. */
export function formatAxisValueWithUnits(
  value: number,
  axis?: PptxChartAxisFormatting,
): string {
  if (!axis?.displayUnits) return String(value);
  const divisor = getDisplayUnitDivisor(axis.displayUnits, axis.displayUnitsValue);
  const scaled = value / divisor;
  return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
}
