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

/** basicBlockList / stackedList — stacked coloured blocks. */
export function renderStackedBlockList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const shadow = styleShadow(style);
  const sw = styleStroke(style);
  return (
    <div className="w-full h-full px-2 py-2 pointer-events-none overflow-auto">
      <div className="w-full h-full flex flex-col gap-1.5">
        {nodes.map((node, nodeIndex) => (
          <div
            key={`${element.id}-smartart-node-${node.id}-${nodeIndex}`}
            className="rounded px-2 py-1.5 text-[10px] text-white truncate"
            style={{
              backgroundColor: colour(nodeIndex, palette),
              opacity: nodeOpacity(nodeIndex, nodes.length, style),
              filter: shadow,
              border:
                sw > 0 ? `${sw}px solid rgba(255,255,255,0.3)` : undefined,
            }}
          >
            {node.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** horizontalBulletList — equal boxes laid out in a horizontal row. */
export function renderHorizontalBulletList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const shadow = styleShadow(style);
  const sw = styleStroke(style);
  return (
    <div
      className="w-full h-full px-2 py-2 pointer-events-none overflow-hidden flex flex-row gap-1.5 items-center"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => (
        <div
          key={`${element.id}-hlist-${node.id}-${i}`}
          className="flex-1 rounded px-1.5 py-1.5 text-[10px] text-white text-center truncate flex items-center justify-center h-full"
          style={{
            backgroundColor: colour(i, palette),
            opacity: nodeOpacity(i, nodes.length, style),
            border: sw > 0 ? `${sw}px solid rgba(255,255,255,0.3)` : undefined,
          }}
        >
          {node.text}
        </div>
      ))}
    </div>
  );
}

/** tableList — table with a coloured header row and alternating body rows. */
export function renderTableList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const shadow = styleShadow(style);
  const headerColour = colour(0, palette);
  return (
    <div
      className="w-full h-full px-2 py-2 pointer-events-none overflow-auto"
      style={{ filter: shadow }}
    >
      <div className="w-full h-full flex flex-col rounded overflow-hidden border border-white/10">
        {nodes.map((node, i) => (
          <div
            key={`${element.id}-table-${node.id}-${i}`}
            className="px-2 py-1 text-[10px] text-white truncate flex-1 flex items-center"
            style={{
              backgroundColor:
                i === 0
                  ? headerColour
                  : i % 2 === 0
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.02)",
              fontWeight: i === 0 ? 600 : 400,
              opacity: nodeOpacity(i, nodes.length, style),
              borderBottom:
                i < nodes.length - 1
                  ? "1px solid rgba(255,255,255,0.08)"
                  : undefined,
            }}
          >
            {node.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/** trapezoidList — SVG parallelogram shapes. */
export function renderTrapezoidList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 3;
  const usableH = h - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const slant = Math.min(16, itemH * 0.4);
  const fontSize = Math.max(7, Math.min(11, itemH * 0.45));
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const y = pad + i * (itemH + gap);
        const offset = slant * (1 - i / Math.max(nodes.length - 1, 1));
        const points = [
          `${pad + offset},${y}`,
          `${w - pad},${y}`,
          `${w - pad - offset},${y + itemH}`,
          `${pad},${y + itemH}`,
        ].join(" ");
        return (
          <g key={`${element.id}-trap-${node.id}-${i}`}>
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={w / 2}
              y={y + itemH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** alternatingHexagons — hexagon grid with offset rows. */
export function renderAlternatingHexagons(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const cols = Math.ceil(Math.sqrt(nodes.length * 1.5));
  const rows = Math.ceil(nodes.length / cols);
  const hexR = Math.min(
    (w / (cols * 2 + 1)) * 0.95,
    (h / (rows * 1.75)) * 0.95,
  );
  const fontSize = Math.max(6, Math.min(10, hexR * 0.45));
  const shadow = styleShadow(style);

  function hexPoints(cx: number, cy: number, r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const hexW = hexR * Math.sqrt(3);
        const offsetX = row % 2 === 0 ? 0 : hexW / 2;
        const cx = hexW * col + hexW / 2 + offsetX + (w - cols * hexW) / 2;
        const cy = hexR * 1.5 * row + hexR + (h - rows * hexR * 1.5) / 2;
        return (
          <g key={`${element.id}-hex-${node.id}-${i}`}>
            <polygon
              points={hexPoints(cx, cy, hexR * 0.9)}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 12)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Dispatch to the correct list renderer based on named layout. */
export function renderBlockList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const namedLayout =
    "smartArtData" in element ? element.smartArtData?.layout : undefined;
  if (namedLayout === "horizontalBulletList")
    return renderHorizontalBulletList(element, nodes, palette, style);
  if (namedLayout === "tableList")
    return renderTableList(element, nodes, palette, style);
  if (namedLayout === "trapezoidList")
    return renderTrapezoidList(element, nodes, palette, style);
  if (namedLayout === "alternatingHexagons")
    return renderAlternatingHexagons(element, nodes, palette, style);
  return renderStackedBlockList(element, nodes, palette, style);
}
