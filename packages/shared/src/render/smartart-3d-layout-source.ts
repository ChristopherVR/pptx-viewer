/**
 * SmartArt 3D - which 2D geometry the 3D model is built from.
 *
 * The SVG renderers prefer the cached `dsp:` drawing (`smartArtData.drawingShapes`,
 * PowerPoint's own layout output, with the deck's real theme fills) and only
 * run the layout engine when a deck carries no cache. The 3D scene used to
 * ALWAYS run the layout engine, so the same element rendered with different
 * geometry and different colours the moment the scene was switched on, and a
 * diagram that had been saved and reopened (which then carries both a cache
 * and a `layoutDefinition`) could change shape entirely. This module gives
 * the 3D path the same preference order: cached drawing first, engine second.
 */

import type { PptxSmartArtDrawingShape, PptxSmartArtNode, SmartArtStyle } from 'pptx-viewer-core';

import { parsePathPoints } from './smartart-3d-geom';
import { computeDrawingViewBox, projectDrawingShapes } from './smartart-drawing';
import type { RenderedShape } from './smartart-drawing';
import { computeSmartArtElementLayout } from './smartart-layout';
import type { SmartArtElementLayoutSource } from './smartart-layout';
import { resolveLayoutFamily } from './smartart-layout-family-map';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** The subset of `PptxSmartArtData` this module reads. */
export type SmartArt3DLayoutSource = SmartArtElementLayoutSource & {
	drawingShapes?: PptxSmartArtDrawingShape[];
};

/** `xMidYMid meet` mapping of the cached drawing's box onto the element box. */
function fitDrawingToBox(
	drawing: { width: number; height: number },
	box: BoundingBox,
): { scale: number; offsetX: number; offsetY: number } {
	const scale = Math.min(box.width / drawing.width, box.height / drawing.height) || 1;
	return {
		scale,
		offsetX: (box.width - drawing.width * scale) / 2,
		offsetY: (box.height - drawing.height * scale) / 2,
	};
}

/** The solid colour a 3D face can be painted with, or `null` for an unpainted shape. */
function solidFill(shape: PptxSmartArtDrawingShape, rendered: RenderedShape): string | null {
	if (shape.fillNone || rendered.fill === 'none') {
		return null;
	}
	if (rendered.gradient) {
		return rendered.gradient.stops[0]?.color ?? shape.fillColor ?? null;
	}
	return rendered.fill;
}

/** One cached shape as a rendered node in element-box coordinates. */
function drawingShapeNode(
	shape: PptxSmartArtDrawingShape,
	rendered: RenderedShape,
	fit: { scale: number; offsetX: number; offsetY: number },
): RenderedNode | null {
	const fill = solidFill(shape, rendered);
	if (!fill) {
		return null;
	}
	const { scale, offsetX, offsetY } = fit;
	const sx = (x: number): number => offsetX + x * scale;
	const sy = (y: number): number => offsetY + y * scale;
	const base = {
		key: rendered.key,
		fill,
		stroke: rendered.stroke,
		strokeWidth: rendered.strokeWidth * scale,
		opacity: 1,
		text: shape.text ?? '',
		fontSize: rendered.fontSize * scale,
		textX: sx(rendered.textX),
		textY: sy(rendered.textY),
	};
	if (rendered.kind === 'ellipse') {
		return {
			...base,
			kind: 'circle',
			cx: sx(rendered.cx),
			cy: sy(rendered.cy),
			r: (Math.min(rendered.width, rendered.height) / 2) * scale,
			rx: (rendered.width / 2) * scale,
			ry: (rendered.height / 2) * scale,
		};
	}
	if (rendered.kind === 'path' && rendered.pathData) {
		// Preset outlines (chevrons, arrows, ...) are straight-segment paths in
		// the shape's own box; extrude the outline rather than a bounding rect.
		const pts = parsePathPoints(rendered.pathData);
		if (pts.length >= 3) {
			return {
				...base,
				kind: 'polygon',
				points: pts.map((p) => `${sx(rendered.x + p.x)},${sy(rendered.y + p.y)}`).join(' '),
			};
		}
	}
	return {
		...base,
		kind: 'rect',
		x: sx(rendered.x),
		y: sy(rendered.y),
		width: rendered.width * scale,
		height: rendered.height * scale,
		rx: rendered.rx * scale,
	};
}

/**
 * Layout geometry for the 3D model from the cached drawing, in element-box
 * coordinates (the drawing is fitted `xMidYMid meet`, exactly as the SVG
 * renderers place it), or `null` when the element carries no cache.
 */
export function drawingShapesLayoutResult(
	elementId: string,
	shapes: PptxSmartArtDrawingShape[] | undefined,
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	family: SmartArtLayoutResult['family'],
): SmartArtLayoutResult | null {
	if (!shapes || shapes.length === 0) {
		return null;
	}
	const viewBox = computeDrawingViewBox(shapes);
	const fit = fitDrawingToBox(viewBox, box);
	const rendered = projectDrawingShapes(elementId, shapes, viewBox, palette, style);
	const nodes: RenderedNode[] = [];
	rendered.forEach((r, i) => {
		const node = drawingShapeNode(shapes[i], r, fit);
		if (node) {
			nodes.push(node);
		}
	});
	if (nodes.length === 0) {
		return null;
	}
	return {
		nodes,
		connectors: [],
		shadowFilter: undefined,
		viewBox: `0 0 ${box.width} ${box.height}`,
		family,
	};
}

/**
 * The geometry the 3D model should be built from: the cached drawing when
 * the element has one (same source, same colours as the SVG renderers),
 * otherwise the shared layout engine.
 */
export function resolveSmartArt3DLayout(
	smartArtData: SmartArt3DLayoutSource,
	nodes: PptxSmartArtNode[],
	box: BoundingBox,
	palette: string[],
	style: SmartArtStyle,
	elementId: string,
): SmartArtLayoutResult {
	const family = resolveLayoutFamily(nodes, smartArtData.resolvedLayoutType, smartArtData.layout);
	return (
		drawingShapesLayoutResult(elementId, smartArtData.drawingShapes, box, palette, style, family) ??
		computeSmartArtElementLayout(smartArtData, nodes, box, palette, style, elementId)
	);
}
