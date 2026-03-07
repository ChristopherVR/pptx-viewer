import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "../../core";
import {
  colour,
  nodeOpacity,
  styleShadow,
  styleStroke,
  truncate,
} from "./smartart-helpers";

/** basicCycle — circles arranged in a ring with connector lines. */
export function renderRingCycle(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const size = Math.min(element.width, element.height);
  const cx = element.width / 2;
  const cy = element.height / 2;
  const radius = size * 0.35;
  const nodeR = Math.max(size * 0.06, Math.min(size * 0.1, 200 / nodes.length));
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${element.width} ${element.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        const nextI = (i + 1) % nodes.length;
        const nextAngle = (nextI / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const nextX = cx + radius * Math.cos(nextAngle);
        const nextY = cy + radius * Math.sin(nextAngle);
        return (
          <g key={`${element.id}-cycle-${node.id}-${i}`}>
            <line
              x1={nx}
              y1={ny}
              x2={nextX}
              y2={nextY}
              stroke="#94a3b8"
              strokeWidth={1.5}
              opacity={0.5}
            />
            <circle
              cx={nx}
              cy={ny}
              r={nodeR}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={Math.max(6, nodeR * 0.65)}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** basicPie — pie chart with labelled sectors. */
export function renderSmartArtPieChart(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const cx = w * 0.42;
  const cy = h / 2;
  const r = Math.min(cx - 8, cy - 8);
  const shadow = styleShadow(style);
  const labelFontSize = Math.max(7, Math.min(10, r / 5));
  const n = nodes.length;

  const sectors = nodes.map((node, i) => {
    const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const endAngle = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const midAngle = (startAngle + endAngle) / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = n === 1 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    return { node, d, lx, ly, i };
  });

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {sectors.map(({ node, d, lx, ly, i }) => (
        <g key={`${element.id}-pie-${node.id}-${i}`}>
          <path
            d={d}
            fill={colour(i, palette)}
            opacity={nodeOpacity(i, nodes.length, style)}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth={1}
          />
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={labelFontSize}
            fontWeight="bold"
            className="pointer-events-none"
          >
            {truncate(node.text, 12)}
          </text>
        </g>
      ))}
      {/* Legend */}
      {nodes.map((node, i) => (
        <g key={`${element.id}-pie-leg-${node.id}-${i}`}>
          <rect
            x={cx + r + 10}
            y={cy - r + i * (labelFontSize + 5)}
            width={8}
            height={8}
            rx={2}
            fill={colour(i, palette)}
            opacity={nodeOpacity(i, nodes.length, style)}
          />
          <text
            x={cx + r + 22}
            y={cy - r + i * (labelFontSize + 5) + 4}
            dominantBaseline="central"
            fill="white"
            fontSize={labelFontSize}
            className="pointer-events-none"
          >
            {truncate(node.text, 18)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Dispatch to the correct cycle renderer. */
export function renderCycle(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const namedLayout =
    "smartArtData" in element ? element.smartArtData?.layout : undefined;
  if (namedLayout === "basicPie")
    return renderSmartArtPieChart(element, nodes, palette, style);
  return renderRingCycle(element, nodes, palette, style);
}
