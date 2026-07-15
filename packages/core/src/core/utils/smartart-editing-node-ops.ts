/**
 * SmartArt node mutation operations.
 *
 * Provides add / remove / reorder / promote / demote operations on SmartArt
 * data-model nodes with automatic connection management.
 *
 * All mutation functions return a new `PptxSmartArtData` object (immutable)
 * and clear `drawingShapes` so that the renderer falls back to the
 * algorithmic layout engine, which automatically reflows positions.
 *
 * @module smartart-editing-node-ops
 */

import type { PptxSmartArtData, PptxSmartArtDrawingShape, PptxSmartArtNode } from '../types';
import { generateFontGuid } from './font-deobfuscation';

// ── Drawing shape helpers ────────────────────────────────────────────────

/**
 * Mark drawing shapes as stale after a structural node edit.
 *
 * - If the element previously had drawing shapes (from file load or a prior
 *   reflow), returns an empty array `[]` to signal that a rebuild is needed.
 * - If the element never had drawing shapes (`undefined`), returns `undefined`
 *   so the family SVG renderer continues handling display without triggering
 *   a lossy reflow (e.g. polygon-to-chevron downgrade for pyramid layouts).
 */
function markShapesStale(
	shapes: PptxSmartArtDrawingShape[] | undefined,
): PptxSmartArtDrawingShape[] | undefined {
	return shapes !== undefined && shapes.length > 0 ? [] : undefined;
}

// ── ID generation ────────────────────────────────────────────────────────

/**
 * Generate a unique model ID for a new SmartArt node.
 *
 * Must match the `{GUID}` format ("{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}")
 * every `dgm:pt`/`dgm:cxn` `@_modelId` uses in a real PowerPoint file. A save
 * with a differently-formatted id (e.g. a plain informal string) is
 * schema-valid XML but PowerPoint's loader still rejects the file as corrupt
 * on open -- confirmed empirically via PowerPoint COM automation.
 */
function nextModelId(): string {
	return `{${generateFontGuid()}}`;
}

/** No-op kept for API compatibility; id generation no longer needs a counter. */
export function resetSmartArtEditCounter(): void {}

/**
 * The id nodes use as `parentId` when they have no visible parent within the
 * array -- i.e. the diagram's root/doc point id. Existing top-level nodes
 * (parsed from a real file) already carry this as their own `parentId`; a
 * brand-new top-level node needs the same value so the save pipeline can
 * anchor it under the same root when writing the diagram XML back out
 * (see `synthesizeNewSmartArtStructuralPoints` in core's save runtime).
 * Returns `undefined` when the diagram has no nodes yet to infer it from.
 */
function findRootParentId(nodes: PptxSmartArtNode[]): string | undefined {
	const nodeIds = new Set(nodes.map((n) => n.id));
	for (const node of nodes) {
		if (node.parentId && !nodeIds.has(node.parentId)) {
			return node.parentId;
		}
	}
	return undefined;
}

// ── Node CRUD operations ─────────────────────────────────────────────────

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

	// Determine parent from the sibling node, falling back to the diagram's
	// root id for a genuinely top-level addition (no sibling to anchor to).
	let parentId: string | undefined;
	if (afterNodeId) {
		const sibling = data.nodes.find((n) => n.id === afterNodeId);
		parentId = sibling?.parentId;
	}
	parentId ??= findRootParentId(data.nodes);

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
			type: 'parOf',
			srcOrd: maxSrcOrd + 1,
			destOrd: 0,
		});
	}

	return {
		...data,
		nodes,
		connections: connections.length > 0 ? connections : undefined,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}

/**
 * Remove a node from a SmartArt diagram by ID.
 * Also removes any connections referencing the node and
 * clears drawing shapes to trigger layout reflow.
 */
export function removeSmartArtNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	const removedNode = data.nodes.find((n) => n.id === nodeId);

	// Identify children of the removed node BEFORE mutating any objects
	const childIds = data.nodes.filter((n) => n.parentId === nodeId).map((n) => n.id);

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
				type: 'parOf',
				srcOrd: maxSrcOrd + 1,
				destOrd: 0,
			});
		}
	}

	return {
		...data,
		nodes,
		connections: connections.length > 0 ? connections : undefined,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}

/**
 * Update the text of a SmartArt node by ID.
 *
 * When drawing shapes exist, updates the matching shape's text in-place so the
 * renderer path does not change (avoids polygon-to-chevron downgrade that makes
 * a pyramid look like stacked bars). When no drawing shapes are present the
 * family renderer reads text directly from the node array.
 */
export function updateSmartArtNodeText(
	data: PptxSmartArtData,
	nodeId: string,
	newText: string,
): PptxSmartArtData {
	const nodes = data.nodes.map((n) => (n.id === nodeId ? { ...n, text: newText } : n));

	return {
		...data,
		nodes,
		drawingDirty: true,
		drawingShapes: patchDrawingShapeText(data.drawingShapes, data.nodes, nodeId, newText),
	};
}

/**
 * Patch a single drawing shape's text field in-place (immutable copy).
 * Returns `undefined` unchanged when no drawing shapes exist.
 */
function patchDrawingShapeText(
	shapes: PptxSmartArtDrawingShape[] | undefined,
	nodes: readonly PptxSmartArtNode[],
	nodeId: string,
	newText: string,
): PptxSmartArtDrawingShape[] | undefined {
	if (!shapes || shapes.length === 0) {
		return shapes;
	}
	const idx = findDrawingShapeIndex(shapes, nodes, nodeId);
	if (idx < 0) {
		// Cannot resolve which shape corresponds to this node (e.g. PowerPoint-
		// generated shapes with opaque IDs). Mark as stale so a full rebuild
		// picks up the new text.
		return [];
	}
	const updated = [...shapes];
	updated[idx] = { ...updated[idx]!, text: newText };
	return updated;
}

/**
 * Find the drawing shape index that corresponds to a given node ID.
 * Uses the same resolution logic as `resolveDrawingShapeNodeId` (shared pkg).
 */
function findDrawingShapeIndex(
	shapes: readonly PptxSmartArtDrawingShape[],
	nodes: readonly PptxSmartArtNode[],
	nodeId: string,
): number {
	// 1. Reflow shapes embed the node id as the id suffix.
	for (let i = 0; i < shapes.length; i++) {
		if (shapes[i]!.id.startsWith('reflow-') && shapes[i]!.id.endsWith(`-${nodeId}`)) {
			return i;
		}
	}
	// 2. 1:1 positional mapping when counts align.
	if (shapes.length === nodes.length) {
		const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
		if (nodeIdx >= 0) {
			return nodeIdx;
		}
	}
	// 3. Unique non-empty text match.
	const node = nodes.find((n) => n.id === nodeId);
	if (node?.text) {
		const text = node.text.trim();
		const matches: number[] = [];
		for (let i = 0; i < shapes.length; i++) {
			if (shapes[i]!.text?.trim() === text) {
				matches.push(i);
			}
		}
		if (matches.length === 1) {
			return matches[0]!;
		}
	}
	return -1;
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
	if (!node) {
		return data;
	}

	// Find siblings (nodes with the same parentId)
	const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
	const currentIndex = siblings.findIndex((n) => n.id === nodeId);
	const targetIndex = currentIndex + direction;

	if (targetIndex < 0 || targetIndex >= siblings.length) {
		return data;
	}

	// Swap in the full node list
	const nodes = [...data.nodes];
	const currentGlobalIndex = nodes.findIndex((n) => n.id === siblings[currentIndex].id);
	const targetGlobalIndex = nodes.findIndex((n) => n.id === siblings[targetIndex].id);

	if (currentGlobalIndex >= 0 && targetGlobalIndex >= 0) {
		const temp = nodes[currentGlobalIndex];
		nodes[currentGlobalIndex] = nodes[targetGlobalIndex];
		nodes[targetGlobalIndex] = temp;
	}

	return {
		...data,
		nodes,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}

/**
 * Promote a child node to be a sibling of its parent.
 */
export function promoteSmartArtNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	const node = data.nodes.find((n) => n.id === nodeId);
	if (!node || !node.parentId) {
		return data;
	}

	const parent = data.nodes.find((n) => n.id === node.parentId);
	if (!parent) {
		return data;
	}

	const nodes = data.nodes.map((n) => (n.id === nodeId ? { ...n, parentId: parent.parentId } : n));

	// Update connections
	const connections = (data.connections ?? [])
		.filter((c) => !(c.sourceId === node.parentId && c.destId === nodeId))
		.map((c) => ({ ...c }));

	if (parent.parentId) {
		connections.push({
			sourceId: parent.parentId,
			destId: nodeId,
			type: 'parOf',
			srcOrd: 0,
			destOrd: 0,
		});
	}

	return {
		...data,
		nodes,
		connections: connections.length > 0 ? connections : undefined,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}

/**
 * Demote a node to become a child of its preceding sibling.
 */
export function demoteSmartArtNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	const node = data.nodes.find((n) => n.id === nodeId);
	if (!node) {
		return data;
	}

	// Find the preceding sibling
	const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
	const currentIndex = siblings.findIndex((n) => n.id === nodeId);
	if (currentIndex <= 0) {
		return data;
	} // Can't demote the first sibling

	const newParentId = siblings[currentIndex - 1].id;

	const nodes = data.nodes.map((n) => (n.id === nodeId ? { ...n, parentId: newParentId } : n));

	// Update connections
	const connections = (data.connections ?? [])
		.filter((c) => !(c.sourceId === node.parentId && c.destId === nodeId))
		.map((c) => ({ ...c }));

	connections.push({
		sourceId: newParentId,
		destId: nodeId,
		type: 'parOf',
		srcOrd: 0,
		destOrd: 0,
	});

	return {
		...data,
		nodes,
		connections: connections.length > 0 ? connections : undefined,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}

// ── Alternative signatures ───────────────────────────────────────────────

/**
 * Add a new node as a child of a given parent.
 *
 * If `parentId` is undefined, the node is added as a root-level item, using
 * the diagram's own root/doc id (inferred from an existing top-level node)
 * so it ends up as a sibling of the other top-level items rather than an
 * unparented node the save pipeline can't anchor into the diagram XML.
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
	const resolvedParentId = parentId ?? findRootParentId(data.nodes);
	const newId = nextModelId();
	const label = text ?? `Item ${data.nodes.length + 1}`;

	const newNode: PptxSmartArtNode = {
		id: newId,
		text: label,
		parentId: resolvedParentId,
	};

	const nodes = [...data.nodes, newNode];

	// Add a connection from parent to the new node
	const connections = [...(data.connections ?? [])];
	if (resolvedParentId) {
		const maxSrcOrd = connections
			.filter((c) => c.sourceId === resolvedParentId)
			.reduce((max, c) => Math.max(max, c.srcOrd ?? 0), -1);

		connections.push({
			sourceId: resolvedParentId,
			destId: newId,
			type: 'parOf',
			srcOrd: maxSrcOrd + 1,
			destOrd: 0,
		});
	}

	return {
		...data,
		nodes,
		connections: connections.length > 0 ? connections : undefined,
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
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
	if (!node) {
		return data;
	}

	// Collect siblings in their original order
	const siblings = data.nodes.filter((n) => n.parentId === node.parentId);
	const currentIndex = siblings.findIndex((n) => n.id === nodeId);
	if (currentIndex < 0) {
		return data;
	}

	// Clamp the target index
	const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length - 1));
	if (clampedIndex === currentIndex) {
		return data;
	}

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
		drawingDirty: true,
		drawingShapes: markShapesStale(data.drawingShapes),
	};
}
