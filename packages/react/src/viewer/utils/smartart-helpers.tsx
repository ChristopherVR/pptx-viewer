import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  PptxSmartArtChrome,
  SmartArtColorScheme,
  SmartArtLayout,
  SmartArtStyle,
} from "pptx-viewer-core";

// ── Colour scheme palettes ──────────────────────────────────────────────────

export const PALETTES: Record<SmartArtColorScheme, string[]> = {
  colorful1: ["#3b82f6", "#22c55e", "#f97316", "#eab308", "#a855f7", "#ec4899"],
  colorful2: ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"],
  colorful3: ["#0ea5e9", "#84cc16", "#f43e5e", "#a855f7", "#f97316", "#10b981"],
  monochromatic1: [
    "#3b82f6",
    "#60a5fa",
    "#93c5fd",
    "#bfdbfe",
    "#2563eb",
    "#1d4ed8",
  ],
  monochromatic2: [
    "#6366f1",
    "#818cf8",
    "#a5b4fc",
    "#c7d2fe",
    "#4f46e5",
    "#4338ca",
  ],
};

export const DEFAULT_PALETTE = PALETTES.colorful1;

/** Pick a colour from the palette, cycling for any index. */
export function colour(
  index: number,
  palette: string[] = DEFAULT_PALETTE,
): string {
  return palette[index % palette.length];
}

/** Compute an opacity that fades slightly for later nodes. */
export function nodeOpacity(
  index: number,
  total: number,
  style?: SmartArtStyle,
): number {
  const base = style === "intense" ? 1.0 : style === "moderate" ? 0.92 : 0.85;
  if (total <= 1) return base;
  return base - (index / (total - 1)) * 0.15;
}

/** Get drop shadow filter for style intensity. */
export function styleShadow(style?: SmartArtStyle): string | undefined {
  if (style === "intense") return "drop-shadow(0 2px 6px rgba(0,0,0,0.35))";
  if (style === "moderate") return "drop-shadow(0 1px 3px rgba(0,0,0,0.2))";
  return undefined;
}

/** Stroke width for node outlines. */
export function styleStroke(style?: SmartArtStyle): number {
  if (style === "intense") return 2;
  if (style === "moderate") return 1.5;
  return 0;
}

/** Truncate text at `max` chars, adding ellipsis when clipped. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

/** Resolve palette from smartArtData — prefers color-transform fills. */
export function resolvePalette(el: PptxElement): string[] {
  if (el.type !== "smartArt" || !el.smartArtData) return DEFAULT_PALETTE;
  const ctFills = el.smartArtData.colorTransform?.fillColors;
  if (ctFills && ctFills.length > 0) return ctFills;
  return (
    PALETTES[el.smartArtData.colorScheme ?? "colorful1"] ?? DEFAULT_PALETTE
  );
}

/** Resolve style from smartArtData. */
export function resolveStyle(el: PptxElement): SmartArtStyle {
  if (el.type !== "smartArt" || !el.smartArtData) return "flat";
  return el.smartArtData.style ?? "flat";
}

// ── Tree helpers for hierarchy ─────────────────────────────────────────────

export interface TreeNode {
  node: PptxSmartArtNode;
  children: TreeNode[];
}

/** Build a forest from flat nodes using `parentId`. */
export function buildTree(nodes: PptxSmartArtNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) {
    map.set(n.id, { node: n, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const treeNode = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }
  return roots;
}

/** Measure the total width (in leaf-units) of a tree node. */
export function treeWidth(t: TreeNode): number {
  if (t.children.length === 0) return 1;
  return t.children.reduce((sum, c) => sum + treeWidth(c), 0);
}

/** Measure the depth of a tree. */
export function treeDepth(t: TreeNode): number {
  if (t.children.length === 0) return 1;
  return 1 + Math.max(...t.children.map(treeDepth));
}

// ── Named layout → category mapping ────────────────────────────────────────

/** Map a named SmartArt layout to a layoutType string for rendering. */
export function layoutToCategory(layout?: SmartArtLayout): string {
  if (!layout) return "list";
  const map: Record<SmartArtLayout, string> = {
    basicBlockList: "list",
    alternatingHexagons: "list",
    basicChevronProcess: "process",
    basicCycle: "cycle",
    basicPie: "cycle",
    basicRadial: "radial",
    basicVenn: "venn",
    continuousBlockProcess: "process",
    convergingRadial: "radial",
    hierarchy: "hierarchy",
    horizontalBulletList: "list",
    linearVenn: "venn",
    segmentedProcess: "process",
    stackedList: "list",
    tableList: "list",
    trapezoidList: "list",
    upwardArrow: "process",
    basicFunnel: "funnel",
    basicTarget: "radial",
    interlockingGears: "radial",
    basicTimeline: "process",
    basicMatrix: "matrix",
    basicPyramid: "pyramid",
    invertedPyramid: "pyramid",
    bendingProcess: "process",
    stepDownProcess: "stepdown",
    alternatingFlow: "alternatingflow",
    descendingProcess: "descending",
    pictureAccentList: "pictureaccent",
    verticalBlockList: "verticalblock",
    groupedList: "grouped",
    pyramidList: "pyramidlist",
    horizontalPictureList: "horizontalpicture",
    accentProcess: "accentprocess",
    verticalChevronList: "verticalchevron",
  };
  return map[layout] ?? "list";
}

// ── Chrome wrapper ──────────────────────────────────────────────────────────

/** Wrap SmartArt content in a chrome container with background and outline. */
export function withChrome(
  chrome: PptxSmartArtChrome | undefined,
  content: React.ReactNode,
): React.ReactNode {
  if (!chrome) return content;

  const wrapperStyle: React.CSSProperties = {};
  if (chrome.backgroundColor) {
    wrapperStyle.backgroundColor = chrome.backgroundColor;
  }
  if (chrome.outlineColor) {
    wrapperStyle.border = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
  }

  return (
    <div className="w-full h-full" style={wrapperStyle}>
      {content}
    </div>
  );
}
