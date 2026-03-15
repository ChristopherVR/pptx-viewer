/**
 * sparkline-renderer.ts — Inline mini-chart (sparkline) SVG renderer.
 *
 * Sparklines are tiny charts typically shown in table cells or alongside text.
 * Supports three types: line, bar, and win/loss.
 */

export interface SparklineData {
  values: number[];
  type: "line" | "bar" | "winLoss";
  color?: string;
  negativeColor?: string;
  width?: number;
  height?: number;
}

/** Default dimensions when not specified. */
const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 20;
const DEFAULT_COLOR = "#2563eb";
const DEFAULT_NEGATIVE_COLOR = "#dc2626";

/** Internal padding (px) to prevent clipping at edges. */
const PADDING = 2;

/**
 * Render a sparkline as an SVG string.
 *
 * - **Line**: SVG `<polyline>` connecting data points.
 * - **Bar**: SVG `<rect>` bars for each value, negative bars extend downward.
 * - **Win/Loss**: Fixed-height bars — up for positive, down for negative/zero.
 */
export function renderSparklineSvg(data: SparklineData): string {
  const { values, type } = data;
  if (!values || values.length === 0) {
    return renderEmptySvg(data);
  }

  switch (type) {
    case "line":
      return renderLineSparkline(data);
    case "bar":
      return renderBarSparkline(data);
    case "winLoss":
      return renderWinLossSparkline(data);
    default:
      return renderEmptySvg(data);
  }
}

/** Render an empty SVG placeholder when there are no data points. */
function renderEmptySvg(data: SparklineData): string {
  const w = data.width ?? DEFAULT_WIDTH;
  const h = data.height ?? DEFAULT_HEIGHT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>`;
}

/**
 * Scale a value from [min, max] to [outMin, outMax].
 * Returns the midpoint when min === max (flat data).
 */
function scaleValue(
  value: number,
  min: number,
  max: number,
  outMin: number,
  outMax: number,
): number {
  if (max === min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Line Sparkline ──────────────────────────────────────────────────────

function renderLineSparkline(data: SparklineData): string {
  const { values } = data;
  const w = data.width ?? DEFAULT_WIDTH;
  const h = data.height ?? DEFAULT_HEIGHT;
  const color = data.color ?? DEFAULT_COLOR;

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Usable area after padding
  const drawW = w - PADDING * 2;
  const drawH = h - PADDING * 2;

  const points = values
    .map((v, i) => {
      const x = values.length === 1
        ? PADDING + drawW / 2
        : PADDING + (i / (values.length - 1)) * drawW;
      // Y is inverted: high values at the top
      const y = PADDING + drawH - scaleValue(v, min, max, 0, drawH);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<polyline points="${escapeAttr(points)}" fill="none" stroke="${escapeAttr(color)}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    `</svg>`,
  ].join("");
}

// ── Bar Sparkline ───────────────────────────────────────────────────────

function renderBarSparkline(data: SparklineData): string {
  const { values } = data;
  const w = data.width ?? DEFAULT_WIDTH;
  const h = data.height ?? DEFAULT_HEIGHT;
  const color = data.color ?? DEFAULT_COLOR;
  const negColor = data.negativeColor ?? DEFAULT_NEGATIVE_COLOR;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const drawW = w - PADDING * 2;
  const drawH = h - PADDING * 2;

  // Determine the zero line position within the drawing area.
  // If all values >= 0, zero is at the bottom; if all <= 0, zero at the top.
  const zeroY = PADDING + drawH - scaleValue(0, min, max, 0, drawH);

  const barGap = 1;
  const totalGaps = values.length > 1 ? (values.length - 1) * barGap : 0;
  const barWidth = Math.max(1, (drawW - totalGaps) / values.length);

  const rects = values
    .map((v, i) => {
      const x = PADDING + i * (barWidth + barGap);
      const valY = PADDING + drawH - scaleValue(v, min, max, 0, drawH);

      // Bar extends from zeroY to valY
      const barTop = Math.min(zeroY, valY);
      const barHeight = Math.max(0.5, Math.abs(zeroY - valY));

      const fill = v < 0 ? negColor : color;
      return `<rect x="${x.toFixed(2)}" y="${barTop.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" fill="${escapeAttr(fill)}"/>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    rects,
    `</svg>`,
  ].join("");
}

// ── Win/Loss Sparkline ──────────────────────────────────────────────────

function renderWinLossSparkline(data: SparklineData): string {
  const { values } = data;
  const w = data.width ?? DEFAULT_WIDTH;
  const h = data.height ?? DEFAULT_HEIGHT;
  const color = data.color ?? DEFAULT_COLOR;
  const negColor = data.negativeColor ?? DEFAULT_NEGATIVE_COLOR;

  const drawW = w - PADDING * 2;
  const halfH = (h - PADDING * 2) / 2;

  const barGap = 1;
  const totalGaps = values.length > 1 ? (values.length - 1) * barGap : 0;
  const barWidth = Math.max(1, (drawW - totalGaps) / values.length);

  const rects = values
    .map((v, i) => {
      const x = PADDING + i * (barWidth + barGap);
      const isPositive = v > 0;

      // Positive bars go upward from the center, negative go downward
      const barTop = isPositive ? PADDING : PADDING + halfH;
      const barHeight = halfH;
      const fill = isPositive ? color : negColor;

      return `<rect x="${x.toFixed(2)}" y="${barTop.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" fill="${escapeAttr(fill)}"/>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    rects,
    `</svg>`,
  ].join("");
}
