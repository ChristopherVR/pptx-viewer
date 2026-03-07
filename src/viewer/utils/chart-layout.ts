import type { PptxChartStyle } from "../../core";

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

export function computeLayout(
  elementWidth: number,
  elementHeight: number,
  style: PptxChartStyle | undefined,
  hasAxes: boolean,
  legendPos: string,
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
