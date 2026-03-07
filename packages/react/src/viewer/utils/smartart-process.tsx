import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "pptx-viewer-core";
import {
  colour,
  nodeOpacity,
  styleShadow,
  styleStroke,
  truncate,
} from "./smartart-helpers";
export { renderUpwardArrow } from "./smartart-upward-arrow";
import { renderUpwardArrow } from "./smartart-upward-arrow";

/** basicChevronProcess — pointed arrow chevrons. */
export function renderChevronProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const chevronDepth = 12;
  const usableW = w - pad * 2;
  const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
  const itemH = Math.min(h - pad * 2, 60);
  const yMid = h / 2;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);
  const fontSize = Math.max(7, Math.min(11, itemW / 8));

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const x = pad + i * (itemW + gap);
        const halfH = itemH / 2;
        const isFirst = i === 0;
        const isLast = i === nodes.length - 1;

        const points = isFirst
          ? `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH}`
          : isLast
            ? `${x},${yMid - halfH} ${x + itemW},${yMid - halfH} ${x + itemW},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`
            : `${x},${yMid - halfH} ${x + itemW - chevronDepth},${yMid - halfH} ${x + itemW},${yMid} ${x + itemW - chevronDepth},${yMid + halfH} ${x},${yMid + halfH} ${x + chevronDepth},${yMid}`;

        return (
          <g key={`${element.id}-process-${node.id}-${i}`}>
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + itemW / 2}
              y={yMid}
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

/** segmentedProcess — rounded rectangles with small triangle connectors. */
export function renderSegmentedProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const arrowW = 12;
  const gap = 6;
  const usableW = w - pad * 2;
  const boxW =
    (usableW - (arrowW + gap * 2) * (nodes.length - 1)) / nodes.length;
  const boxH = Math.min(h - pad * 2, 48);
  const yMid = h / 2;
  const fontSize = Math.max(7, Math.min(11, boxW / 7));
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
        const x = pad + i * (boxW + arrowW + gap * 2);
        const col = colour(i, palette);
        const arrowX = x + boxW + gap;
        return (
          <g key={`${element.id}-seg-${node.id}-${i}`}>
            <rect
              x={x}
              y={yMid - boxH / 2}
              width={boxW}
              height={boxH}
              rx={6}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + boxW / 2}
              y={yMid}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
            {i < nodes.length - 1 && (
              <polygon
                points={`${arrowX},${yMid - 5} ${arrowX + arrowW},${yMid} ${arrowX},${yMid + 5}`}
                fill="#94a3b8"
                opacity={0.7}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** continuousBlockProcess — parallelogram blocks that visually flow. */
export function renderContinuousBlockProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 6;
  const slant = 10;
  const usableW = w - pad * 2;
  const itemW = usableW / nodes.length;
  const itemH = Math.min(h - pad * 2, 52);
  const yMid = h / 2;
  const fontSize = Math.max(7, Math.min(11, itemW / 8));
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
        const x = pad + i * itemW;
        const halfH = itemH / 2;
        const isFirst = i === 0;
        const isLast = i === nodes.length - 1;
        const leftSlant = isFirst ? 0 : slant;
        const rightSlant = isLast ? 0 : slant;
        const points = [
          `${x + leftSlant},${yMid - halfH}`,
          `${x + itemW},${yMid - halfH}`,
          `${x + itemW + rightSlant},${yMid + halfH}`,
          `${x},${yMid + halfH}`,
        ].join(" ");
        return (
          <g key={`${element.id}-cont-${node.id}-${i}`}>
            <polygon
              points={points}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + (itemW + leftSlant) / 2}
              y={yMid}
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

/** Dispatch to the correct process renderer based on named layout. */
export function renderProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const namedLayout =
    "smartArtData" in element ? element.smartArtData?.layout : undefined;
  if (namedLayout === "segmentedProcess")
    return renderSegmentedProcess(element, nodes, palette, style);
  if (namedLayout === "continuousBlockProcess")
    return renderContinuousBlockProcess(element, nodes, palette, style);
  if (namedLayout === "upwardArrow")
    return renderUpwardArrow(element, nodes, palette, style);
  return renderChevronProcess(element, nodes, palette, style);
}
