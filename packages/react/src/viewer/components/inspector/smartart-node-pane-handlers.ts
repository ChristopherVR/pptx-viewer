import type { PptxSmartArtData } from 'pptx-viewer-core';
import {
	addSmartArtNode,
	demoteSmartArtNode,
	promoteSmartArtNode,
	removeSmartArtNode,
	reorderSmartArtNode,
} from 'pptx-viewer-core';

/**
 * Pure keyboard / reorder handlers for the SmartArt text pane.
 *
 * All functions delegate to the core editing ops (which rewire connections and
 * clear drawing shapes) and return either a new {@link PptxSmartArtData} to
 * apply, or `undefined` when the action is a no-op. Keeping this logic out of
 * the component keeps the panel thin and makes the behaviour unit-testable.
 *
 * @module smartart-node-pane-handlers
 */

/** Result of a keyboard action: the data to apply plus an optional focus hint. */
export interface NodePaneKeyResult {
	/** Updated SmartArt data to apply via onUpdateElement. */
	data: PptxSmartArtData;
	/**
	 * Node id that should receive focus after the update, when known. For a
	 * newly inserted sibling this is the sibling that follows `nodeId`.
	 */
	focusNodeId?: string;
}

/** Count of top-level nodes (no parentId) in the data model. */
export function countTopLevel(data: PptxSmartArtData): number {
	return data.nodes.filter((n) => !n.parentId).length;
}

/**
 * Enter: insert a sibling node immediately after the current one.
 *
 * Returns the new data and the id of the inserted sibling so the caller can
 * move focus to it.
 */
export function addSiblingAfter(
	data: PptxSmartArtData,
	nodeId: string,
): NodePaneKeyResult | undefined {
	const next = addSmartArtNode(data, '', nodeId);
	if (next === data) {
		return undefined;
	}
	// The inserted node is the one directly after `nodeId` in the new list.
	const idx = next.nodes.findIndex((n) => n.id === nodeId);
	const inserted = idx >= 0 ? next.nodes[idx + 1] : undefined;
	return { data: next, focusNodeId: inserted?.id };
}

/**
 * Delete / Backspace on an empty node: remove it (when more than one node
 * remains). Returns the previous sibling / node id to focus when available.
 */
export function removeEmptyNode(
	data: PptxSmartArtData,
	nodeId: string,
): NodePaneKeyResult | undefined {
	if (data.nodes.length <= 1) {
		return undefined;
	}
	const removedIndex = data.nodes.findIndex((n) => n.id === nodeId);
	const next = removeSmartArtNode(data, nodeId);
	if (next === data) {
		return undefined;
	}
	// Prefer focusing the node that took the removed slot, else the previous one.
	const focusNode = next.nodes[Math.max(0, removedIndex - 1)];
	return { data: next, focusNodeId: focusNode?.id };
}

/** Tab: demote a node under its preceding sibling (connection-aware). */
export function demote(data: PptxSmartArtData, nodeId: string): PptxSmartArtData | undefined {
	const next = demoteSmartArtNode(data, nodeId);
	return next === data ? undefined : next;
}

/** Shift+Tab: promote a node to its parent's level (connection-aware). */
export function promote(data: PptxSmartArtData, nodeId: string): PptxSmartArtData | undefined {
	const next = promoteSmartArtNode(data, nodeId);
	return next === data ? undefined : next;
}

/** Move a node up (-1) or down (+1) within its sibling group. */
export function reorder(
	data: PptxSmartArtData,
	nodeId: string,
	direction: 1 | -1,
): PptxSmartArtData | undefined {
	const next = reorderSmartArtNode(data, nodeId, direction);
	return next === data ? undefined : next;
}

/** Index of a node among its siblings (nodes sharing its parentId). */
export function siblingIndex(data: PptxSmartArtData, nodeId: string): number {
	const node = data.nodes.find((n) => n.id === nodeId);
	if (!node) {
		return -1;
	}
	const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
	return siblings.findIndex((n) => n.id === nodeId);
}

/** Number of siblings (including the node itself) sharing its parentId. */
export function siblingCount(data: PptxSmartArtData, nodeId: string): number {
	const node = data.nodes.find((n) => n.id === nodeId);
	if (!node) {
		return 0;
	}
	return data.nodes.filter((n) => n.parentId === node.parentId).length;
}
