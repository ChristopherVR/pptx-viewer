import React from "react";

import type {
  PptxChartData,
  PptxChartSeries,
  PptxChartStyle,
  PptxChartAxisFormatting,
} from "pptx-viewer-core";
import {
  renderTrendlines,
  renderErrorBars,
  renderDropLines,
  renderHiLowLines,
  type ChartPlotLayout,
  type ChartValueRange,
} from "./chart-overlays";
import {
  type ValueRange,
  valueToY,
  formatAxisValue,
  formatAxisValueWithUnits,
  getDisplayUnitLabel,
  seriesColor,
  generateLogTicks,
} from "./chart-helpers";
import type { PlotLayout } from "./chart-layout";

// ── Title ────────────────────────────────────────────────────────

export function renderTitle(
  id: string,
  style: PptxChartStyle | undefined,
  title: string | undefined,
  svgWidth: number,
): React.ReactNode {
  if (!style?.hasTitle) return null;
  return (
    <text
      key={`${id}-title`}
      x={svgWidth / 2}
      y={16}
      textAnchor="middle"
      fontSize={12}
      fontWeight={600}
      fill="#1e293b"
    >
      {title || "Chart"}
    </text>
  );
}

// ── Legend ────────────────────────────────────────────────────────

export function renderLegend(
  id: string,
  style: PptxChartStyle | undefined,
  series: ReadonlyArray<PptxChartSeries>,
  layout: PlotLayout,
  colorPalette?: string[],
): React.ReactNode {
  if (!style?.hasLegend || series.length === 0) return null;
  const pos = style.legendPosition || "b";

  if (pos === "b" || pos === "t") {
    const y = pos === "b" ? layout.svgHeight - 10 : layout.plotTop - 14;
    const items: React.ReactNode[] = [];
    const charWidth = 6;
    const gap = 24;
    const totalWidth = series.reduce(
      (w, s) => w + (s.name?.length ?? 4) * charWidth + gap,
      0,
    );
    let cx = (layout.svgWidth - totalWidth) / 2;
    series.forEach((s, i) => {
      items.push(
        <rect
          key={`${id}-leg-r-${i}`}
          x={cx}
          y={y - 5}
          width={10}
          height={10}
          rx={2}
          fill={seriesColor(s, i, style?.styleId, colorPalette)}
        />,
      );
      items.push(
        <text
          key={`${id}-leg-t-${i}`}
          x={cx + 14}
          y={y + 4}
          fontSize={9}
          fill="#475569"
        >
          {s.name || `Series ${i + 1}`}
        </text>,
      );
      cx += (s.name?.length ?? 4) * charWidth + gap;
    });
    return <g key={`${id}-legend`}>{items}</g>;
  }

  // Right or left
  const x = pos === "r" ? layout.plotRight + 8 : 4;
  return (
    <g key={`${id}-legend`}>
      {series.map((s, i) => {
        const cy = layout.plotTop + i * 16;
        return (
          <g key={`${id}-leg-${i}`}>
            <rect
              x={x}
              y={cy}
              width={10}
              height={10}
              rx={2}
              fill={seriesColor(s, i, style?.styleId, colorPalette)}
            />
            <text x={x + 14} y={cy + 8} fontSize={9} fill="#475569">
              {s.name || `Series ${i + 1}`}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Gridlines ────────────────────────────────────────────────────

export function renderGridlines(
  id: string,
  style: PptxChartStyle | undefined,
  range: ValueRange,
  layout: PlotLayout,
): React.ReactNode {
  if (!style?.hasGridlines) return null;
  const lines: React.ReactNode[] = [];

  if (range.logScale && range.logBase) {
    // Logarithmic gridlines at each power of the base
    const ticks = generateLogTicks(range);
    ticks.forEach((tickVal, i) => {
      const y = valueToY(tickVal, range, layout.plotTop, layout.plotBottom);
      lines.push(
        <line
          key={`${id}-grid-log-${i}`}
          x1={layout.plotLeft}
          y1={y}
          x2={layout.plotRight}
          y2={y}
          stroke="#cbd5e1"
          strokeWidth={0.7}
          strokeDasharray="4 3"
        />,
      );
    });
  } else {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = range.min + (range.span * i) / steps;
      const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
      lines.push(
        <line
          key={`${id}-grid-${i}`}
          x1={layout.plotLeft}
          y1={y}
          x2={layout.plotRight}
          y2={y}
          stroke="#cbd5e1"
          strokeWidth={0.7}
          strokeDasharray="4 3"
        />,
      );
    }
  }

  return <g key={`${id}-gridlines`}>{lines}</g>;
}

// ── Axes ─────────────────────────────────────────────────────────

export function renderValueAxis(
  id: string,
  range: ValueRange,
  layout: PlotLayout,
  axisFormatting?: PptxChartAxisFormatting,
): React.ReactNode {
  const labels: React.ReactNode[] = [];
  const hasDisplayUnits = !!axisFormatting?.displayUnits;

  if (range.logScale && range.logBase) {
    // Logarithmic axis labels at each power of the base
    const ticks = generateLogTicks(range);
    ticks.forEach((tickVal, i) => {
      const y = valueToY(tickVal, range, layout.plotTop, layout.plotBottom);
      labels.push(
        <text
          key={`${id}-vaxis-log-${i}`}
          x={layout.plotLeft - 4}
          y={y + 3}
          textAnchor="end"
          fontSize={8}
          fill="#64748b"
        >
          {hasDisplayUnits
            ? formatAxisValueWithUnits(tickVal, axisFormatting)
            : formatAxisValue(tickVal)}
        </text>,
      );
    });
  } else {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = range.min + (range.span * i) / steps;
      const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
      labels.push(
        <text
          key={`${id}-vaxis-${i}`}
          x={layout.plotLeft - 4}
          y={y + 3}
          textAnchor="end"
          fontSize={8}
          fill="#64748b"
        >
          {hasDisplayUnits
            ? formatAxisValueWithUnits(val, axisFormatting)
            : formatAxisValue(val)}
        </text>,
      );
    }
  }

  // Display units label (e.g. "Thousands", "Millions")
  if (hasDisplayUnits) {
    const unitLabel = getDisplayUnitLabel(
      axisFormatting!.displayUnits,
      axisFormatting!.displayUnitsLabel,
    );
    if (unitLabel) {
      const midY = (layout.plotTop + layout.plotBottom) / 2;
      labels.push(
        <text
          key={`${id}-vaxis-dispunit`}
          x={layout.plotLeft - 36}
          y={midY}
          textAnchor="middle"
          fontSize={9}
          fill="#64748b"
          transform={`rotate(-90, ${layout.plotLeft - 36}, ${midY})`}
        >
          {unitLabel}
        </text>,
      );
    }
  }

  return <g key={`${id}-vaxis`}>{labels}</g>;
}

export function renderCategoryAxis(
  id: string,
  categories: ReadonlyArray<string>,
  layout: PlotLayout,
): React.ReactNode {
  const count = categories.length;
  if (count === 0) return null;
  return (
    <g key={`${id}-caxis`}>
      {categories.map((cat, i) => {
        const slotWidth = layout.plotWidth / count;
        const x = layout.plotLeft + slotWidth * i + slotWidth / 2;
        return (
          <text
            key={`${id}-caxis-${i}`}
            x={x}
            y={layout.plotBottom + 14}
            textAnchor="middle"
            fontSize={8}
            fill="#64748b"
          >
            {cat}
          </text>
        );
      })}
    </g>
  );
}

export function renderCategoryAxisForLine(
  id: string,
  categories: ReadonlyArray<string>,
  layout: PlotLayout,
): React.ReactNode {
  const count = categories.length;
  if (count === 0) return null;
  return (
    <g key={`${id}-caxis`}>
      {categories.map((cat, i) => {
        const x =
          count > 1
            ? layout.plotLeft + (layout.plotWidth * i) / (count - 1)
            : layout.plotLeft + layout.plotWidth / 2;
        return (
          <text
            key={`${id}-caxis-${i}`}
            x={x}
            y={layout.plotBottom + 14}
            textAnchor="middle"
            fontSize={8}
            fill="#64748b"
          >
            {cat}
          </text>
        );
      })}
    </g>
  );
}

// ── Zero line ────────────────────────────────────────────────────

export function renderZeroLine(
  id: string,
  range: ValueRange,
  layout: PlotLayout,
): React.ReactNode {
  // No zero line for log scale (log(0) is undefined)
  if (range.logScale) return null;
  if (range.min >= 0) return null;
  const y = valueToY(0, range, layout.plotTop, layout.plotBottom);
  return (
    <line
      key={`${id}-zero`}
      x1={layout.plotLeft}
      y1={y}
      x2={layout.plotRight}
      y2={y}
      stroke="#334155"
      strokeWidth={1}
    />
  );
}

// ── Secondary value axis ─────────────────────────────────────────

/** Render a secondary (right-side) value axis with its own scale. */
export function renderSecondaryValueAxis(
  id: string,
  range: ValueRange,
  layout: PlotLayout,
  axisFormatting?: PptxChartAxisFormatting,
): React.ReactNode {
  const steps = 4;
  const labels: React.ReactNode[] = [];
  const fontSize = axisFormatting?.fontSize ?? 8;
  const fontColor = axisFormatting?.fontColor ?? "#64748b";
  const fontFamily = axisFormatting?.fontFamily;
  const fontWeight = axisFormatting?.fontBold ? 700 : undefined;
  const hasDisplayUnits = !!axisFormatting?.displayUnits;

  for (let i = 0; i <= steps; i++) {
    const val = range.min + (range.span * i) / steps;
    const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
    labels.push(
      <text
        key={`${id}-sec-vaxis-${i}`}
        x={layout.plotRight + 4}
        y={y + 3}
        textAnchor="start"
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fill={fontColor}
      >
        {hasDisplayUnits
          ? formatAxisValueWithUnits(val, axisFormatting)
          : formatAxisValue(val)}
      </text>,
    );
  }

  // Secondary axis title (if present)
  if (axisFormatting?.titleText) {
    labels.push(
      <text
        key={`${id}-sec-vaxis-title`}
        x={layout.plotRight + 36}
        y={(layout.plotTop + layout.plotBottom) / 2}
        textAnchor="middle"
        fontSize={9}
        fill={fontColor}
        transform={`rotate(-90, ${layout.plotRight + 36}, ${(layout.plotTop + layout.plotBottom) / 2})`}
      >
        {axisFormatting.titleText}
      </text>,
    );
  }

  // Display units label for secondary axis
  if (hasDisplayUnits) {
    const unitLabel = getDisplayUnitLabel(
      axisFormatting!.displayUnits,
      axisFormatting!.displayUnitsLabel,
    );
    if (unitLabel) {
      const labelX = layout.plotRight + (axisFormatting?.titleText ? 52 : 36);
      const midY = (layout.plotTop + layout.plotBottom) / 2;
      labels.push(
        <text
          key={`${id}-sec-vaxis-dispunit`}
          x={labelX}
          y={midY}
          textAnchor="middle"
          fontSize={9}
          fill={fontColor}
          transform={`rotate(-90, ${labelX}, ${midY})`}
        >
          {unitLabel}
        </text>,
      );
    }
  }

  return <g key={`${id}-sec-vaxis`}>{labels}</g>;
}

/** Render tick marks on the right side for the secondary value axis. */
export function renderSecondaryAxisTicks(
  id: string,
  range: ValueRange,
  layout: PlotLayout,
): React.ReactNode {
  const steps = 4;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= steps; i++) {
    const val = range.min + (range.span * i) / steps;
    const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
    ticks.push(
      <line
        key={`${id}-sec-tick-${i}`}
        x1={layout.plotRight}
        y1={y}
        x2={layout.plotRight + 4}
        y2={y}
        stroke="#94a3b8"
        strokeWidth={0.7}
      />,
    );
  }
  return <g key={`${id}-sec-ticks`}>{ticks}</g>;
}

/** Render minor gridlines from the secondary value axis (dashed, lighter). */
export function renderSecondaryGridlines(
  id: string,
  range: ValueRange,
  layout: PlotLayout,
  axisFormatting?: PptxChartAxisFormatting,
): React.ReactNode {
  if (!axisFormatting?.minorGridlinesSpPr && !axisFormatting?.majorGridlinesSpPr) {
    return null;
  }
  const steps = 4;
  const lines: React.ReactNode[] = [];
  const gridColor = axisFormatting.majorGridlinesSpPr?.strokeColor ?? "#e2e8f0";
  for (let i = 0; i <= steps; i++) {
    const val = range.min + (range.span * i) / steps;
    const y = valueToY(val, range, layout.plotTop, layout.plotBottom);
    lines.push(
      <line
        key={`${id}-sec-grid-${i}`}
        x1={layout.plotLeft}
        y1={y}
        x2={layout.plotRight}
        y2={y}
        stroke={gridColor}
        strokeWidth={0.5}
        strokeDasharray="2 3"
        opacity={0.5}
      />,
    );
  }
  return <g key={`${id}-sec-gridlines`}>{lines}</g>;
}

// ── Combined chrome ──────────────────────────────────────────────

/** Options for secondary axis rendering within the chrome. */
export interface ChromeSecondaryAxisOptions {
  secondaryRange?: ValueRange;
  secondaryAxisFormatting?: PptxChartAxisFormatting;
}

/** Wrap all common chrome (title, legend, gridlines, value axis, zero line, secondary axis). */
export function renderChrome(
  id: string,
  chartData: PptxChartData,
  layout: PlotLayout,
  range: ValueRange,
  categories: ReadonlyArray<string>,
  options: { categoryAxisStyle: "bar" | "line" },
  secondaryOptions?: ChromeSecondaryAxisOptions,
): React.ReactNode[] {
  const style = chartData.style;
  const chrome: React.ReactNode[] = [];
  // Find the primary value axis formatting for display units
  const primaryValueAxis = chartData.axes?.find(
    (a) => a.axisType === "valAx" && a.axPos !== "r",
  ) ?? chartData.axes?.find((a) => a.axisType === "valAx");
  chrome.push(renderTitle(id, style, chartData.title, layout.svgWidth));
  chrome.push(renderGridlines(id, style, range, layout));
  chrome.push(renderValueAxis(id, range, layout, primaryValueAxis));
  chrome.push(renderZeroLine(id, range, layout));
  if (options.categoryAxisStyle === "bar") {
    chrome.push(renderCategoryAxis(id, categories, layout));
  } else {
    chrome.push(renderCategoryAxisForLine(id, categories, layout));
  }
  chrome.push(renderLegend(id, style, chartData.series, layout, chartData.colorPalette));

  // Secondary value axis
  if (secondaryOptions?.secondaryRange) {
    chrome.push(
      renderSecondaryValueAxis(
        id,
        secondaryOptions.secondaryRange,
        layout,
        secondaryOptions.secondaryAxisFormatting,
      ),
    );
    chrome.push(
      renderSecondaryAxisTicks(id, secondaryOptions.secondaryRange, layout),
    );
    chrome.push(
      renderSecondaryGridlines(
        id,
        secondaryOptions.secondaryRange,
        layout,
        secondaryOptions.secondaryAxisFormatting,
      ),
    );
  }

  return chrome;
}

// ── Overlays ─────────────────────────────────────────────────────

/** Render advanced overlays: trendlines, error bars, drop lines, hi-low lines. */
export function renderOverlays(
  id: string,
  chartData: PptxChartData,
  layout: PlotLayout,
  range: ValueRange,
  mode: "line" | "bar",
): React.ReactNode[] {
  const overlayLayout: ChartPlotLayout = layout;
  const overlayRange: ChartValueRange = range;
  const nodes: React.ReactNode[] = [];
  nodes.push(renderDropLines(id, chartData, overlayLayout, overlayRange, mode));
  nodes.push(
    renderHiLowLines(id, chartData, overlayLayout, overlayRange, mode),
  );
  nodes.push(
    renderTrendlines(id, chartData, overlayLayout, overlayRange, mode),
  );
  nodes.push(renderErrorBars(id, chartData, overlayLayout, overlayRange, mode));
  return nodes;
}
