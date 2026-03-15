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

/** Render a histogram chart — contiguous bars with no gaps. */
export function renderHistogramChart(
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
  const values = chartData.series[0]?.values ?? [];
  const range = computeValueRange(chartData.series);
  const catCount = Math.max(categoryLabels.length, values.length, 1);
  const barWidth = layout.plotWidth / catCount;

  const bars: React.ReactNode[] = [];
  const dlElements: React.ReactNode[] = [];

  values.forEach((val, i) => {
    const x = layout.plotLeft + barWidth * i;
    const zeroY = valueToY(0, range, layout.plotTop, layout.plotBottom);
    const valY = valueToY(val, range, layout.plotTop, layout.plotBottom);
    const y = Math.min(zeroY, valY);
    const h = Math.max(Math.abs(zeroY - valY), 1);
    const color = chartData.series[0]?.color || PALETTE[i % PALETTE.length];

    bars.push(
      <rect
        key={`${element.id}-hist-${i}`}
        x={x}
        y={y}
        width={Math.max(barWidth - 0.5, 1)}
        height={h}
        fill={color}
        stroke="#fff"
        strokeWidth={0.5}
        opacity={0.85}
      />,
    );

    if (style?.hasDataLabels) {
      dlElements.push(
        <text
          key={`${element.id}-hist-dl-${i}`}
          x={x + barWidth / 2}
          y={y - 4}
          textAnchor="middle"
          fontSize={7}
          fill="#334155"
        >
          {formatAxisValue(val)}
        </text>,
      );
    }
  });

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

/** Render a geographic map chart fallback as a data table/legend. */
export function renderMapChartFallback(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const series = chartData.series;
  const categories = categoryLabels.length > 0 ? categoryLabels : chartData.categories;
  const svgWidth = element.width;
  const svgHeight = element.height;

  const rowHeight = Math.min(18, svgHeight / Math.max(categories.length + 2, 3));
  const fontSize = Math.min(10, rowHeight * 0.6);
  const headerY = 30;
  const tableX = 10;
  const colWidth = Math.max((svgWidth - 20) / (series.length + 1), 60);

  const elements: React.ReactNode[] = [];

  // Title
  if (chartData.title) {
    elements.push(
      <text
        key={`${element.id}-map-title`}
        x={svgWidth / 2}
        y={16}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#334155"
      >
        {chartData.title}
      </text>,
    );
  }

  // Map icon placeholder
  elements.push(
    <text
      key={`${element.id}-map-icon`}
      x={svgWidth / 2}
      y={headerY - 4}
      textAnchor="middle"
      fontSize={8}
      fill="#94a3b8"
    >
      Geographic Map (data view)
    </text>,
  );

  // Column headers
  elements.push(
    <text
      key={`${element.id}-map-h-cat`}
      x={tableX + 4}
      y={headerY + rowHeight}
      fontSize={fontSize}
      fontWeight={700}
      fill="#1e293b"
    >
      Region
    </text>,
  );
  series.forEach((s, si) => {
    elements.push(
      <text
        key={`${element.id}-map-h-${si}`}
        x={tableX + colWidth * (si + 1) + 4}
        y={headerY + rowHeight}
        fontSize={fontSize}
        fontWeight={700}
        fill="#1e293b"
      >
        {s.name}
      </text>,
    );
  });

  // Header underline
  elements.push(
    <line
      key={`${element.id}-map-hline`}
      x1={tableX}
      y1={headerY + rowHeight + 4}
      x2={svgWidth - 10}
      y2={headerY + rowHeight + 4}
      stroke="#cbd5e1"
      strokeWidth={1}
    />,
  );

  // Data rows
  categories.forEach((cat, ci) => {
    const y = headerY + rowHeight * (ci + 2) + 4;
    if (y + rowHeight > svgHeight) return;

    // Alternating row background
    if (ci % 2 === 0) {
      elements.push(
        <rect
          key={`${element.id}-map-bg-${ci}`}
          x={tableX}
          y={y - rowHeight + 4}
          width={svgWidth - 20}
          height={rowHeight}
          fill="#f1f5f9"
          rx={2}
        />,
      );
    }

    elements.push(
      <text
        key={`${element.id}-map-cat-${ci}`}
        x={tableX + 4}
        y={y}
        fontSize={fontSize}
        fill="#334155"
      >
        {cat}
      </text>,
    );

    series.forEach((s, si) => {
      const val = s.values[ci];
      elements.push(
        <text
          key={`${element.id}-map-v-${ci}-${si}`}
          x={tableX + colWidth * (si + 1) + 4}
          y={y}
          fontSize={fontSize}
          fill="#475569"
        >
          {val !== undefined ? formatAxisValue(val) : '—'}
        </text>,
      );
    });
  });

  // Color legend bar
  if (series.length > 0) {
    const legendY = Math.min(headerY + rowHeight * (categories.length + 3), svgHeight - 20);
    if (legendY < svgHeight - 10) {
      const vals = series[0].values.filter((v) => Number.isFinite(v));
      const minVal = Math.min(...vals, 0);
      const maxVal = Math.max(...vals, 1);
      const barW = Math.min(svgWidth * 0.5, 150);
      const barX = (svgWidth - barW) / 2;

      elements.push(
        <defs key={`${element.id}-map-defs`}>
          <linearGradient id={`${element.id}-map-grad`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a5f" />
          </linearGradient>
        </defs>,
        <rect
          key={`${element.id}-map-bar`}
          x={barX}
          y={legendY}
          width={barW}
          height={8}
          rx={4}
          fill={`url(#${element.id}-map-grad)`}
        />,
        <text
          key={`${element.id}-map-min`}
          x={barX}
          y={legendY + 18}
          fontSize={7}
          fill="#64748b"
          textAnchor="middle"
        >
          {formatAxisValue(minVal)}
        </text>,
        <text
          key={`${element.id}-map-max`}
          x={barX + barW}
          y={legendY + 18}
          fontSize={7}
          fill="#64748b"
          textAnchor="middle"
        >
          {formatAxisValue(maxVal)}
        </text>,
      );
    }
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="none"
    >
      <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#f8fafc" rx={4} />
      {elements}
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
