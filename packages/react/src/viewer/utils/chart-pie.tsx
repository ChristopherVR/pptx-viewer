import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { PALETTE, formatAxisValue, paletteColor } from "./chart-helpers";

/** Render a pie, doughnut, or 3D pie chart. */
export function renderPieChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const style = chartData.style;
  const legendPos = style?.legendPosition || "b";
  const chartType = chartData.chartType ?? "bar";

  const values = chartData.series[0]?.values ?? [];
  const total = values.reduce((sum, v) => sum + Math.abs(v), 0) || 1;
  const size = Math.min(element.width, element.height);
  const titleOffset = style?.hasTitle ? 20 : 0;
  const legendOffset = style?.hasLegend ? 20 : 0;
  const cx = size / 2;
  const cy = titleOffset + (size - titleOffset - legendOffset) / 2;
  const outerR = (size - titleOffset - legendOffset) * 0.42;
  const innerR = chartType === "doughnut" ? outerR * 0.55 : 0;
  let cumulativeAngle = -Math.PI / 2;

  const slices = values.map((val, i) => {
    const sliceAngle = (Math.abs(val) / total) * Math.PI * 2;
    const startAngle = cumulativeAngle;
    cumulativeAngle += sliceAngle;
    const endAngle = cumulativeAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);

    const d =
      innerR > 0
        ? `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc} 0 ${ix1},${iy1} Z`
        : `M${cx},${cy} L${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} Z`;

    return (
      <path
        key={`${element.id}-pie-${i}`}
        d={d}
        fill={chartData.series[0]?.color || paletteColor(i, chartData.style?.styleId)}
        stroke="white"
        strokeWidth={1.5}
      />
    );
  });

  // Data labels
  let dataLabels: React.ReactNode[] = [];
  if (style?.hasDataLabels) {
    let cumAngle = -Math.PI / 2;
    dataLabels = values.map((val, i) => {
      const sliceAngle = (Math.abs(val) / total) * Math.PI * 2;
      const midAngle = cumAngle + sliceAngle / 2;
      cumAngle += sliceAngle;
      const labelR = outerR * 0.7;
      const lx = cx + labelR * Math.cos(midAngle);
      const ly = cy + labelR * Math.sin(midAngle);
      return (
        <text
          key={`${element.id}-pie-dl-${i}`}
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={8}
          fontWeight={600}
          fill="#fff"
        >
          {formatAxisValue(val)}
        </text>
      );
    });
  }

  // Pie legend (category names)
  let pieLegend: React.ReactNode = null;
  if (style?.hasLegend && categoryLabels.length > 0) {
    const ly = legendPos === "t" ? (style?.hasTitle ? 24 : 6) : size - 10;
    const items: React.ReactNode[] = [];
    const charW = 6;
    const gapW = 20;
    const totalW = categoryLabels.reduce(
      (w, c) => w + c.length * charW + gapW,
      0,
    );
    let sx = (size - totalW) / 2;
    categoryLabels.forEach((cat, i) => {
      items.push(
        <rect
          key={`${element.id}-pie-lr-${i}`}
          x={sx}
          y={ly - 5}
          width={10}
          height={10}
          rx={2}
          fill={paletteColor(i, chartData.style?.styleId)}
        />,
      );
      items.push(
        <text
          key={`${element.id}-pie-lt-${i}`}
          x={sx + 14}
          y={ly + 4}
          fontSize={9}
          fill="#475569"
        >
          {cat}
        </text>,
      );
      sx += cat.length * charW + gapW;
    });
    pieLegend = <g key={`${element.id}-pie-legend`}>{items}</g>;
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {style?.hasTitle && (
        <text
          key={`${element.id}-pie-title`}
          x={size / 2}
          y={14}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="#1e293b"
        >
          {chartData.title || "Chart"}
        </text>
      )}
      {slices}
      {dataLabels}
      {pieLegend}
    </svg>
  );
}
