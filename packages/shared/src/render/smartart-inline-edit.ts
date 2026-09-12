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
 * - `measureSvgViewportRect`: measure SVG geometry in local coordinates so an
 *   HTML overlay inherits the diagram's outer transform exactly once.
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
 * Subtract a container origin from a node rectangle in the same coordinate space.
 *
 * Both rectangles must already use the overlay's local coordinate space.
 * Screen rectangles are unsuitable when the overlay inherits a transform;
 * use `measureSvgViewportRect` for the SVG-backed SmartArt overlays.
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

/**
 * Measure an SVG graphic in its outermost SVG viewport's local CSS pixels.
 *
 * The viewport and the HTML overlay must share an origin. This accounts for
 * SVG viewBox/letterboxing and internal transforms, but deliberately excludes
 * outer HTML transforms that the overlay will inherit itself.
 */
export function measureSvgViewportRect(source: Element): InlineEditRect | null {
	const graphic = source as SVGGraphicsElement;
	if (typeof graphic.getBBox !== 'function' || typeof graphic.getCTM !== 'function') {
		return null;
	}
	try {
		let viewport = graphic.ownerSVGElement;
		if (!viewport) {
			return null;
		}
		let matrix = graphic.getCTM();
		if (viewport.ownerSVGElement) {
			// getCTM targets the nearest SVG viewport. Cross nested viewports
			// through screen matrices, then remove the outer HTML transform.
			while (viewport.ownerSVGElement) {
				viewport = viewport.ownerSVGElement;
			}
			const viewportMatrix = viewport.getCTM();
			const viewportScreen = viewport.getScreenCTM();
			const graphicScreen = graphic.getScreenCTM();
			if (!viewportMatrix || !viewportScreen || !graphicScreen) {
				return null;
			}
			matrix = viewportMatrix.multiply(viewportScreen.inverse()).multiply(graphicScreen);
		}
		if (!matrix) {
			return null;
		}
		const box = graphic.getBBox();
		const points = [
			[box.x, box.y],
			[box.x + box.width, box.y],
			[box.x, box.y + box.height],
			[box.x + box.width, box.y + box.height],
		].map(([x, y]) => ({
			x: matrix.a * x + matrix.c * y + matrix.e,
			y: matrix.b * x + matrix.d * y + matrix.f,
		}));
		if (
			box.width < 0 ||
			box.height < 0 ||
			points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
		) {
			return null;
		}
		const left = Math.min(...points.map(({ x }) => x));
		const top = Math.min(...points.map(({ y }) => y));
		return {
			left,
			top,
			width: Math.max(...points.map(({ x }) => x)) - left,
			height: Math.max(...points.map(({ y }) => y)) - top,
		};
	} catch {
		// Detached/unrenderable SVGs and singular nested matrices have no box.
		return null;
	}
}
