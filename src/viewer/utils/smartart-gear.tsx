import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "../../core";
import { colour, nodeOpacity, styleShadow, truncate } from "./smartart-helpers";

/** Generate an SVG path for a gear shape. */
function gearPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  teeth: number,
): string {
  const segments: string[] = [];
  const step = (Math.PI * 2) / (teeth * 2);

  for (let i = 0; i < teeth * 2; i++) {
    const angle = i * step - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    segments.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

/** interlockingGears — gear shapes with label sidebar. */
export function renderGear(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const gearNodes = nodes.slice(0, 3);
  const extraNodes = nodes.slice(3);
  const gearCount = gearNodes.length;
  const gearAreaW = extraNodes.length > 0 ? w * 0.7 : w;
  const spacing = gearAreaW / (gearCount + 1);
  const gearR = Math.min(spacing * 0.4, h * 0.35);
  const innerR = gearR * 0.7;
  const teethCount = 8;
  const fontSize = Math.max(7, Math.min(11, gearR / 4));
  const labelFontSize = Math.max(7, Math.min(10, 11));
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {gearNodes.map((node, i) => {
        const gx = spacing * (i + 1);
        const gy = h / 2 + (i % 2 === 0 ? 0 : gearR * 0.35);
        return (
          <g key={`${element.id}-gear-${node.id}-${i}`}>
            <path
              d={gearPath(gx, gy, gearR, innerR, teethCount)}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <circle
              cx={gx}
              cy={gy}
              r={innerR * 0.5}
              fill="white"
              opacity={0.25}
            />
            <text
              x={gx}
              y={gy}
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
      {extraNodes.map((node, i) => {
        const lx = gearAreaW + 10;
        const ly = 14 + i * (labelFontSize + 6);
        return (
          <g key={`${element.id}-gear-extra-${node.id}-${i}`}>
            <circle
              cx={lx}
              cy={ly}
              r={3}
              fill={colour(gearCount + i, palette)}
              opacity={nodeOpacity(gearCount + i, nodes.length, style)}
            />
            <text
              x={lx + 8}
              y={ly}
              textAnchor="start"
              dominantBaseline="central"
              fill={colour(gearCount + i, palette)}
              fontSize={labelFontSize}
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
