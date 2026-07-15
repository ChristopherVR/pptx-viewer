/**
 * SmartArt per-node visual-override editing operation.
 *
 * Sibling of `smartart-editing-node-ops`; kept in its own module so neither
 * file grows past the per-file line budget. Like the other node ops, the
 * function here is pure and immutable: it returns a new `PptxSmartArtData` and
 * clears `drawingShapes` so the renderer reflows from the algorithmic layout
 * engine (which honours the per-node fill / font override).
 *
 * @module smartart-editing-node-style
 */

import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	PptxSmartArtNodeStyle,
} from '../types';

/** Merge a partial style onto an existing one, dropping cleared (undefined) keys. */
function mergeNodeStyle(
	current: PptxSmartArtNodeStyle | undefined,
	patch: Partial<PptxSmartArtNodeStyle>,
): PptxSmartArtNodeStyle {
	const merged: PptxSmartArtNodeStyle = { ...current };
	for (const key of Object.keys(patch) as (keyof PptxSmartArtNodeStyle)[]) {
		const value = patch[key];
		if (value === undefined) {
			delete merged[key];
		} else {
			// Assign through a typed bridge so each optional field keeps its type.
			(merged as Record<keyof PptxSmartArtNodeStyle, unknown>)[key] = value;
		}
	}
	return merged;
}

/**
 * Set (merge) a per-node visual override on a SmartArt node by id.
 *
 * The `style` partial is shallow-merged onto the node's existing
 * {@link PptxSmartArtNodeStyle}: present keys overwrite, keys explicitly set to
 * `undefined` are removed. When the resulting style has no keys, the `style`
 * field is dropped from the node entirely. `drawingShapes` is cleared so the
 * renderer reflows and the new colours take effect.
 *
 * Returns a new `PptxSmartArtData`; the input is never mutated. When `nodeId`
 * matches no node, the original `data` reference is returned unchanged.
 *
 * @example
 * ```ts
 * const next = setSmartArtNodeStyle(data, "node-2", { fillColor: "#FF0000", bold: true });
 * ```
 */
export function setSmartArtNodeStyle(
	data: PptxSmartArtData,
	nodeId: string,
	style: Partial<PptxSmartArtNodeStyle>,
): PptxSmartArtData {
	let matched = false;
	const nodes = data.nodes.map((node): PptxSmartArtNode => {
		if (node.id !== nodeId) {
			return node;
		}
		matched = true;
		const nextStyle = mergeNodeStyle(node.style, style);
		const hasStyle = Object.keys(nextStyle).length > 0;
		const updated: PptxSmartArtNode = { ...node };
		if (hasStyle) {
			updated.style = nextStyle;
		} else {
			delete updated.style;
		}
		return updated;
	});

	if (!matched) {
		return data;
	}

	return {
		...data,
		nodes,
		drawingDirty: true,
		drawingShapes: patchDrawingShapeStyle(data.drawingShapes, data.nodes, nodeId, style),
	};
}

/**
 * Patch a single drawing shape's visual properties in-place (immutable copy).
 * Returns `undefined` unchanged when no drawing shapes exist.
 */
function patchDrawingShapeStyle(
	shapes: PptxSmartArtDrawingShape[] | undefined,
	nodes: readonly PptxSmartArtNode[],
	nodeId: string,
	style: Partial<PptxSmartArtNodeStyle>,
): PptxSmartArtDrawingShape[] | undefined {
	if (!shapes || shapes.length === 0) {
		return shapes;
	}
	const idx = findShapeIndexForNode(shapes, nodes, nodeId);
	if (idx < 0) {
		// Cannot resolve which shape corresponds to this node (e.g. PowerPoint-
		// generated shapes with opaque IDs). Mark as stale so a full rebuild
		// picks up the new style.
		return [];
	}
	const patch: Partial<PptxSmartArtDrawingShape> = {};
	if (style.fillColor !== undefined) {
		patch.fillColor = style.fillColor;
	}
	if (style.lineColor !== undefined) {
		patch.strokeColor = style.lineColor;
	}
	if (style.fontColor !== undefined) {
		patch.fontColor = style.fontColor;
	}
	if (Object.keys(patch).length === 0) {
		return shapes;
	}
	const updated = [...shapes];
	updated[idx] = { ...updated[idx]!, ...patch };
	return updated;
}

/**
 * Find the drawing shape index that corresponds to a given node ID.
 */
function findShapeIndexForNode(
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
