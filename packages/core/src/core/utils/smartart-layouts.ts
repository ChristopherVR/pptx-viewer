/**
 * SmartArt layout algorithms — simple / flat arrangements.
 *
 * list, process, cycle, matrix, pyramid.
 */

import type { PptxElement, PptxSmartArtNode } from "../types";
import type { ContainerBounds } from "./smartart-helpers";
import {
  accentColor,
  lighten,
  getContentNodes,
  nextId,
  makeShapeElement,
  makeConnectorElement,
} from "./smartart-helpers";

// ── Layout algorithms ───────────────────────────────────────────────────

/**
 * List layout — stack nodes vertically with equal heights.
 */
export function layoutList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const gap = 6;
  const padding = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const itemH = (usableH - gap * (items.length - 1)) / items.length;

  return items.map((node, i) => {
    const fill = accentColor(i, themeColorMap);
    return makeShapeElement(
      nextId("sa-list"),
      bounds.x + padding,
      bounds.y + padding + i * (itemH + gap),
      usableW,
      itemH,
      "roundRect",
      fill,
      node.text,
      { cornerRadius: 16667, fontSize: Math.max(8, Math.min(11, itemH * 0.4)) },
    );
  });
}

/**
 * Process layout — horizontal left-to-right with arrow connectors.
 */
export function layoutProcess(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const arrowGap = 16;
  const padding = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const nodeW = (usableW - arrowGap * (items.length - 1)) / items.length;
  const nodeH = usableH * 0.6;
  const yOffset = bounds.y + padding + (usableH - nodeH) / 2;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const x = bounds.x + padding + i * (nodeW + arrowGap);

    elements.push(
      makeShapeElement(
        nextId("sa-proc"),
        x,
        yOffset,
        nodeW,
        nodeH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(8, Math.min(11, nodeW * 0.12)),
        },
      ),
    );

    // Arrow connector between nodes
    if (i < items.length - 1) {
      const arrowX1 = x + nodeW;
      const arrowX2 = x + nodeW + arrowGap;
      const arrowY = yOffset + nodeH / 2;
      elements.push(
        makeConnectorElement(
          nextId("sa-proc-arrow"),
          arrowX1,
          arrowY,
          arrowX2,
          arrowY,
          lighten(fill, 0.4),
        ),
      );
    }
  });

  return elements;
}

/**
 * Cycle layout — nodes arranged in a circle.
 */
export function layoutCycle(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const size = Math.min(bounds.width, bounds.height);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const radius = size * 0.32;
  const nodeW = Math.max(
    size * 0.18,
    Math.min(size * 0.28, 300 / items.length),
  );
  const nodeH = nodeW * 0.6;

  items.forEach((node, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + radius * Math.cos(angle) - nodeW / 2;
    const ny = cy + radius * Math.sin(angle) - nodeH / 2;
    const fill = accentColor(i, themeColorMap);

    elements.push(
      makeShapeElement(
        nextId("sa-cycle"),
        nx,
        ny,
        nodeW,
        nodeH,
        "roundRect",
        fill,
        node.text,
        { fontSize: Math.max(7, Math.min(10, nodeW * 0.1)) },
      ),
    );

    // Arc connector to next node
    if (items.length > 1) {
      const nextI = (i + 1) % items.length;
      const nextAngle = (nextI / items.length) * Math.PI * 2 - Math.PI / 2;
      const nx2 = cx + radius * Math.cos(nextAngle);
      const ny2 = cy + radius * Math.sin(nextAngle);
      const nx1 = cx + radius * Math.cos(angle);
      const ny1 = cy + radius * Math.sin(angle);

      elements.push(
        makeConnectorElement(
          nextId("sa-cycle-conn"),
          nx1,
          ny1,
          nx2,
          ny2,
          lighten(fill, 0.5),
        ),
      );
    }
  });

  return elements;
}

/**
 * Matrix layout — 2×2 (or NxM) grid of quadrants.
 */
export function layoutMatrix(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const cols = Math.ceil(Math.sqrt(items.length));
  const rows = Math.ceil(items.length / cols);
  const padding = 8;
  const gap = 6;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const cellW = (usableW - gap * (cols - 1)) / cols;
  const cellH = (usableH - gap * (rows - 1)) / rows;

  return items.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fill = accentColor(i, themeColorMap);

    return makeShapeElement(
      nextId("sa-matrix"),
      bounds.x + padding + col * (cellW + gap),
      bounds.y + padding + row * (cellH + gap),
      cellW,
      cellH,
      "roundRect",
      fill,
      node.text,
      {
        cornerRadius: 16667,
        fontSize: Math.max(8, Math.min(11, Math.min(cellW, cellH) * 0.12)),
      },
    );
  });
}

/**
 * Pyramid layout — stacked trapezoids from wide (bottom) to narrow (top).
 */
export function layoutPyramid(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const bandH = (usableH - gap * (items.length - 1)) / items.length;
  const maxW = bounds.width - padding * 2;

  return items.map((node, i) => {
    // Top band is narrowest, bottom is widest
    const widthFraction = 0.3 + (i / Math.max(items.length - 1, 1)) * 0.7;
    const w = maxW * widthFraction;
    const x = bounds.x + (bounds.width - w) / 2;
    const y = bounds.y + padding + i * (bandH + gap);
    const fill = accentColor(i, themeColorMap);

    return makeShapeElement(
      nextId("sa-pyramid"),
      x,
      y,
      w,
      bandH,
      "rect",
      fill,
      node.text,
      { fontSize: Math.max(8, Math.min(11, bandH * 0.4)) },
    );
  });
}
