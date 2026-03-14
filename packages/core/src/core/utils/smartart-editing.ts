/**
 * SmartArt editing utilities.
 *
 * Provides add/remove/reorder operations on SmartArt data-model nodes
 * with automatic reflow of the in-memory diagram structure.
 *
 * All mutation functions return a new `PptxSmartArtData` object (immutable)
 * and clear `drawingShapes` so that the renderer falls back to the
 * algorithmic layout engine, which automatically reflows positions.
 */

import type {
  PptxSmartArtData,
  PptxSmartArtNode,
  PptxSmartArtDrawingShape,
  SmartArtLayoutType,
} from "../types";
import type { ContainerBounds } from "./smartart-helpers";
import { buildForest, treeWidth, treeDepth, getContentNodes } from "./smartart-helpers";

// ── ID generation ────────────────────────────────────────────────────────

let editNodeCounter = 0;

/** Generate a unique model ID for a new SmartArt node. */
function nextModelId(): string {
  return `smartart-node-${Date.now()}-${++editNodeCounter}`;
}

/** Reset the edit counter (useful in tests). */
export function resetSmartArtEditCounter(): void {
  editNodeCounter = 0;
}

// ── Node operations ──────────────────────────────────────────────────────

/**
 * Add a new node to a SmartArt diagram after a given sibling.
 * If `afterNodeId` is undefined, the node is appended at the end.
 *
 * Returns a new PptxSmartArtData with the node inserted and
 * connections / drawing shapes cleared (to trigger layout reflow).
 */
export function addSmartArtNode(
  data: PptxSmartArtData,
  text: string,
  afterNodeId?: string,
): PptxSmartArtData {
  const newId = nextModelId();

  // Determine parent from the sibling node
  let parentId: string | undefined;
  if (afterNodeId) {
    const sibling = data.nodes.find((n) => n.id === afterNodeId);
    parentId = sibling?.parentId;
  }

  const newNode: PptxSmartArtNode = {
    id: newId,
    text,
    parentId,
  };

  // Insert after the specified sibling, or at the end
  const nodes = [...data.nodes];
  if (afterNodeId) {
    const siblingIndex = nodes.findIndex((n) => n.id === afterNodeId);
    if (siblingIndex >= 0) {
      nodes.splice(siblingIndex + 1, 0, newNode);
    } else {
      nodes.push(newNode);
    }
  } else {
    nodes.push(newNode);
  }

  // Add a connection from parent to the new node
  const connections = [...(data.connections ?? [])];
  if (parentId) {
    const maxSrcOrd = connections
      .filter((c) => c.sourceId === parentId)
      .reduce((max, c) => Math.max(max, c.srcOrd ?? 0), -1);

    connections.push({
      sourceId: parentId,
      destId: newId,
      type: "parOf",
      srcOrd: maxSrcOrd + 1,
      destOrd: 0,
    });
  }

  return {
    ...data,
    nodes,
    connections: connections.length > 0 ? connections : undefined,
    // Clear pre-computed shapes to force layout reflow
    drawingShapes: undefined,
  };
}

/**
 * Remove a node from a SmartArt diagram by ID.
 * Also removes any connections referencing the node and
 * clears drawing shapes to trigger layout reflow.
 */
export function removeSmartArtNode(
  data: PptxSmartArtData,
  nodeId: string,
): PptxSmartArtData {
  const removedNode = data.nodes.find((n) => n.id === nodeId);

  // Identify children of the removed node BEFORE mutating any objects
  const childIds = data.nodes
    .filter((n) => n.parentId === nodeId)
    .map((n) => n.id);

  // Clone remaining nodes and re-parent children of the removed node
  const nodes = data.nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => {
      if (n.parentId === nodeId) {
        // Re-parent to the removed node's parent, or promote to root
        return { ...n, parentId: removedNode?.parentId };
      }
      return { ...n };
    });

  // Remove connections referencing the deleted node and re-wire children
  const connections = (data.connections ?? [])
    .filter((c) => c.sourceId !== nodeId && c.destId !== nodeId)
    .map((c) => ({ ...c }));

  // Add connections from the removed node's parent to its children
  if (removedNode?.parentId && childIds.length > 0) {
    for (const childId of childIds) {
      const maxSrcOrd = connections
        .filter((c) => c.sourceId === removedNode.parentId)
        .reduce((max, c) => Math.max(max, c.srcOrd ?? 0), -1);
      connections.push({
        sourceId: removedNode.parentId,
        destId: childId,
        type: "parOf",
        srcOrd: maxSrcOrd + 1,
        destOrd: 0,
      });
    }
  }

  return {
    ...data,
    nodes,
    connections: connections.length > 0 ? connections : undefined,
    drawingShapes: undefined,
  };
}

/**
 * Update the text of a SmartArt node by ID.
 * Clears drawing shapes to trigger layout reflow.
 */
export function updateSmartArtNodeText(
  data: PptxSmartArtData,
  nodeId: string,
  newText: string,
): PptxSmartArtData {
  const nodes = data.nodes.map((n) =>
    n.id === nodeId ? { ...n, text: newText } : n,
  );

  return {
    ...data,
    nodes,
    drawingShapes: undefined,
  };
}

/**
 * Move a node to a different position within its sibling group.
 * `direction` of 1 moves the node down/right, -1 moves it up/left.
 */
export function reorderSmartArtNode(
  data: PptxSmartArtData,
  nodeId: string,
  direction: 1 | -1,
): PptxSmartArtData {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return data;

  // Find siblings (nodes with the same parentId)
  const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
  const currentIndex = siblings.findIndex((n) => n.id === nodeId);
  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= siblings.length) return data;

  // Swap in the full node list
  const nodes = [...data.nodes];
  const currentGlobalIndex = nodes.findIndex(
    (n) => n.id === siblings[currentIndex].id,
  );
  const targetGlobalIndex = nodes.findIndex(
    (n) => n.id === siblings[targetIndex].id,
  );

  if (currentGlobalIndex >= 0 && targetGlobalIndex >= 0) {
    const temp = nodes[currentGlobalIndex];
    nodes[currentGlobalIndex] = nodes[targetGlobalIndex];
    nodes[targetGlobalIndex] = temp;
  }

  return {
    ...data,
    nodes,
    drawingShapes: undefined,
  };
}

/**
 * Promote a child node to be a sibling of its parent.
 */
export function promoteSmartArtNode(
  data: PptxSmartArtData,
  nodeId: string,
): PptxSmartArtData {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node || !node.parentId) return data;

  const parent = data.nodes.find((n) => n.id === node.parentId);
  if (!parent) return data;

  const nodes = data.nodes.map((n) =>
    n.id === nodeId ? { ...n, parentId: parent.parentId } : n,
  );

  // Update connections
  const connections = (data.connections ?? [])
    .filter((c) => !(c.sourceId === node.parentId && c.destId === nodeId))
    .map((c) => ({ ...c }));

  if (parent.parentId) {
    connections.push({
      sourceId: parent.parentId,
      destId: nodeId,
      type: "parOf",
      srcOrd: 0,
      destOrd: 0,
    });
  }

  return {
    ...data,
    nodes,
    connections: connections.length > 0 ? connections : undefined,
    drawingShapes: undefined,
  };
}

/**
 * Demote a node to become a child of its preceding sibling.
 */
export function demoteSmartArtNode(
  data: PptxSmartArtData,
  nodeId: string,
): PptxSmartArtData {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return data;

  // Find the preceding sibling
  const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
  const currentIndex = siblings.findIndex((n) => n.id === nodeId);
  if (currentIndex <= 0) return data; // Can't demote the first sibling

  const newParentId = siblings[currentIndex - 1].id;

  const nodes = data.nodes.map((n) =>
    n.id === nodeId ? { ...n, parentId: newParentId } : n,
  );

  // Update connections
  const connections = (data.connections ?? [])
    .filter((c) => !(c.sourceId === node.parentId && c.destId === nodeId))
    .map((c) => ({ ...c }));

  connections.push({
    sourceId: newParentId,
    destId: nodeId,
    type: "parOf",
    srcOrd: 0,
    destOrd: 0,
  });

  return {
    ...data,
    nodes,
    connections: connections.length > 0 ? connections : undefined,
    drawingShapes: undefined,
  };
}

// ── Alternative signatures requested by task spec ───────────────────────

/**
 * Add a new node as a child of a given parent.
 *
 * If `parentId` is undefined, the node is added as a root-level item.
 * If `text` is undefined, a default label is generated.
 *
 * Returns a new PptxSmartArtData with the node inserted and
 * drawing shapes cleared (to trigger layout reflow).
 */
export function addSmartArtNodeAsChild(
  data: PptxSmartArtData,
  parentId?: string,
  text?: string,
): PptxSmartArtData {
  const newId = nextModelId();
  const label = text ?? `Item ${data.nodes.length + 1}`;

  const newNode: PptxSmartArtNode = {
    id: newId,
    text: label,
    parentId,
  };

  const nodes = [...data.nodes, newNode];

  // Add a connection from parent to the new node
  const connections = [...(data.connections ?? [])];
  if (parentId) {
    const maxSrcOrd = connections
      .filter((c) => c.sourceId === parentId)
      .reduce((max, c) => Math.max(max, c.srcOrd ?? 0), -1);

    connections.push({
      sourceId: parentId,
      destId: newId,
      type: "parOf",
      srcOrd: maxSrcOrd + 1,
      destOrd: 0,
    });
  }

  return {
    ...data,
    nodes,
    connections: connections.length > 0 ? connections : undefined,
    drawingShapes: undefined,
  };
}

/**
 * Move a node to a specific index within its sibling group.
 *
 * Siblings are all nodes sharing the same `parentId`.
 * The node is removed from its current position among siblings and
 * re-inserted at `newIndex` (clamped to valid range).
 */
export function reorderSmartArtNodeToIndex(
  data: PptxSmartArtData,
  nodeId: string,
  newIndex: number,
): PptxSmartArtData {
  const node = data.nodes.find((n) => n.id === nodeId);
  if (!node) return data;

  // Collect siblings in their original order
  const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
  const currentIndex = siblings.findIndex((n) => n.id === nodeId);
  if (currentIndex < 0) return data;

  // Clamp the target index
  const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length - 1));
  if (clampedIndex === currentIndex) return data;

  // Reorder siblings
  const reorderedSiblings = [...siblings];
  const [moved] = reorderedSiblings.splice(currentIndex, 1);
  reorderedSiblings.splice(clampedIndex, 0, moved);

  // Rebuild the full node list preserving non-sibling positions
  const siblingIds = new Set(siblings.map((s) => s.id));
  const nodes: PptxSmartArtNode[] = [];
  let sibIdx = 0;
  for (const n of data.nodes) {
    if (siblingIds.has(n.id)) {
      nodes.push(reorderedSiblings[sibIdx++]);
    } else {
      nodes.push(n);
    }
  }

  return {
    ...data,
    nodes,
    drawingShapes: undefined,
  };
}

// ── Layout reflow engine ────────────────────────────────────────────────

/**
 * Position data for a single node produced by the reflow engine.
 */
export interface ReflowedNodePosition {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recalculate positions for all SmartArt nodes based on the current
 * layout type and node structure.
 *
 * This function computes visually reasonable positions for the 5 most
 * common layout types. It does not aim for pixel-perfect PowerPoint
 * fidelity, but produces clean, well-spaced layouts.
 *
 * Returns an array of `PptxSmartArtDrawingShape` entries that can be
 * set on `data.drawingShapes` to update the visual layout, or returns
 * `undefined` if the layout type is not supported for reflow.
 */
export function reflowSmartArtLayout(
  data: PptxSmartArtData,
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] | undefined {
  const nodes = getContentNodes(data.nodes);
  if (nodes.length === 0) return undefined;

  const layoutType: SmartArtLayoutType =
    data.resolvedLayoutType ?? resolveLayoutCategory(data.layoutType);

  switch (layoutType) {
    case "list":
      return reflowList(nodes, bounds);
    case "process":
      return reflowProcess(nodes, bounds);
    case "hierarchy":
      return reflowHierarchy(data.nodes, bounds);
    case "cycle":
      return reflowCycle(nodes, bounds);
    case "matrix":
      return reflowMatrix(nodes, bounds);
    case "pyramid":
      return reflowPyramid(nodes, bounds);
    case "funnel":
      return reflowFunnel(nodes, bounds);
    case "target":
      return reflowTarget(nodes, bounds);
    case "gear":
      return reflowGear(nodes, bounds);
    case "venn":
      return reflowVenn(nodes, bounds);
    case "timeline":
      return reflowTimeline(nodes, bounds);
    case "relationship":
      return reflowRelationship(nodes, bounds);
    case "chevron":
      return reflowChevron(nodes, bounds);
    case "bending":
      return reflowBending(nodes, bounds);
    default:
      // For unknown layout types, fall back to list
      return reflowList(nodes, bounds);
  }
}

// ── Reflow implementations ──────────────────────────────────────────────

/**
 * List layout reflow: distribute nodes vertically with equal spacing.
 */
function reflowList(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 8;
  const gap = 6;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;

  return nodes.map((node, i) => ({
    id: `reflow-list-${node.id}`,
    shapeType: "roundRect",
    x: bounds.x + padding,
    y: bounds.y + padding + i * (itemH + gap),
    width: usableW,
    height: itemH,
    text: node.text,
    fontSize: Math.max(8, Math.min(11, itemH * 0.4)),
  }));
}

/**
 * Process layout reflow: distribute nodes horizontally with connectors.
 */
function reflowProcess(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 8;
  const arrowGap = 16;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const nodeW = (usableW - arrowGap * (nodes.length - 1)) / nodes.length;
  const nodeH = usableH * 0.6;
  const yOffset = bounds.y + padding + (usableH - nodeH) / 2;

  const shapes: PptxSmartArtDrawingShape[] = [];

  nodes.forEach((node, i) => {
    const x = bounds.x + padding + i * (nodeW + arrowGap);

    shapes.push({
      id: `reflow-proc-${node.id}`,
      shapeType: "roundRect",
      x,
      y: yOffset,
      width: nodeW,
      height: nodeH,
      text: node.text,
      fontSize: Math.max(8, Math.min(11, nodeW * 0.12)),
    });

    // Arrow connector between nodes (represented as a small triangle shape)
    if (i < nodes.length - 1) {
      const arrowX = x + nodeW;
      const arrowY = yOffset + nodeH / 2 - 6;
      shapes.push({
        id: `reflow-proc-arrow-${node.id}`,
        shapeType: "rightArrow",
        x: arrowX,
        y: arrowY,
        width: arrowGap,
        height: 12,
        fillColor: "#94a3b8",
      });
    }
  });

  return shapes;
}

/**
 * Hierarchy layout reflow: recalculate tree positions.
 */
function reflowHierarchy(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const roots = buildForest(nodes);
  if (roots.length === 0) {
    // Fall back to list if no tree structure
    return reflowList(getContentNodes(nodes), bounds);
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

  const shapes: PptxSmartArtDrawingShape[] = [];

  function walkTree(
    t: { node: PptxSmartArtNode; children: typeof roots },
    xOffset: number,
    level: number,
  ): number {
    const w = treeWidth(t);
    const cx = bounds.x + padding + (xOffset + w / 2) * cellW;
    const cy = bounds.y + padding + level * cellH + cellH / 2;

    shapes.push({
      id: `reflow-hier-${t.node.id}`,
      shapeType: "roundRect",
      x: cx - boxW / 2,
      y: cy - boxH / 2,
      width: boxW,
      height: boxH,
      text: t.node.text,
      fontSize: Math.max(7, Math.min(10, boxW / 14)),
    });

    let childOffset = xOffset;
    for (const child of t.children) {
      walkTree(child, childOffset, level + 1);
      childOffset += treeWidth(child);
    }
    return w;
  }

  let offset = 0;
  for (const root of roots) {
    offset += walkTree(root, offset, 0);
  }

  return shapes;
}

/**
 * Cycle layout reflow: distribute nodes around a circle.
 */
function reflowCycle(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const size = Math.min(bounds.width, bounds.height);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const radius = size * 0.32;
  const nodeW = Math.max(
    size * 0.18,
    Math.min(size * 0.28, 300 / nodes.length),
  );
  const nodeH = nodeW * 0.6;

  return nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + radius * Math.cos(angle) - nodeW / 2;
    const ny = cy + radius * Math.sin(angle) - nodeH / 2;

    return {
      id: `reflow-cycle-${node.id}`,
      shapeType: "ellipse",
      x: nx,
      y: ny,
      width: nodeW,
      height: nodeH,
      text: node.text,
      fontSize: Math.max(7, Math.min(10, nodeW * 0.1)),
    };
  });
}

/**
 * Matrix layout reflow: place nodes in a grid pattern.
 */
function reflowMatrix(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  const padding = 8;
  const gap = 6;
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const cellW = (usableW - gap * (cols - 1)) / cols;
  const cellH = (usableH - gap * (rows - 1)) / rows;

  return nodes.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    return {
      id: `reflow-matrix-${node.id}`,
      shapeType: "roundRect",
      x: bounds.x + padding + col * (cellW + gap),
      y: bounds.y + padding + row * (cellH + gap),
      width: cellW,
      height: cellH,
      text: node.text,
      fontSize: Math.max(8, Math.min(11, Math.min(cellW, cellH) * 0.12)),
    };
  });
}

/**
 * Pyramid layout reflow: stacked bands from narrow (top) to wide (bottom).
 */
function reflowPyramid(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const maxW = bounds.width - padding * 2;

  return nodes.map((node, i) => {
    // Top band is narrowest, bottom is widest
    const widthFraction = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
    const w = maxW * widthFraction;
    const x = bounds.x + (bounds.width - w) / 2;
    const y = bounds.y + padding + i * (bandH + gap);

    return {
      id: `reflow-pyramid-${node.id}`,
      shapeType: "rect",
      x,
      y,
      width: w,
      height: bandH,
      text: node.text,
      fontSize: Math.max(8, Math.min(11, bandH * 0.4)),
    };
  });
}

/**
 * Funnel layout reflow: nodes stacked vertically with decreasing width
 * (widest at top, narrowest at bottom).
 */
function reflowFunnel(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 8;
  const gap = 4;
  const usableH = bounds.height - padding * 2;
  const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const maxW = bounds.width - padding * 2;

  return nodes.map((node, i) => {
    // Top band is widest, bottom is narrowest (inverse of pyramid)
    const widthFraction =
      1.0 - (i / Math.max(nodes.length - 1, 1)) * 0.7;
    const w = maxW * widthFraction;
    const x = bounds.x + (bounds.width - w) / 2;
    const y = bounds.y + padding + i * (bandH + gap);

    return {
      id: `reflow-funnel-${node.id}`,
      shapeType: "rect",
      x,
      y,
      width: w,
      height: bandH,
      text: node.text,
      fontSize: Math.max(8, Math.min(11, bandH * 0.4)),
    };
  });
}

/**
 * Target / Bullseye layout reflow: concentric rings with nodes.
 * Outermost ring is the first node, innermost is the last.
 */
function reflowTarget(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const size = Math.min(bounds.width, bounds.height);
  const maxRadius = size * 0.45;

  return nodes.map((node, i) => {
    // Outermost ring first, innermost last
    const radiusFraction = 1.0 - (i / nodes.length);
    const r = maxRadius * radiusFraction;
    const diameter = r * 2;

    return {
      id: `reflow-target-${node.id}`,
      shapeType: "ellipse",
      x: cx - r,
      y: cy - r,
      width: diameter,
      height: diameter,
      text: node.text,
      fontSize: Math.max(7, Math.min(10, r * 0.15)),
    };
  });
}

/**
 * Gear layout reflow: interlocking gear shapes in a triangular arrangement.
 * Up to 3 main gears with extra nodes listed to the side.
 */
function reflowGear(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const gearNodes = nodes.slice(0, 3);
  const extraNodes = nodes.slice(3);
  const gearAreaW = extraNodes.length > 0 ? bounds.width * 0.7 : bounds.width;
  const gearAreaH = bounds.height;
  const cx = bounds.x + gearAreaW / 2;
  const cy = bounds.y + gearAreaH / 2;
  const spacing = gearAreaW / (gearNodes.length + 1);
  const gearR = Math.min(spacing * 0.4, gearAreaH * 0.35);
  const gearDiameter = gearR * 2;

  const shapes: PptxSmartArtDrawingShape[] = [];

  gearNodes.forEach((node, i) => {
    // Position gears: first and third at same height, second shifted down
    const gx = bounds.x + spacing * (i + 1);
    const gy = cy + (i % 2 === 0 ? 0 : gearR * 0.35);

    shapes.push({
      id: `reflow-gear-${node.id}`,
      shapeType: "ellipse",
      x: gx - gearR,
      y: gy - gearR,
      width: gearDiameter,
      height: gearDiameter,
      text: node.text,
      fontSize: Math.max(7, Math.min(10, gearR * 0.15)),
    });
  });

  // Extra nodes as small labels to the right
  const labelH = 20;
  const labelGap = 6;
  const labelW = bounds.width - gearAreaW - 16;
  const labelStartX = bounds.x + gearAreaW + 8;
  const labelStartY =
    bounds.y + (bounds.height - extraNodes.length * (labelH + labelGap)) / 2;

  extraNodes.forEach((node, i) => {
    shapes.push({
      id: `reflow-gear-extra-${node.id}`,
      shapeType: "roundRect",
      x: labelStartX,
      y: labelStartY + i * (labelH + labelGap),
      width: Math.max(labelW, 30),
      height: labelH,
      text: node.text,
      fontSize: Math.max(7, Math.min(10, 10)),
    });
  });

  return shapes;
}

/**
 * Venn layout reflow: overlapping circles for 2-4 nodes,
 * horizontal row for 5+.
 */
function reflowVenn(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const size = Math.min(bounds.width, bounds.height);

  if (nodes.length <= 4) {
    const r = size * 0.22;
    const spread = r * 0.6;

    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + spread * Math.cos(angle) - r;
      const ny = cy + spread * Math.sin(angle) - r;

      return {
        id: `reflow-venn-${node.id}`,
        shapeType: "ellipse",
        x: nx,
        y: ny,
        width: r * 2,
        height: r * 2,
        text: node.text,
        fontSize: Math.max(7, Math.min(10, r * 0.1)),
      };
    });
  }

  // Horizontal row of circles for 5+ nodes
  const r = Math.min(size * 0.15, bounds.width / (nodes.length * 1.5));
  const totalW = nodes.length * r * 2;
  const startX = cx - totalW / 2 + r;

  return nodes.map((node, i) => ({
    id: `reflow-venn-${node.id}`,
    shapeType: "ellipse",
    x: startX + i * r * 2 - r,
    y: cy - r,
    width: r * 2,
    height: r * 2,
    text: node.text,
    fontSize: Math.max(6, Math.min(9, r * 0.1)),
  }));
}

/**
 * Timeline layout reflow: nodes along a horizontal line with
 * alternating above/below placement.
 */
function reflowTimeline(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 24;
  const lineY = bounds.y + bounds.height / 2;
  const lineStartX = bounds.x + padding;
  const lineEndX = bounds.x + bounds.width - padding;
  const lineLen = lineEndX - lineStartX;
  const nodeW = Math.max(40, Math.min(80, lineLen / (nodes.length * 1.2)));
  const nodeH = nodeW * 0.5;
  const labelOffset = Math.min(bounds.height * 0.28, 40);

  const shapes: PptxSmartArtDrawingShape[] = [];

  // Add the timeline bar as a thin rectangle
  shapes.push({
    id: "reflow-timeline-bar",
    shapeType: "rect",
    x: lineStartX,
    y: lineY - 2,
    width: lineLen,
    height: 4,
    fillColor: "#94a3b8",
  });

  nodes.forEach((node, i) => {
    const x =
      nodes.length === 1
        ? (lineStartX + lineEndX) / 2
        : lineStartX + (i / (nodes.length - 1)) * lineLen;
    const above = i % 2 === 0;
    const ny = above ? lineY - labelOffset - nodeH / 2 : lineY + labelOffset - nodeH / 2;

    shapes.push({
      id: `reflow-timeline-${node.id}`,
      shapeType: "roundRect",
      x: x - nodeW / 2,
      y: ny,
      width: nodeW,
      height: nodeH,
      text: node.text,
      fontSize: Math.max(6, Math.min(10, nodeW * 0.1)),
    });
  });

  return shapes;
}

/**
 * Relationship layout reflow: nodes with bidirectional arrows.
 * For 2 nodes: side-by-side with double-headed arrow.
 * For 3+: arranged in a circle with connectors.
 */
function reflowRelationship(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const shapes: PptxSmartArtDrawingShape[] = [];

  if (nodes.length <= 2) {
    // Side by side with bidirectional arrow
    const padding = 16;
    const arrowGap = 24;
    const usableW = bounds.width - padding * 2 - arrowGap;
    const nodeW = usableW / nodes.length;
    const nodeH = bounds.height * 0.5;
    const yOffset = bounds.y + (bounds.height - nodeH) / 2;

    nodes.forEach((node, i) => {
      shapes.push({
        id: `reflow-rel-${node.id}`,
        shapeType: "roundRect",
        x: bounds.x + padding + i * (nodeW + arrowGap),
        y: yOffset,
        width: nodeW,
        height: nodeH,
        text: node.text,
        fontSize: Math.max(8, Math.min(11, nodeW * 0.1)),
      });
    });

    // Add arrow between nodes
    if (nodes.length === 2) {
      const arrowX = bounds.x + padding + nodeW;
      const arrowY = yOffset + nodeH / 2 - 6;
      shapes.push({
        id: "reflow-rel-arrow",
        shapeType: "leftRightArrow",
        x: arrowX,
        y: arrowY,
        width: arrowGap,
        height: 12,
        fillColor: "#94a3b8",
      });
    }
  } else {
    // Circle arrangement with connectors
    const size = Math.min(bounds.width, bounds.height);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const radius = size * 0.3;
    const nodeW = Math.max(
      size * 0.16,
      Math.min(size * 0.24, 250 / nodes.length),
    );
    const nodeH = nodeW * 0.6;

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + radius * Math.cos(angle) - nodeW / 2;
      const ny = cy + radius * Math.sin(angle) - nodeH / 2;

      shapes.push({
        id: `reflow-rel-${node.id}`,
        shapeType: "roundRect",
        x: nx,
        y: ny,
        width: nodeW,
        height: nodeH,
        text: node.text,
        fontSize: Math.max(7, Math.min(10, nodeW * 0.1)),
      });
    });
  }

  return shapes;
}

/**
 * Chevron layout reflow: arrow-shaped nodes flowing horizontally.
 * Each node is a chevron/arrow shape pointing right.
 */
function reflowChevron(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const padding = 8;
  const gap = 4;
  const usableW = bounds.width - padding * 2;
  const itemW = (usableW - gap * (nodes.length - 1)) / nodes.length;
  const itemH = Math.min(bounds.height - padding * 2, 60);
  const yOffset = bounds.y + (bounds.height - itemH) / 2;

  return nodes.map((node, i) => {
    const x = bounds.x + padding + i * (itemW + gap);

    return {
      id: `reflow-chevron-${node.id}`,
      shapeType: "chevron",
      x,
      y: yOffset,
      width: itemW,
      height: itemH,
      text: node.text,
      fontSize: Math.max(7, Math.min(11, itemW * 0.1)),
    };
  });
}

/**
 * Bending / Snake layout reflow: nodes in a serpentine path.
 * Nodes flow left-to-right, then right-to-left on the next row, etc.
 */
function reflowBending(
  nodes: PptxSmartArtNode[],
  bounds: ContainerBounds,
): PptxSmartArtDrawingShape[] {
  const COLS = 4;
  const padding = 8;
  const gap = 6;
  const rows = Math.ceil(nodes.length / COLS);
  const usableW = bounds.width - padding * 2;
  const usableH = bounds.height - padding * 2;
  const cellW = (usableW - gap * (COLS - 1)) / COLS;
  const cellH = (usableH - gap * (rows - 1)) / Math.max(rows, 1);
  const boxW = cellW * 0.85;
  const boxH = Math.min(cellH * 0.7, 40);

  const shapes: PptxSmartArtDrawingShape[] = [];

  nodes.forEach((node, i) => {
    const row = Math.floor(i / COLS);
    const colInRow = i % COLS;
    // Reverse direction on odd rows (serpentine)
    const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;

    const nodeCx =
      bounds.x + padding + col * (cellW + gap) + cellW / 2;
    const nodeCy =
      bounds.y + padding + row * (cellH + gap) + cellH / 2;

    shapes.push({
      id: `reflow-bending-${node.id}`,
      shapeType: "roundRect",
      x: nodeCx - boxW / 2,
      y: nodeCy - boxH / 2,
      width: boxW,
      height: boxH,
      text: node.text,
      fontSize: Math.max(7, Math.min(10, boxW * 0.1)),
    });

    // Add arrow connector to next node
    if (i < nodes.length - 1) {
      const nextRow = Math.floor((i + 1) / COLS);
      const nextColInRow = (i + 1) % COLS;
      const nextCol =
        nextRow % 2 === 0 ? nextColInRow : COLS - 1 - nextColInRow;
      const nextCx =
        bounds.x + padding + nextCol * (cellW + gap) + cellW / 2;
      const nextCy =
        bounds.y + padding + nextRow * (cellH + gap) + cellH / 2;

      if (nextRow === row) {
        // Horizontal arrow
        const dir = nextCx > nodeCx ? 1 : -1;
        const arrowX = dir > 0 ? nodeCx + boxW / 2 : nextCx + boxW / 2;
        const arrowW = Math.abs(nextCx - nodeCx) - boxW;
        shapes.push({
          id: `reflow-bending-arrow-${node.id}`,
          shapeType: dir > 0 ? "rightArrow" : "leftArrow",
          x: arrowX,
          y: nodeCy - 4,
          width: Math.max(arrowW, 4),
          height: 8,
          fillColor: "#94a3b8",
        });
      } else {
        // Vertical arrow (row transition)
        const arrowY = nodeCy + boxH / 2;
        const arrowH = Math.abs(nextCy - nodeCy) - boxH;
        shapes.push({
          id: `reflow-bending-arrow-${node.id}`,
          shapeType: "downArrow",
          x: nodeCx - 4,
          y: arrowY,
          width: 8,
          height: Math.max(arrowH, 4),
          fillColor: "#94a3b8",
        });
      }
    }
  });

  return shapes;
}

// ── Internal helpers ────────────────────────────────────────────────────

/**
 * Resolve a raw layout type string to a SmartArtLayoutType.
 */
function resolveLayoutCategory(
  layoutType: string | undefined,
): SmartArtLayoutType {
  if (!layoutType) return "list";
  const lower = layoutType.toLowerCase();

  if (lower.includes("hierarchy") || lower.includes("org")) return "hierarchy";
  if (lower.includes("cycle") || lower.includes("radial")) return "cycle";
  if (lower.includes("funnel")) return "funnel";
  if (lower.includes("target") || lower.includes("bullseye")) return "target";
  if (lower.includes("gear") || lower.includes("interlock")) return "gear";
  if (lower.includes("venn")) return "venn";
  if (lower.includes("timeline")) return "timeline";
  if (lower.includes("bending") || lower.includes("snake") || lower.includes("zigzag")) return "bending";
  if (lower.includes("chevron")) return "chevron";
  if (lower.includes("relationship")) return "relationship";
  if (
    lower.includes("process") ||
    lower.includes("arrow")
  )
    return "process";
  if (lower.includes("matrix")) return "matrix";
  if (lower.includes("pyramid")) return "pyramid";
  if (lower.includes("list") || lower.includes("block")) return "list";

  return "list";
}
