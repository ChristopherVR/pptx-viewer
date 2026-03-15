import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { seriesColor, formatAxisValue } from "./chart-helpers";
import { computeLayout } from "./chart-layout";
import { renderTitle, renderLegend } from "./chart-chrome";

/** Render a radar / spider chart. */
export function renderRadarChart(
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
    false,
    legendPos,
  );
  const cx = layout.plotLeft + layout.plotWidth / 2;
  const cy = layout.plotTop + layout.plotHeight / 2;
  const radius = Math.min(layout.plotWidth, layout.plotHeight) / 2 - 4;
  const catCount = categoryLabels.length || 1;
  const maxVal = Math.max(
    1,
    ...chartData.series.flatMap((s) => s.values.map(Math.abs)),
  );

  // Axis spokes + ring gridlines
  const spokes: React.ReactNode[] = [];
  const rings = 4;
  for (let r = 1; r <= rings; r++) {
    const rr = (radius * r) / rings;
    const ringPts = Array.from({ length: catCount }, (_, i) => {
      const angle = (Math.PI * 2 * i) / catCount - Math.PI / 2;
      return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
    }).join(" ");
    spokes.push(
      <polygon
        key={`${element.id}-radar-ring-${r}`}
        points={ringPts}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth={0.5}
        strokeDasharray={r < rings ? "3 2" : "0"}
      />,
    );
  }
  for (let i = 0; i < catCount; i++) {
    const angle = (Math.PI * 2 * i) / catCount - Math.PI / 2;
    spokes.push(
      <line
        key={`${element.id}-radar-spoke-${i}`}
        x1={cx}
        y1={cy}
        x2={cx + radius * Math.cos(angle)}
        y2={cy + radius * Math.sin(angle)}
        stroke="#94a3b8"
        strokeWidth={0.5}
      />,
    );
    const labelR = radius + 10;
    spokes.push(
      <text
        key={`${element.id}-radar-cat-${i}`}
        x={cx + labelR * Math.cos(angle)}
        y={cy + labelR * Math.sin(angle)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={8}
        fill="#64748b"
      >
        {categoryLabels[i] ?? ""}
      </text>,
    );
  }

  // Data polygons
  const polygons = chartData.series.map((series, si) => {
    const pts = series.values
      .slice(0, catCount)
      .map((val, vi) => {
        const angle = (Math.PI * 2 * vi) / catCount - Math.PI / 2;
        const r = (Math.abs(val) / maxVal) * radius;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      })
      .join(" ");
    const c = seriesColor(series, si, chartData.style?.styleId, chartData.colorPalette);
    return (
      <g key={`${element.id}-radar-s-${si}`}>
        <polygon
          points={pts}
          fill={c}
          opacity={0.2}
          stroke={c}
          strokeWidth={1.5}
        />
        {series.values.slice(0, catCount).map((val, vi) => {
          const angle = (Math.PI * 2 * vi) / catCount - Math.PI / 2;
          const r = (Math.abs(val) / maxVal) * radius;
          return (
            <circle
              key={`${element.id}-radar-dot-${si}-${vi}`}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={3}
              fill={c}
            />
          );
        })}
      </g>
    );
  });

  // Data labels
  let radarDataLabels: React.ReactNode[] = [];
  if (style?.hasDataLabels) {
    radarDataLabels = chartData.series.flatMap((series, si) =>
      series.values.slice(0, catCount).map((val, vi) => {
        const angle = (Math.PI * 2 * vi) / catCount - Math.PI / 2;
        const r = (Math.abs(val) / maxVal) * radius;
        return (
          <text
            key={`${element.id}-radar-dl-${si}-${vi}`}
            x={cx + r * Math.cos(angle)}
            y={cy + r * Math.sin(angle) - 8}
            textAnchor="middle"
            fontSize={7}
            fill="#334155"
          >
            {formatAxisValue(val)}
          </text>
        );
      }),
    );
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {renderTitle(element.id, style, chartData.title, layout.svgWidth)}
      {spokes}
      {polygons}
      {radarDataLabels}
      {renderLegend(element.id, style, chartData.series, layout)}
    </svg>
  );
}
