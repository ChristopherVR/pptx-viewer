/**
 * SmartArt layout algorithms — additional arrangements.
 *
 * stepDownProcess, alternatingFlow, descendingProcess, pictureAccentList,
 * verticalBlockList, groupedList, pyramidList, horizontalPictureList,
 * accentProcess, verticalChevronList.
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
 * Step-Down Process — each step descends diagonally from left to right.
 */
export function layoutStepDownProcess(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const stepW = usableW / items.length;
  const stepH = usableH / items.length;
  const boxW = stepW * 0.85;
  const boxH = stepH * 0.6;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const x = bounds.x + padding + i * stepW;
    const y = bounds.y + padding + i * stepH;

    elements.push(
      makeShapeElement(
        nextId("sa-stepdown"),
        x,
        y,
        boxW,
        boxH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(10, boxW * 0.1)),
        },
      ),
    );

    // Connector arrow to next step
    if (i < items.length - 1) {
      elements.push(
        makeConnectorElement(
          nextId("sa-stepdown-conn"),
          x + boxW,
          y + boxH / 2,
          x + stepW,
          y + stepH,
          lighten(fill, 0.4),
        ),
      );
    }
  });

  return elements;
}

/**
 * Alternating Flow — nodes alternate left/right with a central spine.
 */
export function layoutAlternatingFlow(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const usableH = bounds.height - padding * 2;
  const rowH = usableH / items.length;
  const halfW = (bounds.width - padding * 2) / 2;
  const boxW = halfW * 0.8;
  const boxH = Math.min(rowH * 0.7, 40);
  const centerX = bounds.x + bounds.width / 2;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const y = bounds.y + padding + i * rowH + (rowH - boxH) / 2;
    const isLeft = i % 2 === 0;
    const x = isLeft
      ? centerX - boxW - 8
      : centerX + 8;

    elements.push(
      makeShapeElement(
        nextId("sa-altflow"),
        x,
        y,
        boxW,
        boxH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(10, boxW * 0.1)),
        },
      ),
    );

    // Connector to center spine
    const connX1 = isLeft ? x + boxW : x;
    const connX2 = centerX;
    const connY = y + boxH / 2;

    elements.push(
      makeConnectorElement(
        nextId("sa-altflow-conn"),
        connX1,
        connY,
        connX2,
        connY,
        lighten(fill, 0.4),
      ),
    );
  });

  return elements;
}

/**
 * Descending Process — vertical top-to-bottom with progressively narrower boxes.
 */
export function layoutDescendingProcess(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const maxW = bounds.width - padding * 2;
  const itemH = (usableH - gap * (items.length - 1)) / items.length;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const widthFraction = 1 - (i / Math.max(items.length, 1)) * 0.5;
    const w = maxW * widthFraction;
    const x = bounds.x + (bounds.width - w) / 2;
    const y = bounds.y + padding + i * (itemH + gap);

    elements.push(
      makeShapeElement(
        nextId("sa-descproc"),
        x,
        y,
        w,
        itemH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(11, itemH * 0.4)),
        },
      ),
    );

    // Down-arrow connector
    if (i < items.length - 1) {
      elements.push(
        makeConnectorElement(
          nextId("sa-descproc-conn"),
          bounds.x + bounds.width / 2,
          y + itemH,
          bounds.x + bounds.width / 2,
          y + itemH + gap,
          lighten(fill, 0.4),
        ),
      );
    }
  });

  return elements;
}

/**
 * Picture Accent List — shapes with a coloured accent circle on the left.
 */
export function layoutPictureAccentList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 6;
  const usableH = bounds.height - padding * 2;
  const usableW = bounds.width - padding * 2;
  const itemH = (usableH - gap * (items.length - 1)) / items.length;
  const circleR = Math.min(itemH * 0.4, 20);
  const textBoxW = usableW - circleR * 2 - 12;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const y = bounds.y + padding + i * (itemH + gap);

    // Accent circle
    elements.push(
      makeShapeElement(
        nextId("sa-picaccent-circle"),
        bounds.x + padding,
        y + (itemH - circleR * 2) / 2,
        circleR * 2,
        circleR * 2,
        "ellipse",
        fill,
        String(i + 1),
        { fontSize: Math.max(7, circleR * 0.7), fontColor: "#FFFFFF" },
      ),
    );

    // Text box
    elements.push(
      makeShapeElement(
        nextId("sa-picaccent-text"),
        bounds.x + padding + circleR * 2 + 8,
        y,
        textBoxW,
        itemH,
        "roundRect",
        lighten(fill, 0.6),
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(11, itemH * 0.35)),
          fontColor: "#333333",
          textAlign: "left",
        },
      ),
    );
  });

  return elements;
}

/**
 * Vertical Block List — vertical blocks with indented sub-text feel.
 */
export function layoutVerticalBlockList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const usableW = bounds.width - padding * 2;
  const itemH = (usableH - gap * (items.length - 1)) / items.length;
  const headerW = usableW * 0.25;
  const bodyW = usableW * 0.72;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const y = bounds.y + padding + i * (itemH + gap);

    // Header bar
    elements.push(
      makeShapeElement(
        nextId("sa-vblk-header"),
        bounds.x + padding,
        y,
        headerW,
        itemH,
        "rect",
        fill,
        String(i + 1),
        { fontSize: Math.max(8, itemH * 0.4), fontColor: "#FFFFFF" },
      ),
    );

    // Body block
    elements.push(
      makeShapeElement(
        nextId("sa-vblk-body"),
        bounds.x + padding + headerW + 4,
        y,
        bodyW,
        itemH,
        "roundRect",
        lighten(fill, 0.7),
        node.text,
        {
          cornerRadius: 10000,
          fontSize: Math.max(7, Math.min(11, itemH * 0.35)),
          fontColor: "#333333",
          textAlign: "left",
        },
      ),
    );
  });

  return elements;
}

/**
 * Grouped List — items in groups with a header and sub-items.
 * Groups are formed from parent-child relationships or by splitting into pairs.
 */
export function layoutGroupedList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 8;

  // Create groups of 2-3 items each
  const groupSize = items.length <= 4 ? 2 : 3;
  const groups: PptxSmartArtNode[][] = [];
  for (let i = 0; i < items.length; i += groupSize) {
    groups.push(items.slice(i, i + groupSize));
  }

  const usableW = bounds.width - padding * 2;
  const groupW = (usableW - gap * (groups.length - 1)) / groups.length;
  const usableH = bounds.height - padding * 2;

  groups.forEach((group, gi) => {
    const fill = accentColor(gi, themeColorMap);
    const gx = bounds.x + padding + gi * (groupW + gap);
    const headerH = usableH * 0.2;
    const subItemGap = 3;
    const subItemH =
      (usableH - headerH - 4 - subItemGap * (group.length - 1)) / group.length;

    // Group header bar
    elements.push(
      makeShapeElement(
        nextId("sa-grp-header"),
        gx,
        bounds.y + padding,
        groupW,
        headerH,
        "roundRect",
        fill,
        `Group ${gi + 1}`,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(10, groupW * 0.08)),
          fontColor: "#FFFFFF",
        },
      ),
    );

    // Sub-items
    group.forEach((node, si) => {
      const sy =
        bounds.y +
        padding +
        headerH +
        4 +
        si * (subItemH + subItemGap);
      elements.push(
        makeShapeElement(
          nextId("sa-grp-item"),
          gx + 4,
          sy,
          groupW - 8,
          subItemH,
          "roundRect",
          lighten(fill, 0.5),
          node.text,
          {
            cornerRadius: 10000,
            fontSize: Math.max(7, Math.min(10, subItemH * 0.35)),
            fontColor: "#333333",
          },
        ),
      );
    });
  });

  return elements;
}

/**
 * Pyramid List — pyramid shape on left with text callouts on the right.
 */
export function layoutPyramidList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const pyramidW = bounds.width * 0.4;
  const labelW = bounds.width * 0.5;
  const bandH = (usableH - gap * (items.length - 1)) / items.length;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const y = bounds.y + padding + i * (bandH + gap);

    // Pyramid trapezoid segment
    const topFrac = 0.3 + (i / Math.max(items.length - 1, 1)) * 0.7;
    const w = pyramidW * topFrac;
    const segX = bounds.x + padding + (pyramidW - w) / 2;

    elements.push(
      makeShapeElement(
        nextId("sa-pyrlist-seg"),
        segX,
        y,
        w,
        bandH,
        "rect",
        fill,
        "",
        {},
      ),
    );

    // Connector line
    elements.push(
      makeConnectorElement(
        nextId("sa-pyrlist-conn"),
        segX + w,
        y + bandH / 2,
        bounds.x + padding + pyramidW + 8,
        y + bandH / 2,
        lighten(fill, 0.3),
      ),
    );

    // Text label
    elements.push(
      makeShapeElement(
        nextId("sa-pyrlist-label"),
        bounds.x + padding + pyramidW + 12,
        y,
        labelW,
        bandH,
        "roundRect",
        lighten(fill, 0.7),
        node.text,
        {
          cornerRadius: 10000,
          fontSize: Math.max(7, Math.min(11, bandH * 0.35)),
          fontColor: "#333333",
          textAlign: "left",
        },
      ),
    );
  });

  return elements;
}

/**
 * Horizontal Picture List — horizontal row of circles with text labels below.
 */
export function layoutHorizontalPictureList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const gap = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const colW = (usableW - gap * (items.length - 1)) / items.length;
  const circleR = Math.min(colW * 0.4, usableH * 0.3);
  const labelH = usableH * 0.25;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const cx = bounds.x + padding + i * (colW + gap) + colW / 2;
    const cy = bounds.y + padding + circleR;

    // Circle placeholder
    elements.push(
      makeShapeElement(
        nextId("sa-hpic-circle"),
        cx - circleR,
        cy - circleR,
        circleR * 2,
        circleR * 2,
        "ellipse",
        fill,
        String(i + 1),
        { fontSize: Math.max(8, circleR * 0.5) },
      ),
    );

    // Text label below
    elements.push(
      makeShapeElement(
        nextId("sa-hpic-label"),
        bounds.x + padding + i * (colW + gap),
        cy + circleR + 6,
        colW,
        labelH,
        "roundRect",
        lighten(fill, 0.6),
        node.text,
        {
          cornerRadius: 10000,
          fontSize: Math.max(7, Math.min(10, colW * 0.1)),
          fontColor: "#333333",
        },
      ),
    );
  });

  return elements;
}

/**
 * Accent Process — process with accent circles behind rounded-rectangle boxes.
 */
export function layoutAccentProcess(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const arrowGap = 16;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const nodeW = (usableW - arrowGap * (items.length - 1)) / items.length;
  const nodeH = usableH * 0.5;
  const yOffset = bounds.y + padding + (usableH - nodeH) / 2;
  const circleR = Math.min(nodeW, nodeH) * 0.55;

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const x = bounds.x + padding + i * (nodeW + arrowGap);
    const cx = x + nodeW / 2;
    const cy = yOffset + nodeH / 2;

    // Accent circle (behind)
    elements.push(
      makeShapeElement(
        nextId("sa-accproc-circle"),
        cx - circleR,
        cy - circleR,
        circleR * 2,
        circleR * 2,
        "ellipse",
        lighten(fill, 0.5),
        "",
        {},
      ),
    );

    // Main box
    elements.push(
      makeShapeElement(
        nextId("sa-accproc-box"),
        x,
        yOffset,
        nodeW,
        nodeH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 16667,
          fontSize: Math.max(7, Math.min(11, nodeW * 0.1)),
        },
      ),
    );

    // Arrow connector
    if (i < items.length - 1) {
      const arrowX1 = x + nodeW;
      const arrowX2 = x + nodeW + arrowGap;
      const arrowY = yOffset + nodeH / 2;
      elements.push(
        makeConnectorElement(
          nextId("sa-accproc-arrow"),
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
 * Vertical Chevron List — vertically stacked chevron arrows.
 */
export function layoutVerticalChevronList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
  themeColorMap?: Record<string, string>,
): PptxElement[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const elements: PptxElement[] = [];
  const padding = 8;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const gap = 4;
  const itemH = (usableH - gap * (items.length - 1)) / items.length;
  const chevronDepth = Math.min(12, itemH * 0.3);

  items.forEach((node, i) => {
    const fill = accentColor(i, themeColorMap);
    const x = bounds.x + padding;
    const y = bounds.y + padding + i * (itemH + gap);

    // Use a roundRect as base shape since we can't do polygon in the decompose engine
    elements.push(
      makeShapeElement(
        nextId("sa-vchev"),
        x,
        y,
        usableW,
        itemH,
        "roundRect",
        fill,
        node.text,
        {
          cornerRadius: 8000,
          fontSize: Math.max(7, Math.min(11, itemH * 0.4)),
        },
      ),
    );

    // Down-arrow connector between items
    if (i < items.length - 1) {
      elements.push(
        makeConnectorElement(
          nextId("sa-vchev-conn"),
          x + usableW / 2,
          y + itemH,
          x + usableW / 2,
          y + itemH + gap,
          lighten(fill, 0.4),
        ),
      );
    }
  });

  return elements;
}
