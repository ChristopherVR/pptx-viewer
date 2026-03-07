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

/** upwardArrow — vertical column, bottom-to-top, with upward arrow. */
export function renderUpwardArrow(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 3;
  const arrowHeadH = 16;
  const usableH = h - pad * 2 - arrowHeadH;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const boxW = w - pad * 2;
  const fontSize = Math.max(7, Math.min(11, itemH * 0.5));
  const shadow = styleShadow(style);
  const sw = styleStroke(style);
  const reversed = [...nodes].reverse();

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      <polygon
        points={`${w / 2 - 10},${pad + arrowHeadH} ${w / 2},${pad} ${w / 2 + 10},${pad + arrowHeadH}`}
        fill="#94a3b8"
        opacity={0.5}
      />
      {reversed.map((node, ri) => {
        const origI = nodes.length - 1 - ri;
        const y = pad + arrowHeadH + ri * (itemH + gap);
        return (
          <g key={`${element.id}-up-${node.id}-${ri}`}>
            <rect
              x={pad}
              y={y}
              width={boxW}
              height={itemH}
              rx={4}
              fill={colour(origI, palette)}
              opacity={nodeOpacity(origI, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={pad + boxW / 2}
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
