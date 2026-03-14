import type { PptxChartStyle, PptxChartAxisFormatting, PptxChartDataTable, PptxChartSeries } from "pptx-viewer-core";

// ── Layout computation ───────────────────────────────────────────

export interface PlotLayout {
  plotLeft: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  plotWidth: number;
  plotHeight: number;
  svgWidth: number;
  svgHeight: number;
}

/** Options for extended layout computation with secondary axes and data tables. */
export interface LayoutOptions {
  hasSecondaryValueAxis?: boolean;
  hasSecondaryCategoryAxis?: boolean;
  hasDataTable?: boolean;
  dataTableRowCount?: number;
}

export function computeLayout(
  elementWidth: number,
  elementHeight: number,
  style: PptxChartStyle | undefined,
  hasAxes: boolean,
  legendPos: string,
  options?: LayoutOptions,
): PlotLayout {
  const svgWidth = Math.max(320, elementWidth);
  const svgHeight = Math.max(180, elementHeight);
  let plotLeft = hasAxes ? 48 : 8;
  let plotTop = 8;
  let plotRight = svgWidth - 8;
  let plotBottom = svgHeight - (hasAxes ? 24 : 8);

  if (style?.hasTitle) plotTop += 20;
  if (style?.hasLegend) {
    if (legendPos === "b") plotBottom -= 20;
    else if (legendPos === "t") plotTop += 20;
    else if (legendPos === "r") plotRight -= 80;
    else if (legendPos === "l") plotLeft += 80;
  }

  // Reserve space for secondary value axis on the right
  if (options?.hasSecondaryValueAxis) {
    plotRight -= 40;
  }

  // Reserve space for secondary category axis on the top
  if (options?.hasSecondaryCategoryAxis) {
    plotTop += 16;
  }

  // Reserve space for data table below the chart
  if (options?.hasDataTable) {
    const rowCount = options.dataTableRowCount ?? 1;
    const dataTableHeight = 14 + rowCount * 14;
    plotBottom -= dataTableHeight;
  }

  const pw = Math.max(plotRight - plotLeft, 1);
  const ph = Math.max(plotBottom - plotTop, 1);
  return {
    plotLeft,
    plotTop,
    plotRight: plotLeft + pw,
    plotBottom: plotTop + ph,
    plotWidth: pw,
    plotHeight: ph,
    svgWidth,
    svgHeight,
  };
}

// ── Secondary axis helpers ───────────────────────────────────────

/** Check whether any axis in the list is a secondary value axis (position "r"). */
export function hasSecondaryValueAxis(
  axes: PptxChartAxisFormatting[] | undefined,
): boolean {
  if (!axes) return false;
  return axes.some((a) => a.axisType === "valAx" && a.axPos === "r");
}

/** Check whether any axis in the list is a secondary category axis (position "t"). */
export function hasSecondaryCategoryAxis(
  axes: PptxChartAxisFormatting[] | undefined,
): boolean {
  if (!axes) return false;
  return axes.some(
    (a) => (a.axisType === "catAx" || a.axisType === "dateAx") && a.axPos === "t",
  );
}

/** Get the secondary value axis formatting, if present. */
export function getSecondaryValueAxis(
  axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
  if (!axes) return undefined;
  return axes.find((a) => a.axisType === "valAx" && a.axPos === "r");
}

/** Get the secondary category axis formatting, if present. */
export function getSecondaryCategoryAxis(
  axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
  if (!axes) return undefined;
  return axes.find(
    (a) => (a.axisType === "catAx" || a.axisType === "dateAx") && a.axPos === "t",
  );
}

/** Compute layout options from chart data for use with computeLayout. */
export function computeLayoutOptions(
  axes: PptxChartAxisFormatting[] | undefined,
  dataTable: PptxChartDataTable | undefined,
  seriesCount: number,
): LayoutOptions {
  return {
    hasSecondaryValueAxis: hasSecondaryValueAxis(axes),
    hasSecondaryCategoryAxis: hasSecondaryCategoryAxis(axes),
    hasDataTable: !!dataTable,
    dataTableRowCount: dataTable ? seriesCount : undefined,
  };
}

// ── Series-to-axis mapping ────────────────────────────────────────

/** Get the axis ID of the secondary value axis, if present. */
export function getSecondaryValueAxisId(
  axes: PptxChartAxisFormatting[] | undefined,
): number | undefined {
  const ax = getSecondaryValueAxis(axes);
  return ax?.axisId;
}

/** Get the axis ID of the primary value axis (position "l" or first valAx). */
export function getPrimaryValueAxisId(
  axes: PptxChartAxisFormatting[] | undefined,
): number | undefined {
  if (!axes) return undefined;
  const primary = axes.find((a) => a.axisType === "valAx" && a.axPos === "l");
  return primary?.axisId ?? axes.find((a) => a.axisType === "valAx")?.axisId;
}

/**
 * Determine whether a series is mapped to the secondary axis.
 *
 * A series is secondary if:
 * 1. It has an `axisId` that matches the secondary value axis ID, OR
 * 2. No axis IDs are set on series, but we use a heuristic: in a combo chart,
 *    the second half of series often belong to the secondary axis.
 */
export function isSeriesOnSecondaryAxis(
  series: PptxChartSeries,
  axes: PptxChartAxisFormatting[] | undefined,
): boolean {
  if (!axes) return false;
  const secAxisId = getSecondaryValueAxisId(axes);
  if (secAxisId === undefined) return false;

  // If the series has an explicit axis ID, check against secondary
  if (series.axisId !== undefined) {
    return series.axisId === secAxisId;
  }

  return false;
}

/**
 * Split chart series into primary and secondary groups based on axis mapping.
 *
 * Returns `{ primary, secondary }` where each entry preserves the original index.
 */
export function splitSeriesByAxis(
  series: ReadonlyArray<PptxChartSeries>,
  axes: PptxChartAxisFormatting[] | undefined,
): { primary: { series: PptxChartSeries; index: number }[]; secondary: { series: PptxChartSeries; index: number }[] } {
  const primary: { series: PptxChartSeries; index: number }[] = [];
  const secondary: { series: PptxChartSeries; index: number }[] = [];

  for (let i = 0; i < series.length; i++) {
    if (isSeriesOnSecondaryAxis(series[i], axes)) {
      secondary.push({ series: series[i], index: i });
    } else {
      primary.push({ series: series[i], index: i });
    }
  }

  return { primary, secondary };
}

/** Height occupied by data table rows. */
export function computeDataTableHeight(
  dataTable: PptxChartDataTable | undefined,
  seriesCount: number,
): number {
  if (!dataTable) return 0;
  const rowCount = Math.max(seriesCount, 1);
  return 14 + rowCount * 14;
}
