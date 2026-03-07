/**
 * SmartArt layout algorithms — tree-based arrangements.
 *
 * hierarchy (org chart) and relationship (Venn).
 */

import type { PptxElement, PptxSmartArtNode } from "../types";
import type { ContainerBounds, TreeNode } from "./smartart-helpers";
import {
  accentColor,
  lighten,
  getContentNodes,
  nextId,
  makeShapeElement,
  makeConnectorElement,
  buildForest,
  treeWidth,
  treeDepth,
} from "./smartart-helpers";
import { layoutList } from "./smartart-layouts";

// ── Tree-based layouts ──────────────────────────────────────────────────

/**
 * Hierarchy / organisation chart — tree layout with root at top.
 */
export function layoutHierarchy(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const roots = buildForest(nodes);
  if (roots.length === 0) {
    // Fall back to a flat list if tree construction fails
    return layoutList(nodes, bounds, themeColorMap);
  }

  const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
  const depth = Math.max(...roots.map(treeDepth));
  const padding = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const cellW = usableW / Math.max(totalLeaves, 1);
  const cellH = usableH / Math.max(depth, 1);
  const boxW = Math.min(cellW * 0.8, 140);
  const boxH = Math.min(cellH * 0.35, 28);

  const elements: PptxElement[] = [];
  let colourIdx = 0;

  function walk(t: TreeNode, xOffset: number, level: number): number {
    const w = treeWidth(t);
    const cx = bounds.x + padding + (xOffset + w / 2) * cellW;
    const cy = bounds.y + padding + level * cellH + cellH / 2;
    const ci = colourIdx++;
    const fill = accentColor(ci, themeColorMap);

    elements.push(
      makeShapeElement(
        nextId("sa-hier"),
        cx - boxW / 2,
        cy - boxH / 2,
        boxW,
        boxH,
        "roundRect",
        fill,
        t.node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(10, boxW / 14)),
        },
      ),
    );

    let childOffset = xOffset;
    for (const child of t.children) {
      const childW = treeWidth(child);
      const childCx = bounds.x + padding + (childOffset + childW / 2) * cellW;
      const childCy = bounds.y + padding + (level + 1) * cellH + cellH / 2;

      elements.push(
        makeConnectorElement(
          nextId("sa-hier-conn"),
          cx,
          cy + boxH / 2,
          childCx,
          childCy - boxH / 2,
          lighten(fill, 0.5),
        ),
      );
      walk(child, childOffset, level + 1);
      childOffset += childW;
    }
    return w;
  }

  let offset = 0;
  for (const root of roots) {
    offset += walk(root, offset, 0);
  }

  return elements;
}

/**
 * Relationship / Venn layout — overlapping circles for 2-4, row for 5+.
 */
export function layoutRelationship(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const size = Math.min(bounds.width, bounds.height);

  if (items.length <= 4) {
    const r = size * 0.22;
    const spread = r * 0.6;

    items.forEach((node, i) => {
      const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + spread * Math.cos(angle) - r;
      const ny = cy + spread * Math.sin(angle) - r;
      const fill = accentColor(i, themeColorMap);

      elements.push(
        makeShapeElement(
          nextId("sa-venn"),
          nx,
          ny,
          r * 2,
          r * 2,
          "ellipse",
          fill,
          node.text,
          { fontSize: Math.max(7, Math.min(10, r / 5)) },
        ),
      );
    });
  } else {
    // Horizontal row of circles
    const r = Math.min(size * 0.15, bounds.width / (items.length * 1.5));
    const totalW = items.length * r * 2;
    const startX = cx - totalW / 2 + r;

    items.forEach((node, i) => {
      const fill = accentColor(i, themeColorMap);
      elements.push(
        makeShapeElement(
          nextId("sa-venn"),
          startX + i * r * 2 - r,
          cy - r,
          r * 2,
          r * 2,
          "ellipse",
          fill,
          node.text,
          { fontSize: Math.max(6, Math.min(9, r / 4)) },
        ),
      );
    });
  }

  return elements;
}
