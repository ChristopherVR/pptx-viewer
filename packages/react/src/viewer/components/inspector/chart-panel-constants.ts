import type { PptxChartType, PptxChartData } from "pptx-viewer-core";

// ---------------------------------------------------------------------------
// Shared CSS tokens (kept in sync with InspectorPane)
// ---------------------------------------------------------------------------

export const HEADING =
  "text-[11px] uppercase tracking-wide text-muted-foreground";
export const CARD = "rounded border border-border bg-card p-2 space-y-2";
export const INPUT =
  "flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full";
export const BTN =
  "rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors";
export const CELL_INPUT =
  "bg-muted border border-border rounded px-1 py-0.5 text-[11px] w-full text-center";

// ---------------------------------------------------------------------------
// Chart type options
// ---------------------------------------------------------------------------

export const CHART_TYPE_OPTIONS: ReadonlyArray<{
  value: PptxChartType;
  labelKey: string;
}> = [
  { value: "bar", labelKey: "pptx.chart.typeBar" },
  { value: "line", labelKey: "pptx.chart.typeLine" },
  { value: "pie", labelKey: "pptx.chart.typePie" },
  { value: "doughnut", labelKey: "pptx.chart.typeDoughnut" },
  { value: "area", labelKey: "pptx.chart.typeArea" },
  { value: "scatter", labelKey: "pptx.chart.typeScatter" },
  { value: "bubble", labelKey: "pptx.chart.typeBubble" },
  { value: "radar", labelKey: "pptx.chart.typeRadar" },
  { value: "stock", labelKey: "pptx.chart.typeStock" },
  { value: "waterfall", labelKey: "pptx.chart.typeWaterfall" },
  { value: "combo", labelKey: "pptx.chart.typeCombo" },
];

export const GROUPING_OPTIONS: ReadonlyArray<{
  value: PptxChartData["grouping"];
  labelKey: string;
}> = [
  { value: "clustered", labelKey: "pptx.chart.groupingClustered" },
  { value: "stacked", labelKey: "pptx.chart.groupingStacked" },
  { value: "percentStacked", labelKey: "pptx.chart.groupingPercentStacked" },
];

export const LEGEND_POSITION_OPTIONS: ReadonlyArray<{
  value: string;
  labelKey: string;
}> = [
  { value: "t", labelKey: "pptx.chart.legendTop" },
  { value: "b", labelKey: "pptx.chart.legendBottom" },
  { value: "l", labelKey: "pptx.chart.legendLeft" },
  { value: "r", labelKey: "pptx.chart.legendRight" },
];

/** Chart types that support grouping modes. */
export const GROUPING_SUPPORTED_TYPES = new Set<PptxChartType>([
  "bar",
  "line",
  "area",
]);
