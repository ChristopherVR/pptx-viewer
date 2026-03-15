/**
 * SmartArt Layout Engine.
 *
 * Computes shape positions from SmartArt data models WITHOUT relying on
 * pre-computed `drawing*.xml`.  The engine can optionally parse
 * `dgm:layoutDef` XML to extract algorithm type, constraints, and rules,
 * but also works purely from a `PptxSmartArtData` object and a layout type.
 *
 * This is the "Phase 2" layout engine referenced in `PptxSmartArtParser` —
 * it supersedes the heuristic fallback in `smartart-decompose.ts` when
 * richer layout information is available.
 *
 * @module smartart-layout-engine
 */

import type {
  PptxSmartArtData,
  PptxSmartArtNode,
  PptxSmartArtDrawingShape,
  SmartArtLayoutType,
} from "../types";
import type { ContainerBounds, TreeNode } from "./smartart-helpers";
import { buildForest, treeWidth, treeDepth, getContentNodes } from "./smartart-helpers";

// ============================================================================
// Public types
// ============================================================================

/**
 * A positioned shape produced by the layout engine.
 */
export interface LayoutEngineShape {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Constraint values parsed from `dgm:constrLst` or provided manually.
 *
 * All spacing/size values are expressed as fractions of the container
 * dimension (0-1) unless otherwise noted.  `primFontSz` is in points.
 */
export interface LayoutConstraints {
  /** Node width as a fraction of container width (0-1). */
  w?: number;
  /** Node height as a fraction of container height (0-1). */
  h?: number;
  /** Primary font size in points. */
  primFontSz?: number;
  /** General spacing between elements as a fraction. */
  sp?: number;
  /** Sibling spacing as a fraction. */
  sibSp?: number;
  /** Secondary sibling spacing as a fraction. */
  secSibSp?: number;
  /** Begin padding as a fraction. */
  begPad?: number;
  /** End padding as a fraction. */
  endPad?: number;
  /** Direction: 'norm' (left-to-right) or 'rev' (right-to-left). */
  dir?: "norm" | "rev";
  /** Number of columns for snake/grid layouts. */
  cols?: number;
  /** Aspect ratio for nodes (width / height). */
  aspectRatio?: number;
}

/**
 * Parsed layout definition from `dgm:layoutDef` XML.
 */
export interface ParsedLayoutDef {
  /** Algorithm type extracted from the layout definition. */
  algorithmType: LayoutAlgorithmType;
  /** Constraints from `dgm:constrLst`. */
  constraints: LayoutConstraints;
  /** Raw rules from `dgm:ruleLst` (for future use). */
  rules: LayoutRule[];
  /** Layout direction parameter. */
  direction?: "norm" | "rev";
  /** Layout name from the definition. */
  name?: string;
}

/**
 * Algorithm types that can appear in `dgm:layoutDef`.
 */
export type LayoutAlgorithmType =
  | "snake"
  | "pyra"
  | "hierChild"
  | "hierRoot"
  | "cycle"
  | "lin"
  | "sp"
  | "tx"
  | "composite"
  | "conn"
  | "unknown";

/**
 * A rule from `dgm:ruleLst` (constraint overrides with conditions).
 */
export interface LayoutRule {
  type: string;
  for?: string;
  forName?: string;
  val?: number;
  fact?: number;
  max?: number;
  ptType?: string;
}

// ============================================================================
// Layout Definition Parser
// ============================================================================

/**
 * Parse a `dgm:layoutDef` XML object to extract algorithm type, constraints,
 * and rules.
 *
 * The XML object is expected to be the parsed output of
 * `ppt/diagrams/layout*.xml` from fast-xml-parser.
 *
 * @param layoutDefXml The root XML object of the layout definition.
 * @param xmlLookup Optional XML lookup service for namespace-aware traversal.
 * @returns Parsed layout definition, or undefined if parsing fails.
 */
export function parseLayoutDefinition(
  layoutDefXml: Record<string, unknown> | undefined,
  xmlLookup?: {
    getChildByLocalName: (
      obj: Record<string, unknown> | undefined,
      name: string,
    ) => Record<string, unknown> | undefined;
    getChildrenArrayByLocalName: (
      obj: Record<string, unknown> | undefined,
      name: string,
    ) => Record<string, unknown>[];
  },
): ParsedLayoutDef | undefined {
  if (!layoutDefXml) return undefined;

  const lookup = xmlLookup ?? createSimpleLookup();

  // Find the root layoutDef element
  const layoutDef =
    lookup.getChildByLocalName(layoutDefXml, "layoutDef") ?? layoutDefXml;

  const name = String(
    (layoutDef as Record<string, unknown>)["@_name"] ??
      (layoutDef as Record<string, unknown>)["@_uniqueId"] ??
      "",
  ).trim() || undefined;

  // Extract algorithm type from the layout node tree
  const algorithmType = extractAlgorithmType(layoutDef as Record<string, unknown>, lookup);

  // Extract constraints
  const constraints = extractConstraints(layoutDef as Record<string, unknown>, lookup);

  // Extract rules
  const rules = extractRules(layoutDef as Record<string, unknown>, lookup);

  // Extract direction
  const direction = extractDirection(layoutDef as Record<string, unknown>, lookup);
  if (direction) {
    constraints.dir = direction;
  }

  return {
    algorithmType,
    constraints,
    rules,
    direction,
    name,
  };
}

// ============================================================================
// Core Layout Algorithms
// ============================================================================

/**
 * Compute a snake/zigzag layout.
 *
 * Nodes are arranged in rows, flowing left-to-right on even rows and
 * right-to-left on odd rows (serpentine pattern).
 */
export function computeSnakeLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const cols = constraints.cols ?? Math.min(4, items.length);
  const rows = Math.ceil(items.length / cols);
  const sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
  const secSibSp = (constraints.secSibSp ?? 0.03) * bounds.height;
  const begPad = (constraints.begPad ?? 0.02) * bounds.width;
  const endPad = (constraints.endPad ?? 0.02) * bounds.width;

  const usableW = bounds.width - begPad - endPad;
  const usableH = bounds.height - begPad - endPad;
  const cellW = (usableW - sibSp * (cols - 1)) / cols;
  const cellH = (usableH - secSibSp * (rows - 1)) / rows;

  const nodeW = constraints.w ? constraints.w * bounds.width : cellW * 0.85;
  const nodeH = constraints.h ? constraints.h * bounds.height : cellH * 0.7;

  return items.map((node, i) => {
    const row = Math.floor(i / cols);
    const colInRow = i % cols;
    // Reverse direction on odd rows for serpentine effect
    const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;

    const cx = bounds.x + begPad + col * (cellW + sibSp) + cellW / 2;
    const cy = bounds.y + begPad + row * (cellH + secSibSp) + cellH / 2;

    return {
      nodeId: node.id,
      x: Math.round(cx - nodeW / 2),
      y: Math.round(cy - nodeH / 2),
      width: Math.round(nodeW),
      height: Math.round(nodeH),
    };
  });
}

/**
 * Compute a linear layout.
 *
 * Arranges nodes in a single line, either horizontally (default) or
 * vertically.
 */
export function computeLinearLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const isVertical = (constraints.aspectRatio ?? 1) < 0.5;
  const sibSp = constraints.sibSp ?? 0.03;
  const begPad = constraints.begPad ?? 0.02;
  const endPad = constraints.endPad ?? 0.02;

  if (isVertical) {
    const padTop = begPad * bounds.height;
    const padBot = endPad * bounds.height;
    const gap = sibSp * bounds.height;
    const usableH = bounds.height - padTop - padBot;
    const nodeH = (usableH - gap * (items.length - 1)) / items.length;
    const nodeW = constraints.w
      ? constraints.w * bounds.width
      : bounds.width * 0.8;
    const xOffset = bounds.x + (bounds.width - nodeW) / 2;

    return items.map((node, i) => ({
      nodeId: node.id,
      x: Math.round(xOffset),
      y: Math.round(bounds.y + padTop + i * (nodeH + gap)),
      width: Math.round(nodeW),
      height: Math.round(nodeH),
    }));
  }

  // Horizontal layout
  const padLeft = begPad * bounds.width;
  const padRight = endPad * bounds.width;
  const gap = sibSp * bounds.width;
  const usableW = bounds.width - padLeft - padRight;
  const nodeW = (usableW - gap * (items.length - 1)) / items.length;
  const nodeH = constraints.h
    ? constraints.h * bounds.height
    : bounds.height * 0.6;
  const yOffset = bounds.y + (bounds.height - nodeH) / 2;

  const shapes = items.map((node, i) => ({
    nodeId: node.id,
    x: Math.round(bounds.x + padLeft + i * (nodeW + gap)),
    y: Math.round(yOffset),
    width: Math.round(nodeW),
    height: Math.round(nodeH),
  }));

  // Reverse if direction is 'rev'
  if (constraints.dir === "rev") {
    shapes.reverse();
    const positions = shapes.map((s) => ({ x: s.x, y: s.y }));
    for (let i = 0; i < shapes.length; i++) {
      shapes[i].x = positions[shapes.length - 1 - i].x;
      shapes[i].y = positions[shapes.length - 1 - i].y;
    }
  }

  return shapes;
}

/**
 * Compute a hierarchy/tree layout.
 *
 * Positions nodes in a top-down tree arrangement using the parent-child
 * relationships defined on each node.
 */
export function computeHierarchyLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const roots = buildForest(nodes);
  if (roots.length === 0) {
    // Fall back to linear if no tree structure
    return computeLinearLayout(nodes, constraints, bounds);
  }

  const totalLeaves = roots.reduce((s, r) => s + treeWidth(r), 0);
  const depth = Math.max(...roots.map(treeDepth));

  const begPad = (constraints.begPad ?? 0.02) * bounds.width;
  const sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
  const secSibSp = (constraints.secSibSp ?? 0.03) * bounds.height;

  const usableW = bounds.width - begPad * 2;
  const usableH = bounds.height - begPad * 2;
  const cellW = usableW / Math.max(totalLeaves, 1);
  const cellH = usableH / Math.max(depth, 1);

  const nodeW = constraints.w
    ? constraints.w * bounds.width
    : Math.min(cellW * 0.8, 140);
  const nodeH = constraints.h
    ? constraints.h * bounds.height
    : Math.min(cellH * 0.35, 50);

  const shapes: LayoutEngineShape[] = [];

  function walk(t: TreeNode, xOffset: number, level: number): number {
    const w = treeWidth(t);
    const cx = bounds.x + begPad + (xOffset + w / 2) * cellW;
    const cy = bounds.y + begPad + level * cellH + cellH / 2;

    shapes.push({
      nodeId: t.node.id,
      x: Math.round(cx - nodeW / 2),
      y: Math.round(cy - nodeH / 2),
      width: Math.round(nodeW),
      height: Math.round(nodeH),
    });

    let childOffset = xOffset;
    for (const child of t.children) {
      walk(child, childOffset, level + 1);
      childOffset += treeWidth(child);
    }
    return w;
  }

  let offset = 0;
  for (const root of roots) {
    offset += walk(root, offset, 0);
  }

  return shapes;
}

/**
 * Compute a cycle/radial layout.
 *
 * Arranges nodes in a circle around a central point.
 */
export function computeCycleLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const size = Math.min(bounds.width, bounds.height);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const radius = size * 0.32;

  const nodeW = constraints.w
    ? constraints.w * bounds.width
    : Math.max(size * 0.18, Math.min(size * 0.28, 300 / items.length));
  const nodeH = constraints.h
    ? constraints.h * bounds.height
    : nodeW * 0.6;

  return items.map((node, i) => {
    const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + radius * Math.cos(angle) - nodeW / 2;
    const ny = cy + radius * Math.sin(angle) - nodeH / 2;

    return {
      nodeId: node.id,
      x: Math.round(nx),
      y: Math.round(ny),
      width: Math.round(nodeW),
      height: Math.round(nodeH),
    };
  });
}

/**
 * Compute a pyramid layout.
 *
 * Nodes are stacked vertically from narrow (top) to wide (bottom),
 * forming a pyramid shape.
 */
export function computePyramidLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const begPad = (constraints.begPad ?? 0.02) * bounds.height;
  const sibSp = (constraints.sibSp ?? 0.01) * bounds.height;
  const usableH = bounds.height - begPad * 2;
  const bandH = (usableH - sibSp * (items.length - 1)) / items.length;
  const maxW = bounds.width - begPad * 2;

  return items.map((node, i) => {
    // Top band is narrowest, bottom is widest
    const widthFraction = 0.3 + (i / Math.max(items.length - 1, 1)) * 0.7;
    const w = maxW * widthFraction;
    const x = bounds.x + (bounds.width - w) / 2;
    const y = bounds.y + begPad + i * (bandH + sibSp);

    return {
      nodeId: node.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(bandH),
    };
  });
}

/**
 * Compute a matrix/grid layout.
 *
 * Arranges nodes in an NxN (or NxM) grid pattern.
 */
export function computeMatrixLayout(
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  const items = getContentNodes(nodes);
  if (items.length === 0) return [];

  const cols = constraints.cols ?? Math.ceil(Math.sqrt(items.length));
  const rows = Math.ceil(items.length / cols);
  const begPad = (constraints.begPad ?? 0.02) * Math.min(bounds.width, bounds.height);
  const sibSp = (constraints.sibSp ?? 0.02) * bounds.width;
  const secSibSp = (constraints.secSibSp ?? 0.02) * bounds.height;

  const usableW = bounds.width - begPad * 2;
  const usableH = bounds.height - begPad * 2;
  const cellW = (usableW - sibSp * (cols - 1)) / cols;
  const cellH = (usableH - secSibSp * (rows - 1)) / rows;

  return items.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    return {
      nodeId: node.id,
      x: Math.round(bounds.x + begPad + col * (cellW + sibSp)),
      y: Math.round(bounds.y + begPad + row * (cellH + secSibSp)),
      width: Math.round(cellW),
      height: Math.round(cellH),
    };
  });
}

// ============================================================================
// High-Level Engine Entry Point
// ============================================================================

/**
 * Compute layout positions for all nodes in a SmartArt data model.
 *
 * This is the main entry point for the layout engine.  It selects the
 * appropriate algorithm based on the layout type (from parsed layout
 * definition or resolved SmartArt data) and produces positioned shapes.
 *
 * @param data SmartArt data model (nodes + connections + layout type).
 * @param bounds Container bounding box on the slide.
 * @param layoutDef Optional parsed layout definition for constraint-driven layout.
 * @returns Array of positioned shapes, or undefined if layout cannot be computed.
 */
export function computeSmartArtLayout(
  data: PptxSmartArtData,
  bounds: ContainerBounds,
  layoutDef?: ParsedLayoutDef,
): LayoutEngineShape[] | undefined {
  const nodes = data.nodes;
  if (!nodes || nodes.length === 0) return undefined;

  const contentNodes = getContentNodes(nodes);
  if (contentNodes.length === 0) return undefined;

  const constraints = layoutDef?.constraints ?? {};

  // Determine the layout algorithm to use.
  // Priority: parsed layout definition > resolved layout type > raw layout type > heuristic
  const algorithmType = layoutDef?.algorithmType;
  const resolvedType = data.resolvedLayoutType;

  // Map algorithm type to layout function
  if (algorithmType && algorithmType !== "unknown") {
    return computeByAlgorithmType(algorithmType, nodes, constraints, bounds);
  }

  if (resolvedType) {
    return computeByLayoutType(resolvedType, nodes, constraints, bounds);
  }

  // Fall back to heuristic based on raw layoutType string
  const layoutType = resolveLayoutTypeFromString(data.layoutType);
  return computeByLayoutType(layoutType, nodes, constraints, bounds);
}

/**
 * Convert layout engine shapes to `PptxSmartArtDrawingShape[]` for integration
 * with the existing SmartArt rendering pipeline.
 *
 * This bridges the layout engine output with the existing decompose/render
 * path that expects `PptxSmartArtDrawingShape` objects.
 */
export function layoutEngineShapesToDrawingShapes(
  engineShapes: LayoutEngineShape[],
  nodes: PptxSmartArtNode[],
  layoutType: SmartArtLayoutType,
): PptxSmartArtDrawingShape[] {
  const nodeMap = new Map<string, PptxSmartArtNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  return engineShapes.map((shape) => {
    const node = nodeMap.get(shape.nodeId);
    const shapeType = getDefaultShapeType(layoutType);

    return {
      id: `engine-${shape.nodeId}`,
      shapeType,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      text: node?.text,
    };
  });
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Map a parsed algorithm type to a layout function.
 */
function computeByAlgorithmType(
  algorithmType: LayoutAlgorithmType,
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  switch (algorithmType) {
    case "snake":
      return computeSnakeLayout(nodes, constraints, bounds);
    case "lin":
      return computeLinearLayout(nodes, constraints, bounds);
    case "hierChild":
    case "hierRoot":
      return computeHierarchyLayout(nodes, constraints, bounds);
    case "cycle":
      return computeCycleLayout(nodes, constraints, bounds);
    case "pyra":
      return computePyramidLayout(nodes, constraints, bounds);
    case "tx":
    case "sp":
      // Text and space algorithms default to linear layout
      return computeLinearLayout(nodes, constraints, bounds);
    case "composite":
    case "conn":
      // Composite and connector algorithms default to linear
      return computeLinearLayout(nodes, constraints, bounds);
    default:
      return computeLinearLayout(nodes, constraints, bounds);
  }
}

/**
 * Map a SmartArtLayoutType to a layout function.
 */
function computeByLayoutType(
  layoutType: SmartArtLayoutType,
  nodes: PptxSmartArtNode[],
  constraints: LayoutConstraints,
  bounds: ContainerBounds,
): LayoutEngineShape[] {
  switch (layoutType) {
    case "list":
      return computeLinearLayout(
        nodes,
        { ...constraints, aspectRatio: 0.3 },
        bounds,
      );
    case "process":
    case "chevron":
      return computeLinearLayout(nodes, constraints, bounds);
    case "cycle":
      return computeCycleLayout(nodes, constraints, bounds);
    case "hierarchy":
      return computeHierarchyLayout(nodes, constraints, bounds);
    case "relationship":
    case "venn":
      return computeCycleLayout(nodes, constraints, bounds);
    case "matrix":
      return computeMatrixLayout(nodes, constraints, bounds);
    case "pyramid":
    case "funnel":
      return computePyramidLayout(nodes, constraints, bounds);
    case "bending":
      return computeSnakeLayout(nodes, constraints, bounds);
    case "timeline":
      return computeLinearLayout(nodes, constraints, bounds);
    case "target":
      return computeCycleLayout(nodes, constraints, bounds);
    case "gear":
      return computeCycleLayout(
        nodes,
        { ...constraints, w: 0.2 },
        bounds,
      );
    default:
      return computeLinearLayout(nodes, constraints, bounds);
  }
}

/**
 * Resolve a raw layout type string to a SmartArtLayoutType.
 */
function resolveLayoutTypeFromString(
  layoutType: string | undefined,
): SmartArtLayoutType {
  if (!layoutType) return "list";
  const lower = layoutType.toLowerCase();

  if (lower.includes("hierarchy") || lower.includes("org")) return "hierarchy";
  if (lower.includes("cycle") || lower.includes("radial")) return "cycle";
  if (lower.includes("snake") || lower.includes("bending") || lower.includes("zigzag"))
    return "bending";
  if (lower.includes("process") || lower.includes("chevron") || lower.includes("arrow"))
    return "process";
  if (lower.includes("venn")) return "relationship";
  if (lower.includes("matrix")) return "matrix";
  if (lower.includes("pyramid")) return "pyramid";
  if (lower.includes("funnel")) return "funnel";
  if (lower.includes("timeline")) return "timeline";
  if (lower.includes("target") || lower.includes("bullseye")) return "target";
  if (lower.includes("gear")) return "gear";
  if (lower.includes("list") || lower.includes("block")) return "list";
  if (lower.includes("relationship")) return "relationship";

  return "list";
}

/**
 * Get the default shape type for a layout category.
 */
function getDefaultShapeType(layoutType: SmartArtLayoutType): string {
  switch (layoutType) {
    case "cycle":
    case "target":
    case "gear":
    case "relationship":
    case "venn":
      return "ellipse";
    case "chevron":
      return "chevron";
    case "pyramid":
    case "funnel":
      return "rect";
    default:
      return "roundRect";
  }
}

// ============================================================================
// Layout Definition XML Parsing Helpers
// ============================================================================

/**
 * Create a simple XML lookup service that handles namespace-prefixed tags.
 */
function createSimpleLookup() {
  return {
    getChildByLocalName(
      obj: Record<string, unknown> | undefined,
      name: string,
    ): Record<string, unknown> | undefined {
      if (!obj || typeof obj !== "object") return undefined;
      for (const [key, value] of Object.entries(obj)) {
        const localName = key.includes(":") ? key.split(":").pop()! : key;
        if (localName === name && value && typeof value === "object" && !Array.isArray(value)) {
          return value as Record<string, unknown>;
        }
      }
      return undefined;
    },
    getChildrenArrayByLocalName(
      obj: Record<string, unknown> | undefined,
      name: string,
    ): Record<string, unknown>[] {
      if (!obj || typeof obj !== "object") return [];
      for (const [key, value] of Object.entries(obj)) {
        const localName = key.includes(":") ? key.split(":").pop()! : key;
        if (localName === name) {
          if (Array.isArray(value)) {
            return value.filter(
              (v): v is Record<string, unknown> =>
                v !== null && typeof v === "object",
            );
          }
          if (value && typeof value === "object") {
            return [value as Record<string, unknown>];
          }
        }
      }
      return [];
    },
  };
}

/**
 * Extract the algorithm type from a layout definition XML.
 *
 * Searches recursively through `dgm:layoutNode` and `dgm:alg` elements
 * to find the primary layout algorithm type.  When multiple algorithms
 * are present (e.g. a `tx` algorithm at the top with a `lin` or `snake`
 * algorithm in a nested node), the engine prefers the "structural"
 * algorithm (snake, lin, cycle, pyra, hierChild, hierRoot, composite)
 * over auxiliary ones (tx, sp, conn).
 */
function extractAlgorithmType(
  layoutDef: Record<string, unknown>,
  lookup: ReturnType<typeof createSimpleLookup>,
): LayoutAlgorithmType {
  // Collect all algorithm types found at every level, then pick the best.
  const found: LayoutAlgorithmType[] = [];

  // Look for alg element directly under layoutDef
  const alg = lookup.getChildByLocalName(layoutDef, "alg");
  if (alg) {
    const type = String((alg as Record<string, unknown>)["@_type"] ?? "").trim();
    found.push(mapAlgorithmTypeString(type));
  }

  // Search within layoutNode (and nested layoutNodes)
  const layoutNode = lookup.getChildByLocalName(layoutDef, "layoutNode");
  if (layoutNode) {
    collectAlgorithms(layoutNode, lookup, found);
  }

  if (found.length === 0) return "unknown";

  // Prefer structural algorithms over auxiliary ones
  const structural = found.find(
    (a) => a !== "tx" && a !== "sp" && a !== "conn" && a !== "unknown",
  );
  return structural ?? found[0];
}

/**
 * Recursively collect algorithm types from a layoutNode and its children.
 */
function collectAlgorithms(
  layoutNode: Record<string, unknown>,
  lookup: ReturnType<typeof createSimpleLookup>,
  results: LayoutAlgorithmType[],
): void {
  const alg = lookup.getChildByLocalName(layoutNode, "alg");
  if (alg) {
    const type = String((alg as Record<string, unknown>)["@_type"] ?? "").trim();
    results.push(mapAlgorithmTypeString(type));
  }

  const children = lookup.getChildrenArrayByLocalName(layoutNode, "layoutNode");
  for (const child of children) {
    collectAlgorithms(child, lookup, results);
  }
}

/**
 * Map an algorithm type string from XML to our enum.
 */
function mapAlgorithmTypeString(type: string): LayoutAlgorithmType {
  switch (type.toLowerCase()) {
    case "snake":
      return "snake";
    case "pyra":
      return "pyra";
    case "hierchild":
      return "hierChild";
    case "hierroot":
      return "hierRoot";
    case "cycle":
      return "cycle";
    case "lin":
      return "lin";
    case "sp":
      return "sp";
    case "tx":
      return "tx";
    case "composite":
      return "composite";
    case "conn":
      return "conn";
    default:
      return "unknown";
  }
}

/**
 * Extract constraints from `dgm:constrLst` in the layout definition.
 */
function extractConstraints(
  layoutDef: Record<string, unknown>,
  lookup: ReturnType<typeof createSimpleLookup>,
): LayoutConstraints {
  const constraints: LayoutConstraints = {};

  // Search for constrLst at multiple levels
  const constrLst =
    lookup.getChildByLocalName(layoutDef, "constrLst") ??
    (() => {
      const layoutNode = lookup.getChildByLocalName(layoutDef, "layoutNode");
      return layoutNode
        ? lookup.getChildByLocalName(layoutNode, "constrLst")
        : undefined;
    })();

  if (!constrLst) return constraints;

  const constrArray = lookup.getChildrenArrayByLocalName(constrLst, "constr");
  for (const constr of constrArray) {
    const type = String((constr as Record<string, unknown>)["@_type"] ?? "").trim();
    const valStr = String((constr as Record<string, unknown>)["@_val"] ?? "").trim();
    const val = parseFloat(valStr);

    if (!type || isNaN(val)) continue;

    switch (type.toLowerCase()) {
      case "w":
        constraints.w = val;
        break;
      case "h":
        constraints.h = val;
        break;
      case "primfontsz":
        constraints.primFontSz = val;
        break;
      case "sp":
        constraints.sp = val;
        break;
      case "sibsp":
        constraints.sibSp = val;
        break;
      case "secsibsp":
        constraints.secSibSp = val;
        break;
      case "begpad":
        constraints.begPad = val;
        break;
      case "endpad":
        constraints.endPad = val;
        break;
    }
  }

  return constraints;
}

/**
 * Extract rules from `dgm:ruleLst`.
 */
function extractRules(
  layoutDef: Record<string, unknown>,
  lookup: ReturnType<typeof createSimpleLookup>,
): LayoutRule[] {
  const rules: LayoutRule[] = [];

  const ruleLst =
    lookup.getChildByLocalName(layoutDef, "ruleLst") ??
    (() => {
      const layoutNode = lookup.getChildByLocalName(layoutDef, "layoutNode");
      return layoutNode
        ? lookup.getChildByLocalName(layoutNode, "ruleLst")
        : undefined;
    })();

  if (!ruleLst) return rules;

  const ruleArray = lookup.getChildrenArrayByLocalName(ruleLst, "rule");
  for (const rule of ruleArray) {
    const type = String((rule as Record<string, unknown>)["@_type"] ?? "").trim();
    if (!type) continue;

    const parsed: LayoutRule = { type };

    const forAttr = String((rule as Record<string, unknown>)["@_for"] ?? "").trim();
    if (forAttr) parsed.for = forAttr;

    const forName = String((rule as Record<string, unknown>)["@_forName"] ?? "").trim();
    if (forName) parsed.forName = forName;

    const valStr = String((rule as Record<string, unknown>)["@_val"] ?? "").trim();
    const val = parseFloat(valStr);
    if (!isNaN(val)) parsed.val = val;

    const factStr = String((rule as Record<string, unknown>)["@_fact"] ?? "").trim();
    const fact = parseFloat(factStr);
    if (!isNaN(fact)) parsed.fact = fact;

    const maxStr = String((rule as Record<string, unknown>)["@_max"] ?? "").trim();
    const max = parseFloat(maxStr);
    if (!isNaN(max)) parsed.max = max;

    const ptType = String((rule as Record<string, unknown>)["@_ptType"] ?? "").trim();
    if (ptType) parsed.ptType = ptType;

    rules.push(parsed);
  }

  return rules;
}

/**
 * Extract layout direction from algorithm parameters.
 */
function extractDirection(
  layoutDef: Record<string, unknown>,
  lookup: ReturnType<typeof createSimpleLookup>,
): "norm" | "rev" | undefined {
  // Look for alg with param children
  const searchAlg = (parent: Record<string, unknown>): "norm" | "rev" | undefined => {
    const alg = lookup.getChildByLocalName(parent, "alg");
    if (alg) {
      const params = lookup.getChildrenArrayByLocalName(alg, "param");
      for (const param of params) {
        const type = String((param as Record<string, unknown>)["@_type"] ?? "").trim();
        const val = String((param as Record<string, unknown>)["@_val"] ?? "").trim();
        if (type === "linDir" || type === "flowDir") {
          if (val === "fromR" || val === "fromB") return "rev";
          return "norm";
        }
      }
    }
    return undefined;
  };

  const direct = searchAlg(layoutDef);
  if (direct) return direct;

  const layoutNode = lookup.getChildByLocalName(layoutDef, "layoutNode");
  if (layoutNode) {
    return searchAlg(layoutNode);
  }

  return undefined;
}
