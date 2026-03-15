import React from "react";

import type { PptxChartData } from "pptx-viewer-core";
import { seriesColor } from "./chart-helpers";

function formatValue(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(1);
}

export function renderChartDataTable(
  elementId: string,
  chartData: PptxChartData,
  svgWidth: number,
): React.ReactNode {
  const table = chartData.dataTable;
  if (!table) return null;

  const categories = chartData.categories;
  const series = chartData.series;
  if (categories.length === 0 && series.length === 0) return null;

  const borderColor = "#cbd5e1";
  const showH = table.showHorzBorder !== false;
  const showV = table.showVertBorder !== false;
  const showO = table.showOutline !== false;
  const showK = table.showKeys !== false;

  const borderStyle = `1px solid ${borderColor}`;

  return (
    <div
      key={`${elementId}-dtable`}
      style={{
        width: svgWidth,
        overflow: "hidden",
        fontSize: 8,
        lineHeight: "14px",
        color: "#334155",
        pointerEvents: "none",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: showO ? borderStyle : "none",
        }}
      >
        <thead>
          <tr>
            {showK && (
              <th
                style={{
                  padding: "1px 4px",
                  fontWeight: 400,
                  borderBottom: showH ? borderStyle : "none",
                  borderRight: showV ? borderStyle : "none",
                  textAlign: "left",
                }}
              />
            )}
            {categories.map((cat, ci) => (
              <th
                key={`${elementId}-dtable-h-${ci}`}
                style={{
                  padding: "1px 4px",
                  fontWeight: 600,
                  borderBottom: showH ? borderStyle : "none",
                  borderRight:
                    showV && ci < categories.length - 1 ? borderStyle : "none",
                  textAlign: "center",
                }}
              >
                {cat}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((s, si) => (
            <tr key={`${elementId}-dtable-r-${si}`}>
              {showK && (
                <td
                  style={{
                    padding: "1px 4px",
                    borderBottom:
                      showH && si < series.length - 1 ? borderStyle : "none",
                    borderRight: showV ? borderStyle : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: seriesColor(s, si, chartData.style?.styleId),
                      marginRight: 4,
                      verticalAlign: "middle",
                    }}
                  />
                  {s.name}
                </td>
              )}
              {categories.map((_cat, ci) => (
                <td
                  key={`${elementId}-dtable-c-${si}-${ci}`}
                  style={{
                    padding: "1px 4px",
                    textAlign: "center",
                    borderBottom:
                      showH && si < series.length - 1 ? borderStyle : "none",
                    borderRight:
                      showV && ci < categories.length - 1
                        ? borderStyle
                        : "none",
                  }}
                >
                  {s.values[ci] !== undefined ? formatValue(s.values[ci]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
