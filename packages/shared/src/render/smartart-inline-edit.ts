/**
 * Framework-agnostic helpers for inline (on-canvas) SmartArt node text editing.
 *
 * The actual text mutation lives in `pptx-viewer-core`
 * (`updateSmartArtNodeText`); these helpers cover the pure, binding-independent
 * concerns around it:
 *
 * - `findSmartArtNodeText`: look up a node's current text by id.
 * - `shouldCommitSmartArtNodeText`: decide whether a new value differs from the
 *   current one (so a no-op blur does not push a history entry).
 * - `computeInlineEditorRect`: project a node's on-screen bounding box into
 *   coordinates relative to the SmartArt container so an HTML editor overlay can
 *   be positioned exactly over the node.
 *
 * @module smartart-inline-edit
 */

import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
} from 'pptx-viewer-core';

/** A minimal rectangle (DOMRect-compatible) used for overlay positioning. */
export interface InlineEditRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Return the current text of the SmartArt node with the given id, or
 * `undefined` when no such node exists.
 */
export function findSmartArtNodeText(data: PptxSmartArtData, nodeId: string): string | undefined {
	return data.nodes.find((n) => n.id === nodeId)?.text;
}

/**
 * Whether committing `nextText` to `nodeId` is a real change.
 *
 * Returns `false` when the node is missing or the text is identical, allowing
 * callers to skip a redundant update + history entry on blur / Enter.
 */
export function shouldCommitSmartArtNodeText(
	data: PptxSmartArtData,
	nodeId: string,
	nextText: string,
): boolean {
	const current = findSmartArtNodeText(data, nodeId);
	if (current === undefined) {
		return false;
	}
	return current !== nextText;
}

/**
 * Resolve which SmartArt model node a pre-computed drawing shape represents, so
 * a clicked drawing shape can be edited inline.
 *
 * Drawing shapes do not carry the model node id directly, so this applies a
 * cascade of progressively weaker heuristics:
 *
 * 1. Reflow-generated shapes embed the node id in their `id`
 *    (`reflow-<layout>-<nodeId>`); match the suffix against a known node id.
 * 2. When the shape count equals the node count, map by position (the common
 *    1:1 document-order case).
 * 3. Fall back to a unique, non-empty text match.
 *
 * Returns the resolved node id, or `undefined` when no confident match exists
 * (in which case the shape is not made editable).
 *
 * Arrow/connector shapes (preset geometry names that end with `"Arrow"`, e.g.
 * `rightArrow`, `leftRightArrow`, `downArrow`) that carry no text are always
 * structural decorators in SmartArt - never editable node content. They are
 * excluded before any heuristic runs so that reflow connector shapes with ids
 * like `reflow-bending-arrow-n1` (which end with `-n1` and would otherwise
 * match node `n1` via heuristic 1) are correctly left untagged.
 *
 * Arrow shapes that DO carry text (e.g. content nodes in an "Opposing Arrows"
 * layout) are intentional content and are allowed through.
 */
export function resolveDrawingShapeNodeId(
	shape: PptxSmartArtDrawingShape,
	shapeIndex: number,
	shapes: readonly PptxSmartArtDrawingShape[],
	nodes: readonly PptxSmartArtNode[],
): string | undefined {
	// Arrow shapes without text are structural connector decorators and are
	// never editable node content. All OOXML arrow preset geometry names end
	// with "Arrow" (rightArrow, leftArrow, downArrow, leftRightArrow, etc.).
	if (shape.shapeType?.endsWith('Arrow') && !shape.text) {
		return undefined;
	}

	// 1. Reflow shapes embed the node id as the id suffix.
	if (shape.id.startsWith('reflow-')) {
		const match = nodes.find((n) => shape.id.endsWith(`-${n.id}`));
		if (match) {
			return match.id;
		}
	}

	// 2. 1:1 positional mapping when counts align.
	if (shapes.length === nodes.length) {
		return nodes[shapeIndex]?.id;
	}

	// 3. Unique non-empty text match.
	const text = shape.text?.trim();
	if (text) {
		const matches = nodes.filter((n) => n.text.trim() === text);
		if (matches.length === 1) {
			return matches[0].id;
		}
	}

	return undefined;
}

/**
 * Project a node's on-screen bounding box (`nodeRect`, viewport coordinates)
 * into coordinates relative to the SmartArt container box (`containerRect`,
 * viewport coordinates) so an absolutely-positioned editor can sit exactly over
 * the node.
 *
 * Both rectangles are expected in the same coordinate space (e.g. both from
 * `getBoundingClientRect()`), so the result is unaffected by canvas zoom: the
 * editor inherits the rendered size of the node.
 */
export function computeInlineEditorRect(
	nodeRect: InlineEditRect,
	containerRect: InlineEditRect,
): InlineEditRect {
	return {
		left: nodeRect.left - containerRect.left,
		top: nodeRect.top - containerRect.top,
		width: nodeRect.width,
		height: nodeRect.height,
	};
}
