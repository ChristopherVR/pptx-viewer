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

/** basicTimeline — horizontal line with alternating labels. */
export function renderTimeline(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const padX = 24;
  const lineY = h / 2;
  const lineStartX = padX;
  const lineEndX = w - padX;
  const lineLen = lineEndX - lineStartX;
  const dotR = Math.max(4, Math.min(8, lineLen / (nodes.length * 4)));
  const fontSize = Math.max(6, Math.min(10, lineLen / (nodes.length * 6)));
  const labelOffset = Math.min(h * 0.28, 40);
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      <line
        x1={lineStartX}
        y1={lineY}
        x2={lineEndX}
        y2={lineY}
        stroke="#94a3b8"
        strokeWidth={2}
      />
      {nodes.map((node, i) => {
        const x =
          nodes.length === 1
            ? (lineStartX + lineEndX) / 2
            : lineStartX + (i / (nodes.length - 1)) * lineLen;
        const above = i % 2 === 0;
        const textY = above ? lineY - labelOffset : lineY + labelOffset;
        const stemEndY = above ? lineY - dotR - 2 : lineY + dotR + 2;

        return (
          <g key={`${element.id}-timeline-${node.id}-${i}`}>
            <line
              x1={x}
              y1={stemEndY}
              x2={x}
              y2={textY + (above ? fontSize : -fontSize)}
              stroke={colour(i, palette)}
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={x}
              cy={lineY}
              r={dotR}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={x}
              y={textY}
              textAnchor="middle"
              dominantBaseline={above ? "auto" : "hanging"}
              fill={colour(i, palette)}
              fontSize={fontSize}
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

/** bendingProcess — snake / zigzag layout with connectors. */
export function renderBendingProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const COLS = 4;
  const w = element.width;
  const h = element.height;
  const rows = Math.ceil(nodes.length / COLS);
  const padX = 8;
  const padY = 8;
  const cellW = (w - padX * 2) / COLS;
  const cellH = (h - padY * 2) / Math.max(rows, 1);
  const boxW = cellW * 0.8;
  const boxH = Math.min(cellH * 0.6, 28);
  const fontSize = Math.max(7, Math.min(10, boxW / 10));
  const arrowSize = 6;
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
        const row = Math.floor(i / COLS);
        const colInRow = i % COLS;
        const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;

        const nodeCx = padX + col * cellW + cellW / 2;
        const nodeCy = padY + row * cellH + cellH / 2;

        let arrow: React.ReactNode = null;
        if (i < nodes.length - 1) {
          const nextRow = Math.floor((i + 1) / COLS);
          const nextColInRow = (i + 1) % COLS;
          const nextCol =
            nextRow % 2 === 0 ? nextColInRow : COLS - 1 - nextColInRow;
          const nextCx = padX + nextCol * cellW + cellW / 2;
          const nextCy = padY + nextRow * cellH + cellH / 2;

          if (nextRow === row) {
            const dir = nextCx > nodeCx ? 1 : -1;
            const startX = nodeCx + dir * (boxW / 2 + 2);
            const endX = nextCx - dir * (boxW / 2 + 2);
            arrow = (
              <g key={`${element.id}-snake-arrow-${node.id}-${i}`}>
                <line
                  x1={startX}
                  y1={nodeCy}
                  x2={endX}
                  y2={nodeCy}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${endX},${nodeCy - arrowSize / 2} ${endX + dir * arrowSize},${nodeCy} ${endX},${nodeCy + arrowSize / 2}`}
                  fill="#94a3b8"
                />
              </g>
            );
          } else {
            const startY = nodeCy + boxH / 2 + 2;
            const endY = nextCy - boxH / 2 - 2;
            arrow = (
              <g key={`${element.id}-snake-arrow-${node.id}-${i}`}>
                <line
                  x1={nodeCx}
                  y1={startY}
                  x2={nextCx}
                  y2={endY}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${nextCx - arrowSize / 2},${endY} ${nextCx},${endY + arrowSize} ${nextCx + arrowSize / 2},${endY}`}
                  fill="#94a3b8"
                />
              </g>
            );
          }
        }

        return (
          <g key={`${element.id}-snake-${node.id}-${i}`}>
            {arrow}
            <rect
              x={nodeCx - boxW / 2}
              y={nodeCy - boxH / 2}
              width={boxW}
              height={boxH}
              rx={4}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={nodeCx}
              y={nodeCy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
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
