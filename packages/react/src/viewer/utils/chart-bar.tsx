import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import type { ValueRange } from "./chart-helpers";
import {
  PALETTE,
  computeValueRange,
  valueToY,
  formatAxisValue,
  seriesColor,
} from "./chart-helpers";
import {
  computeLayout,
  computeLayoutOptions,
  splitSeriesByAxis,
  getSecondaryValueAxis,
} from "./chart-layout";
import { renderChrome, renderOverlays } from "./chart-chrome";
import { renderChartDataTable } from "./chart-data-table";

/** Render a box-and-whisker chart. */
export function renderBoxWhiskerChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const layout = computeLayout(
    element.width,
    element.height,
    style,
    true,
    legendPos,
  );
  const allVals = chartData.series.flatMap((s) => s.values);
  const rangeMin = Math.min(...allVals, 0);
  const rangeMax = Math.max(...allVals, 1);
  const range: ValueRange = {
    min: rangeMin,
    max: rangeMax,
    span: Math.max(rangeMax - rangeMin, 1),
  };
  const catCount = Math.max(categoryLabels.length, 1);
  const boxGroupW = layout.plotWidth / catCount;
  const boxW = boxGroupW * 0.5;
  const boxOffset = (boxGroupW - boxW) / 2;

  const boxes: React.ReactNode[] = [];

  for (let ci = 0; ci < catCount; ci++) {
    const catVals = chartData.series
      .map((s) => s.values[ci] ?? 0)
      .sort((a, b) => a - b);
    if (catVals.length < 2) continue;

    const minV = catVals[0];
    const maxV = catVals[catVals.length - 1];
    const q1Idx = Math.floor(catVals.length * 0.25);
    const q3Idx = Math.floor(catVals.length * 0.75);
    const medIdx = Math.floor(catVals.length * 0.5);
    const q1 = catVals[q1Idx];
    const q3 = catVals[q3Idx];
    const median = catVals[medIdx];

    const x = layout.plotLeft + boxGroupW * ci + boxOffset;
    const xMid = x + boxW / 2;
    const yMin = valueToY(minV, range, layout.plotTop, layout.plotBottom);
    const yMax = valueToY(maxV, range, layout.plotTop, layout.plotBottom);
    const yQ1 = valueToY(q1, range, layout.plotTop, layout.plotBottom);
    const yQ3 = valueToY(q3, range, layout.plotTop, layout.plotBottom);
    const yMed = valueToY(median, range, layout.plotTop, layout.plotBottom);

    // Whisker lines
    boxes.push(
      <line
        key={`${element.id}-bw-wh-${ci}`}
        x1={xMid}
        y1={yMax}
        x2={xMid}
        y2={yQ3}
        stroke="#64748b"
        strokeWidth={1}
      />,
      <line
        key={`${element.id}-bw-wl-${ci}`}
        x1={xMid}
        y1={yQ1}
        x2={xMid}
        y2={yMin}
        stroke="#64748b"
        strokeWidth={1}
      />,
    );
    // Whisker caps
    boxes.push(
      <line
        key={`${element.id}-bw-ct-${ci}`}
        x1={x + boxW * 0.25}
        y1={yMax}
        x2={x + boxW * 0.75}
        y2={yMax}
        stroke="#64748b"
        strokeWidth={1}
      />,
      <line
        key={`${element.id}-bw-cb-${ci}`}
        x1={x + boxW * 0.25}
        y1={yMin}
        x2={x + boxW * 0.75}
        y2={yMin}
        stroke="#64748b"
        strokeWidth={1}
      />,
    );
    // Box (Q1 to Q3)
    boxes.push(
      <rect
        key={`${element.id}-bw-box-${ci}`}
        x={x}
        y={Math.min(yQ1, yQ3)}
        width={boxW}
        height={Math.abs(yQ1 - yQ3)}
        fill={PALETTE[ci % PALETTE.length]}
        stroke="#334155"
        strokeWidth={1}
        opacity={0.8}
        rx={1}
      />,
    );
    // Median line
    boxes.push(
      <line
        key={`${element.id}-bw-med-${ci}`}
        x1={x}
        y1={yMed}
        x2={x + boxW}
        y2={yMed}
        stroke="#1e293b"
        strokeWidth={2}
      />,
    );
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
      {boxes}
    </svg>
  );
}

/** Render a grouped bar chart (default fallback). */
export function renderDefaultBarChart(
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

  // Split series by axis for primary/secondary range computation
  const { primary, secondary } = splitSeriesByAxis(chartData.series, chartData.axes);
  const primarySeries = primary.length > 0 ? primary.map((e) => e.series) : chartData.series;
  const secondarySeries = secondary.map((e) => e.series);

  const range = computeValueRange(primarySeries);
  const secondaryRange = secondarySeries.length > 0 ? computeValueRange(secondarySeries) : undefined;
  const secondaryAxisFmt = getSecondaryValueAxis(chartData.axes);

  const catCount = Math.max(categoryLabels.length, 1);
  const seriesCount = chartData.series.length;
  const barGroupWidth = layout.plotWidth / catCount;
  const singleBarWidth = (barGroupWidth * 0.7) / Math.max(seriesCount, 1);
  const groupOffset = (barGroupWidth - singleBarWidth * seriesCount) / 2;

  const bars: React.ReactNode[] = [];
  const dlElements: React.ReactNode[] = [];

  for (let ci = 0; ci < catCount; ci++) {
    chartData.series.forEach((series, si) => {
      const val = series.values[ci] ?? 0;
      const x =
        layout.plotLeft +
        barGroupWidth * ci +
        groupOffset +
        singleBarWidth * si;

      // Use the correct range for this series (primary vs secondary)
      const isSecondary = secondary.some((e) => e.index === si);
      const activeRange = isSecondary && secondaryRange ? secondaryRange : range;

      const zeroY = valueToY(0, activeRange, layout.plotTop, layout.plotBottom);
      const valY = valueToY(val, activeRange, layout.plotTop, layout.plotBottom);
      const barY = Math.min(zeroY, valY);
      const barH = Math.max(Math.abs(zeroY - valY), 1);

      bars.push(
        <rect
          key={`${element.id}-bar-${ci}-s${si}`}
          x={x}
          y={barY}
          width={singleBarWidth}
          height={barH}
          fill={seriesColor(series, si)}
          rx={1}
        />,
      );

      if (style?.hasDataLabels) {
        dlElements.push(
          <text
            key={`${element.id}-bar-dl-${ci}-s${si}`}
            x={x + singleBarWidth / 2}
            y={val >= 0 ? barY - 4 : barY + barH + 10}
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
        {bars}
        {dlElements}
        {renderOverlays(element.id, chartData, layout, range, "bar")}
      </svg>
      {renderChartDataTable(element.id, chartData, layout.svgWidth)}
    </>
  );
}
