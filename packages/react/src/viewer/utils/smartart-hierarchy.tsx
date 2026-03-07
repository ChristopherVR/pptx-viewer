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
  buildTree,
  treeWidth,
  treeDepth,
  type TreeNode,
} from "./smartart-helpers";

/** Render a hierarchy / org chart using the tree structure. */
export function renderHierarchy(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const roots = buildTree(nodes);
  if (roots.length === 0) {
    return renderFlatHierarchy(element, nodes, palette, style);
  }

  const totalWidth = roots.reduce((s, r) => s + treeWidth(r), 0);
  const depth = Math.max(...roots.map(treeDepth));
  const svgW = element.width;
  const svgH = element.height;
  const cellW = svgW / totalWidth;
  const cellH = svgH / Math.max(depth, 1);
  const boxW = Math.min(cellW * 0.8, 140);
  const boxH = Math.min(cellH * 0.4, 28);
  const fontSize = Math.max(7, Math.min(11, boxW / 12));
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  const elements: React.ReactNode[] = [];
  let colourIdx = 0;

  function renderTreeNode(t: TreeNode, xOffset: number, level: number): number {
    const w = treeWidth(t);
    const nodeCx = (xOffset + w / 2) * cellW;
    const nodeCy = level * cellH + cellH / 2;
    const ci = colourIdx++;

    elements.push(
      <rect
        key={`${element.id}-hier-box-${t.node.id}`}
        x={nodeCx - boxW / 2}
        y={nodeCy - boxH / 2}
        width={boxW}
        height={boxH}
        rx={4}
        fill={colour(ci, palette)}
        opacity={nodeOpacity(ci, nodes.length, style)}
        stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
        strokeWidth={sw}
      />,
    );
    elements.push(
      <text
        key={`${element.id}-hier-txt-${t.node.id}`}
        x={nodeCx}
        y={nodeCy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={fontSize}
        className="pointer-events-none"
      >
        {truncate(t.node.text, 60)}
      </text>,
    );

    let childOffset = xOffset;
    for (const child of t.children) {
      const childW = treeWidth(child);
      const childCx = (childOffset + childW / 2) * cellW;
      const childCy = (level + 1) * cellH + cellH / 2;

      elements.push(
        <line
          key={`${element.id}-hier-line-${t.node.id}-${child.node.id}`}
          x1={nodeCx}
          y1={nodeCy + boxH / 2}
          x2={childCx}
          y2={childCy - boxH / 2}
          stroke="#94a3b8"
          strokeWidth={1.5}
          opacity={0.5}
        />,
      );
      renderTreeNode(child, childOffset, level + 1);
      childOffset += childW;
    }
    return w;
  }

  let offset = 0;
  for (const root of roots) {
    offset += renderTreeNode(root, offset, 0);
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {elements}
    </svg>
  );
}

/** Fallback flat hierarchy when tree parsing yields no roots. */
export function renderFlatHierarchy(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const root = nodes[0];
  const children = nodes.slice(1);
  const shadow = styleShadow(style);
  return (
    <div
      className="w-full h-full px-2 py-2 pointer-events-none flex flex-col items-center gap-2 overflow-auto"
      style={{ filter: shadow }}
    >
      <div
        className="rounded-md px-3 py-1.5 text-[11px] text-white font-medium truncate max-w-[80%]"
        style={{ backgroundColor: colour(0, palette) }}
      >
        {root.text}
      </div>
      {children.length > 0 && (
        <>
          <div className="w-px h-3 bg-gray-400" />
          <div className="flex flex-wrap gap-1.5 justify-center">
            {children.map((node, i) => (
              <div
                key={`${element.id}-hier-${node.id}-${i}`}
                className="rounded border px-2 py-1 text-[10px] truncate max-w-[120px]"
                style={{
                  borderColor: colour(i + 1, palette),
                  color: colour(i + 1, palette),
                  opacity: nodeOpacity(i + 1, nodes.length, style),
                }}
              >
                {node.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
