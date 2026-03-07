/**
 * Trendline computation and rendering for chart overlays.
 */
import React from "react";

import type {
  PptxChartData,
  PptxChartTrendline,
} from "../../core";
import type { ChartPlotLayout, ChartValueRange } from "./chart-overlay-utils";
import { sColor, valToY, xToPixel } from "./chart-overlay-utils";

// ── Trendline computation ──────────────────────────────────────────────

interface TrendPoint {
  x: number;
  y: number;
}

function computeLinearRegression(
  xVals: number[],
  yVals: number[],
): { slope: number; intercept: number; rSquared: number } {
  const n = xVals.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0,
    sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xVals[i];
    sumY += yVals[i];
    sumXY += xVals[i] * yVals[i];
    sumXX += xVals[i] * xVals[i];
    sumYY += yVals[i] * yVals[i];
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12)
    return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const ssRes = yVals.reduce(
    (s, y, i) => s + (y - (slope * xVals[i] + intercept)) ** 2,
    0,
  );
  const meanY = sumY / n;
  const ssTot = yVals.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared };
}

function fitPolynomial(
  xVals: number[],
  yVals: number[],
  order: number,
): number[] {
  const n = xVals.length;
  const m = order + 1;
  const matrix: number[][] = Array.from(
    { length: m },
    () => Array(m + 1).fill(0) as number[],
  );

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += Math.pow(xVals[k], i + j);
      matrix[i][j] = sum;
    }
    let sum = 0;
    for (let k = 0; k < n; k++) sum += yVals[k] * Math.pow(xVals[k], i);
    matrix[i][m] = sum;
  }

  // Gaussian elimination
  for (let i = 0; i < m; i++) {
    let maxRow = i;
    for (let k = i + 1; k < m; k++) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
    }
    [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
    const pivot = matrix[i][i];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let j = i; j <= m; j++) matrix[i][j] /= pivot;
    for (let k = 0; k < m; k++) {
      if (k === i) continue;
      const factor = matrix[k][i];
      for (let j = i; j <= m; j++) matrix[k][j] -= factor * matrix[i][j];
    }
  }

  return matrix.map((row) => row[m]);
}

function computeRSquared(
  xVals: number[],
  yVals: number[],
  evalFn: (x: number) => number,
): number {
  const n = xVals.length;
  const meanY = yVals.reduce((s, y) => s + y, 0) / n;
  let ssRes = 0,
    ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (yVals[i] - evalFn(xVals[i])) ** 2;
    ssTot += (yVals[i] - meanY) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

function computeTrendlinePoints(
  trendline: PptxChartTrendline,
  values: number[],
  catCount: number,
  layout: ChartPlotLayout,
  range: ChartValueRange,
  mode: "line" | "bar",
): { points: TrendPoint[]; equation: string; rSquared: number } {
  const n = values.length;
  if (n < 2) return { points: [], equation: "", rSquared: 0 };

  const xVals = values.map((_v, i) => i);
  const yVals = values;

  const forward = trendline.forward ?? 0;
  const backward = trendline.backward ?? 0;
  const startX = -backward;
  const endX = n - 1 + forward;
  const steps = Math.max(Math.ceil((endX - startX) * 4), 20);

  let evalFn: (x: number) => number;
  let equation = "";
  let rSquared = 0;

  switch (trendline.trendlineType) {
    case "linear": {
      const reg = computeLinearRegression(xVals, yVals);
      const slope =
        trendline.intercept !== undefined
          ? yVals.reduce(
              (s, y, i) => s + (y - trendline.intercept!) * xVals[i],
              0,
            ) / xVals.reduce((s, x) => s + x * x, 0)
          : reg.slope;
      const b = trendline.intercept ?? reg.intercept;
      evalFn = (x) => slope * x + b;
      equation = `y = ${slope.toFixed(2)}x + ${b.toFixed(2)}`;
      rSquared = reg.rSquared;
      break;
    }
    case "exponential": {
      const logY = yVals.filter((y) => y > 0).map((y) => Math.log(y));
      const filteredX = xVals.filter((_x, i) => yVals[i] > 0);
      if (logY.length < 2) return { points: [], equation: "", rSquared: 0 };
      const reg = computeLinearRegression(filteredX, logY);
      const a = Math.exp(reg.intercept);
      const b = reg.slope;
      evalFn = (x) => a * Math.exp(b * x);
      equation = `y = ${a.toFixed(2)}e^(${b.toFixed(2)}x)`;
      rSquared = reg.rSquared;
      break;
    }
    case "logarithmic": {
      const lnX = xVals.filter((x) => x > 0).map((x) => Math.log(x));
      const filteredY = yVals.filter((_y, i) => xVals[i] > 0);
      if (lnX.length < 2) return { points: [], equation: "", rSquared: 0 };
      const reg = computeLinearRegression(lnX, filteredY);
      evalFn = (x) => (x > 0 ? reg.slope * Math.log(x) + reg.intercept : 0);
      equation = `y = ${reg.slope.toFixed(2)}ln(x) + ${reg.intercept.toFixed(2)}`;
      rSquared = reg.rSquared;
      break;
    }
    case "power": {
      const logX = xVals
        .filter((x, i) => x > 0 && yVals[i] > 0)
        .map((x) => Math.log(x));
      const logY = yVals
        .filter((y, i) => y > 0 && xVals[i] > 0)
        .map((y) => Math.log(y));
      if (logX.length < 2) return { points: [], equation: "", rSquared: 0 };
      const reg = computeLinearRegression(logX, logY);
      const a = Math.exp(reg.intercept);
      evalFn = (x) => (x > 0 ? a * Math.pow(x, reg.slope) : 0);
      equation = `y = ${a.toFixed(2)}x^${reg.slope.toFixed(2)}`;
      rSquared = reg.rSquared;
      break;
    }
    case "polynomial": {
      const order = Math.min(trendline.order ?? 2, 6);
      const coeffs = fitPolynomial(xVals, yVals, order);
      evalFn = (x) => coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
      equation = coeffs.map((c, i) => `${c.toFixed(2)}x^${i}`).join(" + ");
      rSquared = computeRSquared(xVals, yVals, evalFn);
      break;
    }
    case "movingAvg": {
      const period = trendline.period ?? 2;
      const maPoints: TrendPoint[] = [];
      for (let i = period - 1; i < n; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += yVals[j];
        const avgVal = sum / period;
        const px = xToPixel(i, catCount, layout, mode);
        const py = valToY(avgVal, range, layout.plotTop, layout.plotBottom);
        maPoints.push({ x: px, y: py });
      }
      return {
        points: maPoints,
        equation: `${period}-period moving average`,
        rSquared: 0,
      };
    }
    default:
      return { points: [], equation: "", rSquared: 0 };
  }

  const points: TrendPoint[] = [];
  for (let step = 0; step <= steps; step++) {
    const xVal = startX + ((endX - startX) * step) / steps;
    const yVal = evalFn(xVal);
    if (!Number.isFinite(yVal)) continue;
    const px = xToPixel(xVal, catCount, layout, mode);
    const py = valToY(yVal, range, layout.plotTop, layout.plotBottom);
    points.push({ x: px, y: py });
  }

  return { points, equation, rSquared };
}

// ── Render trendlines ──────────────────────────────────────────────────

export function renderTrendlines(
  elementId: string,
  chartData: PptxChartData,
  layout: ChartPlotLayout,
  range: ChartValueRange,
  mode: "line" | "bar",
): React.ReactNode {
  const catCount = Math.max(chartData.categories.length, 1);
  const nodes: React.ReactNode[] = [];

  chartData.series.forEach((series, si) => {
    if (!series.trendlines || series.trendlines.length === 0) return;

    series.trendlines.forEach((tl, ti) => {
      const { points, equation, rSquared } = computeTrendlinePoints(
        tl,
        series.values,
        catCount,
        layout,
        range,
        mode,
      );
      if (points.length < 2) return;

      const pathD = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");
      const strokeColor = tl.color || sColor(series, si);

      nodes.push(
        <path
          key={`${elementId}-tl-${si}-${ti}`}
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeDasharray="6 3"
          opacity={0.8}
        />,
      );

      const textParts: string[] = [];
      if (tl.displayEq && equation) textParts.push(equation);
      if (tl.displayRSq) textParts.push(`R\u00B2 = ${rSquared.toFixed(4)}`);

      if (textParts.length > 0) {
        const lastPt = points[points.length - 1];
        nodes.push(
          <text
            key={`${elementId}-tl-txt-${si}-${ti}`}
            x={lastPt.x}
            y={lastPt.y - 6}
            textAnchor="end"
            fontSize={7}
            fill={strokeColor}
          >
            {textParts.join("  ")}
          </text>,
        );
      }
    });
  });

  if (nodes.length === 0) return null;
  return <g key={`${elementId}-trendlines`}>{nodes}</g>;
}
