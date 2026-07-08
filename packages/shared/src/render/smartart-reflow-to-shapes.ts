/**
 * SmartArt reflow: convert algorithmic layout results back to
 * PptxSmartArtDrawingShape[] so the drawing-shape renderer handles post-edit
 * display and shapes round-trip correctly through save.
 *
 * When structural edits (add/remove/reorder/text/style) clear `drawingShapes`,
 * `rebuildDrawingShapesIfCleared` calls the layout engine and converts the
 * geometry back to drawing shapes so the richer DrawingShapeRenderer path
 * stays active rather than falling back to the plain SVG family renderer.
 *
 * @module smartart-reflow-to-shapes
 */

import type {
	PptxSmartArtData,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { computeSmartArtLayout } from './smartart-layout';
import { flattenNodes } from './smartart-layout-helpers';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

// ── Polygon bounding-box helper ───────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box of an SVG polygon points string.
 * Returns a zero-size box when the string is empty or unparseable.
 */
function polygonBounds(points: string): { x: number; y: number; width: number; height: number } {
	const pairs = points.trim().split(/\s+/u);
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const pair of pairs) {
		const comma = pair.indexOf(',');
		if (comma < 0) {
			continue;
		}
		const x = parseFloat(pair.slice(0, comma));
		const y = parseFloat(pair.slice(comma + 1));
		if (!isFinite(x) || !isFinite(y)) {
			continue;
		}
		if (x < minX) {
			minX = x;
		}
		if (x > maxX) {
			maxX = x;
		}
		if (y < minY) {
			minY = y;
		}
		if (y > maxY) {
			maxY = y;
		}
	}

	if (!isFinite(minX)) {
		return { x: 0, y: 0, width: 0, height: 0 };
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ── Single-node mapping ────────────────────────────────────────────────────────

/**
 * Map one RenderedNode to a PptxSmartArtDrawingShape.
 *
 * The shape ID encodes the layout family and the source node id as a suffix so
 * `resolveDrawingShapeNodeId` can match it back via the `reflow-` prefix rule.
 */
function renderedNodeToShape(
	rn: RenderedNode,
	nodeId: string,
	family: string,
): PptxSmartArtDrawingShape {
	const id = `reflow-${family}-${nodeId}`;
	const text = rn.text || undefined;

	if (rn.kind === 'rect') {
		return {
			id,
			shapeType: rn.rx > 0 ? 'roundRect' : 'rect',
			x: rn.x,
			y: rn.y,
			width: rn.width,
			height: rn.height,
			rotation: 0,
			fillColor: rn.fill,
			strokeColor: rn.stroke,
			strokeWidth: rn.strokeWidth,
			text,
			fontSize: rn.fontSize,
		};
	}

	if (rn.kind === 'circle') {
		return {
			id,
			shapeType: 'ellipse',
			x: rn.cx - rn.r,
			y: rn.cy - rn.r,
			width: rn.r * 2,
			height: rn.r * 2,
			rotation: 0,
			fillColor: rn.fill,
			strokeColor: rn.stroke,
			strokeWidth: rn.strokeWidth,
			text,
			fontSize: rn.fontSize,
		};
	}

	// polygon -- extract a bounding box from the SVG points string
	const bounds = polygonBounds(rn.points);
	return {
		id,
		shapeType: 'chevron',
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		rotation: 0,
		fillColor: rn.fill,
		strokeColor: rn.stroke,
		strokeWidth: rn.strokeWidth,
		text,
		fontSize: rn.fontSize,
	};
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Convert a SmartArt layout result to an array of PptxSmartArtDrawingShape.
 *
 * Rendered nodes are matched to source nodes by flat index when the counts
 * align; otherwise the rendered node's key is used as the node-id suffix.
 * Connector paths are omitted: PptxSmartArtDrawingShape has no SVG path field,
 * and connectors carry no editable content anyway.
 */
export function reflowToDrawingShapes(
	layoutResult: SmartArtLayoutResult,
	nodes: readonly PptxSmartArtNode[],
): PptxSmartArtDrawingShape[] {
	const flat = flattenNodes([...nodes]);
	const family = layoutResult.family;
	const shapes: PptxSmartArtDrawingShape[] = [];

	for (let i = 0; i < layoutResult.nodes.length; i++) {
		const rn = layoutResult.nodes[i];
		const sourceNode = flat[i];
		const nodeId = sourceNode?.id ?? rn.key;
		shapes.push(renderedNodeToShape(rn, nodeId, family));
	}

	return shapes;
}

/**
 * Rebuild drawing shapes from the algorithmic layout engine when they have been
 * cleared by a structural edit (add/remove/reorder/text/style change on a node).
 *
 * Returns the original data unchanged when drawing shapes are already populated
 * or when there are no nodes to lay out.
 *
 * @param smartArtData  - The updated SmartArt data (with cleared drawingShapes).
 * @param layout        - Named layout preset from the element (may be undefined).
 * @param palette       - Resolved colour palette (hex strings).
 * @param style         - Resolved SmartArt style intensity.
 * @param elementId     - Element ID used for stable SVG key generation.
 * @param box           - Pixel bounding box of the element.
 */
export function rebuildDrawingShapesIfCleared(
	smartArtData: PptxSmartArtData,
	layout: SmartArtLayout | undefined,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
	box: BoundingBox,
): PptxSmartArtData {
	const shapes = smartArtData.drawingShapes;

	// Skip when:
	// - shapes is undefined: the element never had drawing shapes (freshly
	//   inserted); the family SVG renderer handles display from node data.
	// - shapes is populated (length > 0): already current, no rebuild needed.
	// - no nodes: nothing to lay out.
	if (shapes === undefined || shapes.length > 0 || smartArtData.nodes.length === 0) {
		return smartArtData;
	}

	// shapes is an empty array [] -- a structural edit cleared previously-
	// populated shapes. Rebuild them from the algorithmic layout engine.
	const layoutResult = computeSmartArtLayout(
		smartArtData.nodes,
		box,
		palette,
		style,
		elementId,
		smartArtData.resolvedLayoutType,
		layout,
	);

	return {
		...smartArtData,
		drawingShapes: reflowToDrawingShapes(layoutResult, smartArtData.nodes),
	};
}
