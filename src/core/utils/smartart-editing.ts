/**
 * SmartArt editing utilities.
 *
 * Provides add/remove/reorder operations on SmartArt data-model nodes
 * with automatic reflow of the in-memory diagram structure.
 */

import type { PptxSmartArtData, PptxSmartArtNode } from "../types";

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
  const nodes = data.nodes.filter((n) => n.id !== nodeId);

  // Re-parent children of the removed node to its parent
  const removedNode = data.nodes.find((n) => n.id === nodeId);
  if (removedNode?.parentId) {
    for (const node of nodes) {
      if (node.parentId === nodeId) {
        node.parentId = removedNode.parentId;
      }
    }
  } else {
    // If removed node was a root, promote children to roots
    for (const node of nodes) {
      if (node.parentId === nodeId) {
        node.parentId = undefined;
      }
    }
  }

  // Remove connections referencing the deleted node and re-wire children
  const connections = (data.connections ?? [])
    .filter((c) => c.sourceId !== nodeId && c.destId !== nodeId)
    .map((c) => ({ ...c }));

  // Add connections from the removed node's parent to its children
  if (removedNode?.parentId) {
    const childIds = data.nodes
      .filter((n) => n.parentId === nodeId)
      .map((n) => n.id);
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
