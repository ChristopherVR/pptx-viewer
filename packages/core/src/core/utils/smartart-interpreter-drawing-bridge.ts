/**
 * Bridge from the DiagramML interpreter's styled view-model geometry
 * (`SmartArtLayoutResult`) to standard `PptxElement[]` shapes, for the
 * save/decompose pipeline (`smartart-decompose.ts`).
 *
 * The interpreter's `RenderedNode` carries an on-screen-truncated label
 * (`truncate(node.text, 40)`, see `smartart-layout-style-helpers.ts`) because
 * it is built for compact SVG rendering. Baking that truncated, unstyled text
 * into a saved file would be a data-loss regression, so this bridge instead
 * joins each rendered shape back to its ORIGINAL `PptxSmartArtNode` (via
 * `RenderedNode.nodeId`) and uses its full text and per-run styling
 * (`projectSmartArtNodeText`) - the same source the OTHER decompose branches
 * already use.
 *
 * Connector geometry (`SmartArtLayoutResult.connectors`) is intentionally not
 * converted: PowerPoint reconstructs `dsp:cxn` connector shapes itself from
 * the data-model connections, matching the existing convention in
 * `smartArtElementsToDrawingShapes` (which also drops non-shape elements).
 */

import type { PptxElement, PptxSmartArtNode } from '../types';
import { nextId, makeShapeElement } from './smartart-helpers';
import type { SmartArtLayoutResult } from './smartart-layout-types';
import { projectSmartArtNodeText } from './smartart-node-text-projection';

/** Axis-aligned bounding box of an SVG polygon `points` string. */
function polygonBoundingBox(points: string): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	const pairs = points
		.trim()
		.split(/\s+/u)
		.filter((pair) => pair.length > 0)
		.map((pair) => pair.split(',').map(Number) as [number, number]);
	const xs = pairs.map(([x]) => x);
	const ys = pairs.map(([, y]) => y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const maxX = Math.max(...xs);
	const maxY = Math.max(...ys);
	return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * Convert the interpreter's result into `PptxElement[]` shapes offset into
 * `containerBounds`, using each rendered node's original data-model node for
 * its full (untruncated, per-run-styled) text.
 *
 * @param result          - Interpreter output (`interpretSmartArtLayout`).
 * @param nodes           - The full node set the interpreter arranged from
 *                          (used to resolve each `RenderedNode.nodeId`).
 * @param containerBounds - The SmartArt graphic frame's bounds on the slide;
 *                          the interpreter's own geometry is already sized to
 *                          the frame, so only an offset is needed (no scale).
 */
export function interpretedLayoutToElements(
	result: SmartArtLayoutResult,
	nodes: PptxSmartArtNode[],
	containerBounds: { x: number; y: number },
): PptxElement[] {
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const elements: PptxElement[] = [];

	for (const rendered of result.nodes) {
		const node = rendered.nodeId ? nodeById.get(rendered.nodeId) : undefined;
		const text = node?.text ?? '';
		const fontSize = rendered.fontSize;
		const textSegments = node
			? projectSmartArtNodeText(node, { fontSize: fontSize * (96 / 72) })
			: undefined;
		// Embed the node id (`sa-interp-<nodeId>`), matching the convention
		// `resolveShapeModelId` (smartart-fabrication-drawing.ts) already relies
		// on for the OTHER decompose branches ("Layout-engine shapes embed the
		// node id in their id"), so the fabricated `dsp:sp` still resolves the
		// right presentation-point GUID even if node order ever diverges from
		// the shape order.
		const id = rendered.nodeId ? `sa-interp-${rendered.nodeId}` : nextId('sa-interp');
		const common = {
			strokeColor: rendered.stroke,
			strokeWidth: rendered.strokeWidth,
			fontSize,
			fontColor: rendered.fontColor ?? '#FFFFFF',
			textSegments,
			rotation: rendered.rotation,
		};

		if (rendered.kind === 'rect') {
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + rendered.x,
					containerBounds.y + rendered.y,
					rendered.width,
					rendered.height,
					'roundRect',
					rendered.fill,
					text,
					common,
				),
			);
		} else if (rendered.kind === 'circle') {
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + rendered.cx - rendered.r,
					containerBounds.y + rendered.cy - rendered.r,
					rendered.r * 2,
					rendered.r * 2,
					'ellipse',
					rendered.fill,
					text,
					common,
				),
			);
		} else {
			// Every polygon the interpreter currently emits is a pyramid
			// trapezoid band; the `trapezoid` preset (already used by the
			// algorithmic pyramid layout in `smartart-layouts.ts`) reproduces
			// that shape from a bounding box without hand-built custom geometry.
			const bbox = polygonBoundingBox(rendered.points);
			elements.push(
				makeShapeElement(
					id,
					containerBounds.x + bbox.x,
					containerBounds.y + bbox.y,
					bbox.width,
					bbox.height,
					'trapezoid',
					rendered.fill,
					text,
					common,
				),
			);
		}
	}

	return elements;
}
