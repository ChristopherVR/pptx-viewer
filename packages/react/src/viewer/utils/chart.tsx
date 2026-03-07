import React from "react";

import type { PptxElement } from "pptx-viewer-core";
import { renderPieChart } from "./chart-pie";
import { renderScatterChart, renderBubbleChart } from "./chart-scatter-bubble";
import { renderRadarChart } from "./chart-radar";
import { renderStockChart } from "./chart-stock";
import { renderAreaChart, renderLineChart } from "./chart-area-line";
import {
  renderWaterfallChart,
  renderComboChart,
} from "./chart-waterfall-combo";
import { renderStackedBarChart } from "./chart-stacked-bar";
import {
  renderSurfaceChart,
  renderTreemapChart,
} from "./chart-surface-treemap";
import {
  renderSunburstChart,
  renderFunnelChart,
} from "./chart-sunburst-funnel";
import { renderBoxWhiskerChart, renderDefaultBarChart } from "./chart-bar";

/**
 * Main entry point for chart rendering.
 * Dispatches to the appropriate chart-type renderer.
 */
export function renderChartElement(element: PptxElement): React.ReactNode {
  if (element.type !== "chart") {
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        Chart
      </div>
    );
  }

  const chartData = element.chartData;
  if (!chartData || chartData.series.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        Chart
      </div>
    );
  }

  const longestSeriesLength = chartData.series.reduce(
    (maxLength, series) => Math.max(maxLength, series.values.length),
    0,
  );
  const categoryLabels =
    chartData.categories.length > 0
      ? chartData.categories
      : Array.from({ length: longestSeriesLength }, (_, index) =>
          String(index + 1),
        );

  const chartType = chartData.chartType ?? "bar";

  if (
    chartType === "pie" ||
    chartType === "doughnut" ||
    chartType === "pie3D"
  ) {
    return renderPieChart(element, chartData, categoryLabels);
  }
  if (chartType === "scatter")
    return renderScatterChart(element, chartData, categoryLabels);
  if (chartType === "bubble")
    return renderBubbleChart(element, chartData, categoryLabels);
  if (chartType === "radar")
    return renderRadarChart(element, chartData, categoryLabels);
  if (chartType === "stock")
    return renderStockChart(element, chartData, categoryLabels);
  if (chartType === "area" || chartType === "area3D")
    return renderAreaChart(element, chartData, categoryLabels);
  if (chartType === "line" || chartType === "line3D")
    return renderLineChart(element, chartData, categoryLabels);
  if (chartType === "waterfall")
    return renderWaterfallChart(element, chartData, categoryLabels);
  if (chartType === "combo")
    return renderComboChart(element, chartData, categoryLabels);
  if (
    chartType === "bar" &&
    (chartData.grouping === "stacked" ||
      chartData.grouping === "percentStacked")
  ) {
    return renderStackedBarChart(element, chartData, categoryLabels);
  }
  if (chartType === "surface")
    return renderSurfaceChart(element, chartData, categoryLabels);
  if (chartType === "treemap")
    return renderTreemapChart(element, chartData, categoryLabels);
  if (chartType === "sunburst")
    return renderSunburstChart(element, chartData, categoryLabels);
  if (chartType === "funnel")
    return renderFunnelChart(element, chartData, categoryLabels);
  if (chartType === "boxWhisker")
    return renderBoxWhiskerChart(element, chartData, categoryLabels);

  return renderDefaultBarChart(element, chartData, categoryLabels);
}
