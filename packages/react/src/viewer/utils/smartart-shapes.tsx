import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "pptx-viewer-core";
import { colour, nodeOpacity, styleShadow, truncate } from "./smartart-helpers";

export { renderMatrix } from "./smartart-matrix";

/** basicPyramid / invertedPyramid — expanding width blocks. */
export function renderPyramid(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const shadow = styleShadow(style);
  return (
    <div
      className="w-full h-full px-2 py-2 pointer-events-none flex flex-col items-center gap-1"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const widthPct = 30 + (i / Math.max(nodes.length - 1, 1)) * 70;
        return (
          <div
            key={`${element.id}-pyramid-${node.id}-${i}`}
            className="rounded text-[10px] text-white text-center truncate py-1 px-2"
            style={{
              width: `${widthPct}%`,
              backgroundColor: colour(i, palette),
              opacity: nodeOpacity(i, nodes.length, style),
            }}
          >
            {node.text}
          </div>
        );
      })}
    </div>
  );
}

/** basicVenn / linearVenn — overlapping circles. */
export function renderVenn(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const shadow = styleShadow(style);

  if (nodes.length <= 4) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.28;
    const spread = r * 0.55;
    const fontSize = Math.max(7, Math.min(11, r / 5));

    return (
      <svg
        className="w-full h-full pointer-events-none"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: shadow }}
      >
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
          const nx = cx + spread * Math.cos(angle);
          const ny = cy + spread * Math.sin(angle);
          return (
            <g key={`${element.id}-venn-${node.id}-${i}`}>
              <circle
                cx={nx}
                cy={ny}
                r={r}
                fill={colour(i, palette)}
                opacity={0.35}
              />
              <text
                x={nx}
                y={ny}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
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

  // 5+ nodes: horizontal row of overlapping circles
  const r = Math.min(h * 0.38, w / (nodes.length * 0.9));
  const overlap = r * 0.5;
  const totalW = nodes.length * (r * 2 - overlap) + overlap;
  const offsetX = (w - totalW) / 2 + r;
  const cy = h / 2;
  const fontSize = Math.max(6, Math.min(10, r / 4));

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const nx = offsetX + i * (r * 2 - overlap);
        return (
          <g key={`${element.id}-venn-${node.id}-${i}`}>
            <circle
              cx={nx}
              cy={cy}
              r={r}
              fill={colour(i, palette)}
              opacity={0.35}
            />
            <text
              x={nx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight="bold"
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

/** basicFunnel — narrowing trapezoid stages. */
export function renderFunnel(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const padding = 8;
  const usableW = w - padding * 2;
  const stageH = (h - padding * 2) / nodes.length;
  const fontSize = Math.max(7, Math.min(11, stageH * 0.45));
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const topWidth = usableW * (1 - i / nodes.length);
        const bottomWidth = usableW * (1 - (i + 1) / nodes.length);
        const y = padding + i * stageH;

        const topLeft = (w - topWidth) / 2;
        const topRight = topLeft + topWidth;
        const bottomLeft = (w - bottomWidth) / 2;
        const bottomRight = bottomLeft + bottomWidth;

        const points = [
          `${topLeft},${y}`,
          `${topRight},${y}`,
          `${bottomRight},${y + stageH}`,
          `${bottomLeft},${y + stageH}`,
        ].join(" ");

        return (
          <g key={`${element.id}-funnel-${node.id}-${i}`}>
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={w / 2}
              y={y + stageH / 2}
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

/** basicTarget / bullseye — concentric rings with labels. */
export function renderTarget(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const cx = w * 0.4;
  const cy = h / 2;
  const maxR = Math.min(cx - 8, cy - 8);
  const fontSize = Math.max(7, Math.min(10, maxR / (nodes.length + 1)));
  const labelX = cx + maxR + 8;
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const r = maxR * ((nodes.length - i) / nodes.length);
        const ringCy = cy;
        return (
          <g key={`${element.id}-target-${node.id}-${i}`}>
            <circle
              cx={cx}
              cy={ringCy}
              r={Math.max(r, 4)}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <line
              x1={cx + Math.max(r, 4)}
              y1={ringCy}
              x2={labelX - 2}
              y2={8 + i * (fontSize + 6)}
              stroke={colour(i, palette)}
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={labelX}
              y={8 + i * (fontSize + 6) + fontSize / 2}
              textAnchor="start"
              dominantBaseline="central"
              fill={colour(i, palette)}
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
