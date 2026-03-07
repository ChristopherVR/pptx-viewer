/**
 * SmartArt decomposition helpers.
 *
 * Colour cycling, element factories, tree utilities, and shared constants
 * used by the layout algorithms and the main decompose entry-point.
 */

import type {
  PptxSmartArtNode,
  ShapePptxElement,
  ConnectorPptxElement,
  ShapeStyle,
  TextStyle,
} from "../types";

// ── Theme colour cycling ────────────────────────────────────────────────

/** Default accent colour cycle when no theme map is provided. */
export const DEFAULT_ACCENT_COLORS: readonly string[] = [
  "#4472C4",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#5B9BD5",
  "#70AD47",
] as const;

/**
 * Pick an accent colour from the theme map (accent1-accent6) or fall back
 * to a hard-coded palette.
 */
export function accentColor(
  index: number,
  themeColorMap?: Record<string, string>,
): string {
  if (themeColorMap) {
    const key = `accent${(index % 6) + 1}`;
    const colour = themeColorMap[key];
    if (colour) return colour.startsWith("#") ? colour : `#${colour}`;
  }
  return DEFAULT_ACCENT_COLORS[index % DEFAULT_ACCENT_COLORS.length];
}

/** Lighten a hex colour by mixing with white. */
export function lighten(hex: string, amount: number): string {
  const parsed = hex.replace("#", "");
  const r = parseInt(parsed.substring(0, 2), 16);
  const g = parseInt(parsed.substring(2, 4), 16);
  const b = parseInt(parsed.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

// ── Container bounds ────────────────────────────────────────────────────

export interface ContainerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Helpers to build standard element objects ───────────────────────────

let shapeCounter = 0;

export function nextId(prefix: string): string {
  return `${prefix}-${++shapeCounter}`;
}

/** Reset the counter — useful in tests. */
export function resetDecomposeCounter(): void {
  shapeCounter = 0;
}

export function makeShapeElement(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shapeType: string,
  fillColor: string,
  text: string,
  opts?: {
    rotation?: number;
    strokeColor?: string;
    strokeWidth?: number;
    fontSize?: number;
    fontColor?: string;
    textAlign?: "left" | "center" | "right";
    textVAlign?: "top" | "middle" | "bottom";
    cornerRadius?: number;
  },
): ShapePptxElement {
  const shapeStyle: ShapeStyle = {
    fillColor,
    fillMode: "solid",
    strokeColor: opts?.strokeColor ?? lighten(fillColor, 0.2),
    strokeWidth: opts?.strokeWidth ?? 1,
  };

  const textStyle: TextStyle = {
    fontSize: opts?.fontSize ?? 10,
    color: opts?.fontColor ?? "#FFFFFF",
    align: opts?.textAlign ?? "center",
    vAlign: opts?.textVAlign ?? "middle",
    fontFamily: "Calibri",
  };

  return {
    id,
    type: "shape",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(Math.round(width), 1),
    height: Math.max(Math.round(height), 1),
    rotation: opts?.rotation,
    shapeType,
    shapeAdjustments:
      opts?.cornerRadius != null ? { adj: opts.cornerRadius } : undefined,
    shapeStyle,
    text,
    textStyle,
    textSegments: [{ text, style: textStyle }],
  };
}

export function makeConnectorElement(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  colour: string,
): ConnectorPptxElement {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const w = Math.abs(x2 - x1) || 2;
  const h = Math.abs(y2 - y1) || 2;

  return {
    id,
    type: "connector",
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(w),
    height: Math.round(h),
    shapeType: "straightConnector1",
    shapeStyle: {
      strokeColor: colour,
      strokeWidth: 1.5,
      fillMode: "none",
    },
  };
}

// ── Tree helpers ────────────────────────────────────────────────────────

export interface TreeNode {
  node: PptxSmartArtNode;
  children: TreeNode[];
}

export function buildForest(nodes: PptxSmartArtNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) {
    map.set(n.id, { node: n, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const tn = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(tn);
    } else {
      roots.push(tn);
    }
  }
  return roots;
}

export function treeWidth(t: TreeNode): number {
  if (t.children.length === 0) return 1;
  return t.children.reduce((s, c) => s + treeWidth(c), 0);
}

export function treeDepth(t: TreeNode): number {
  if (t.children.length === 0) return 1;
  return 1 + Math.max(...t.children.map(treeDepth));
}

// ── Filter out root-only "doc" nodes with empty text ────────────────────

export function getContentNodes(nodes: PptxSmartArtNode[]): PptxSmartArtNode[] {
  return nodes.filter((n) => n.text.length > 0);
}
