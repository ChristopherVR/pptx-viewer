import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import {
  type ValueRange,
  valueToY,
  seriesColor,
  formatAxisValue,
} from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderChrome } from "./chart-chrome";

/** Render a stacked or 100%-stacked bar chart. */
export function renderStackedBarChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const isPercent = chartData.grouping === "percentStacked";
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const catCount = Math.max(categoryLabels.length, 1);
  const barGroupWidth = layout.plotWidth / catCount;
  const barWidth = barGroupWidth * 0.6;
  const barOffset = (barGroupWidth - barWidth) / 2;

  const categoryTotals = Array.from({ length: catCount }, (_, ci) =>
    chartData.series.reduce((sum, s) => sum + Math.abs(s.values[ci] ?? 0), 0),
  );

  let stackMax = 0;
  let stackMin = 0;
  if (isPercent) {
    stackMax = 100;
    stackMin = 0;
  } else {
    for (let ci = 0; ci < catCount; ci++) {
      let posSum = 0;
      let negSum = 0;
      chartData.series.forEach((s) => {
        const v = s.values[ci] ?? 0;
        if (v >= 0) posSum += v;
        else negSum += v;
      });
      stackMax = Math.max(stackMax, posSum);
      stackMin = Math.min(stackMin, negSum);
    }
  }
  const range: ValueRange = {
    min: Math.min(stackMin, 0),
    max: Math.max(stackMax, 0),
    span: Math.max(Math.max(stackMax, 0) - Math.min(stackMin, 0), 1),
  };

  const bars: React.ReactNode[] = [];
  const dlElements: React.ReactNode[] = [];

  for (let ci = 0; ci < catCount; ci++) {
    let posRunning = 0;
    let negRunning = 0;
    const catTotal = categoryTotals[ci] || 1;

    chartData.series.forEach((series, si) => {
      const rawVal = series.values[ci] ?? 0;
      let val: number;
      if (isPercent) {
        val = catTotal > 0 ? (rawVal / catTotal) * 100 : 0;
      } else {
        val = rawVal;
      }

      const isNeg = val < 0;
      const base = isNeg ? negRunning : posRunning;
      const top = base + val;

      const x = layout.plotLeft + barGroupWidth * ci + barOffset;
      const baseY = valueToY(base, range, layout.plotTop, layout.plotBottom);
      const topY = valueToY(top, range, layout.plotTop, layout.plotBottom);
      const y = Math.min(baseY, topY);
      const h = Math.max(Math.abs(baseY - topY), 0.5);

      bars.push(
        <rect
          key={`${element.id}-stackbar-${ci}-${si}`}
          x={x}
          y={y}
          width={barWidth}
          height={h}
          fill={seriesColor(series, si)}
          rx={0}
        />,
      );

      if (style?.hasDataLabels && Math.abs(val) > 0) {
        dlElements.push(
          <text
            key={`${element.id}-stackbar-dl-${ci}-${si}`}
            x={x + barWidth / 2}
            y={y + h / 2 + 3}
            textAnchor="middle"
            fontSize={7}
            fill="#fff"
            fontWeight={600}
          >
            {isPercent ? `${Math.round(val)}%` : formatAxisValue(val)}
          </text>,
        );
      }

      if (isNeg) negRunning += val;
      else posRunning += val;
    });
  }

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
      {dlElements}
    </svg>
  );
}
