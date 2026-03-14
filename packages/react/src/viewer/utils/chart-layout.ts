import type { PptxChartStyle, PptxChartAxisFormatting, PptxChartDataTable } from "pptx-viewer-core";

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
