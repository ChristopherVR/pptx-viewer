/**
 * Three.js SmartArt renderer - pure model builder for the CACHED DRAWING path.
 *
 * Converts a SmartArt element's cached `drawingShapes` (`ppt/diagrams/
 * drawing*.xml`, the exact geometry PowerPoint itself drew and the 2D SVG
 * renderer already projects via {@link projectDrawingShapes}) into a
 * framework/three-agnostic {@link SmartArt3DModel}. This is the PREFERRED
 * source for the 3D renderer (PowerPoint parity): the layout-engine path in
 * `smartart-3d-model.ts` is a fallback for elements with no cached drawing.
 *
 * FLAT quick styles (Simple Fill, White Outline, Subtle, Moderate, Intense):
 * every shape is coplanar (z separated only by a tiny per-paint-order epsilon
 * to avoid z-fighting where SmartArt stacks an unfilled label shape over a
 * painted one), unlit, and framed by an orthographic camera matching the 2D
 * SVG viewBox exactly. BEVEL and SCENE quick styles (see
 * `resolveSmartArt3DStylePath`) keep the same meshes and add a lit solid,
 * gradient, light rig and (scene only) a whole-diagram camera, via
 * `smartart-3d-drawing-solid.ts`.
 *
 * No `three` import: this module returns plain data: three.js Shape/geometry
 * construction happens in `smartart-3d/view-scene.ts`, which has `ctx.three`.
 *
 * @module render/smartart-3d-drawing-model
 */
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from 'pptx-viewer-core';

import { decorateSmartArt3DMesh, resolveSmartArt3DSceneSetup } from './smartart-3d-drawing-solid';
import { ellipseOutline, rectOutline } from './smartart-3d-primitive-outline';
import { resolveSmartArt3DStylePath } from './smartart-3d-style-path';
import type {
	Point2,
	SmartArt3DMesh,
	SmartArt3DModel,
	SmartArt3DTextBlock,
} from './smartart-3d-types';
import { computeDrawingViewBox, projectDrawingShapes, resolvePalette } from './smartart-drawing';
import type { RenderedShape } from './smartart-drawing';
import { drawingShapeMeshOpacity } from './smartart-drawing-label-color';
import { flattenSvgPath } from './svg-path-flatten';

/** Small world-space z step between successively painted (stacked) shapes. */
const Z_STEP = 0.6;
/** z offset a text block sits in front of its shape's face. */
const TEXT_Z_LIFT = 0.4;

/** Rotate/flip a point around `(cx, cy)`, matching `drawingShapeTransform`'s SVG semantics. */
function applyShapeTransform(
	p: Point2,
	cx: number,
	cy: number,
	rotationDeg: number | undefined,
	flipH: boolean | undefined,
	flipV: boolean | undefined,
): Point2 {
	let x = p.x;
	let y = p.y;
	if (flipH) {
		x = 2 * cx - x;
	}
	if (flipV) {
		y = 2 * cy - y;
	}
	if (rotationDeg) {
		const rad = (rotationDeg * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const dx = x - cx;
		const dy = y - cy;
		x = cx + dx * cos - dy * sin;
		y = cy + dx * sin + dy * cos;
	}
	return { x, y };
}

/** The absolute (viewBox-relative, y-down) outer loop + holes for one rendered shape. */
function absoluteLoops(shape: PptxSmartArtDrawingShape, rendered: RenderedShape): Point2[][] {
	let loops: Point2[][];
	if (rendered.kind === 'ellipse') {
		loops = [ellipseOutline(rendered.cx, rendered.cy, rendered.width / 2, rendered.height / 2)];
	} else if (rendered.kind === 'path' && rendered.pathData) {
		// `pathData` is authored in the shape's own 0..width,0..height local
		// frame (see `getPresetShapeVectorGeometry`); place it at (x, y).
		loops = flattenSvgPath(rendered.pathData).map((loop) =>
			loop.map((p) => ({ x: p.x + rendered.x, y: p.y + rendered.y })),
		);
	} else {
		// 'rect' and 'image' (picture fills are drawn as a plain rect fallback).
		loops = [rectOutline(rendered.x, rendered.y, rendered.width, rendered.height, rendered.rx)];
	}
	return loops.map((loop) =>
		loop.map((p) =>
			applyShapeTransform(
				p,
				rendered.cx,
				rendered.cy,
				shape.rotation,
				shape.flipHorizontal,
				shape.flipVertical,
			),
		),
	);
}

/** Pick a flat fallback colour for a shape's fill: its resolved colour, or a gradient's first stop. */
function flatFillColor(rendered: RenderedShape): string | undefined {
	if (rendered.fill === 'none') {
		return undefined;
	}
	if (rendered.fill.startsWith('url(')) {
		return rendered.gradient?.stops[0]?.color;
	}
	return rendered.fill;
}

function buildTextBlock(
	rendered: RenderedShape,
	shape: PptxSmartArtDrawingShape,
	worldX: (x: number) => number,
	worldY: (y: number) => number,
	z: number,
): SmartArt3DTextBlock | undefined {
	if (
		rendered.textLines.length === 0 ||
		rendered.textLines.every((line) => line.text.length === 0)
	) {
		return undefined;
	}
	const center = applyShapeTransform(
		{ x: rendered.textX, y: rendered.textY },
		rendered.cx,
		rendered.cy,
		shape.rotation,
		shape.flipHorizontal,
		shape.flipVertical,
	);
	return {
		lines: rendered.textLines.map((line) => ({ text: line.text, dy: -(line.y - rendered.textY) })),
		x: worldX(center.x),
		y: worldY(center.y),
		z,
		maxWidth: rendered.textWidth,
		maxHeight: rendered.textHeight,
		color: rendered.fontColor,
		fontSize: rendered.fontSize,
		fontFamily: rendered.fontFamily,
		fontWeight: rendered.fontWeight,
		fontStyle: rendered.fontStyle,
	};
}

/** Build one flat mesh from a cached drawing shape + its 2D projection. */
function meshForDrawingShape(
	shape: PptxSmartArtDrawingShape,
	rendered: RenderedShape,
	index: number,
	viewW: number,
	viewH: number,
): SmartArt3DMesh {
	const worldX = (x: number): number => x - viewW / 2;
	const worldY = (y: number): number => viewH / 2 - y;
	const z = index * Z_STEP;

	const loops = absoluteLoops(shape, rendered);
	const outer = loops[0] ?? [];
	const holes = loops.slice(1);
	// Recentre on the shape's own (rotated) footprint centre so `position`
	// carries the world placement and `outline`/`holes` are mesh-local,
	// matching the layout-engine model's convention.
	const center = applyShapeTransform(
		{ x: rendered.cx, y: rendered.cy },
		rendered.cx,
		rendered.cy,
		shape.rotation,
		shape.flipHorizontal,
		shape.flipVertical,
	);
	const toLocal = (p: Point2): Point2 => ({ x: p.x - center.x, y: -(p.y - center.y) });

	const fill = flatFillColor(rendered);
	const textBlock = buildTextBlock(rendered, shape, worldX, worldY, z + TEXT_Z_LIFT);

	return {
		id: rendered.key,
		outline: outer.map(toLocal),
		holes: holes.map((loop) => loop.map(toLocal)),
		rounded: rendered.kind === 'ellipse',
		depth: 0,
		bevel: 0,
		flat: true,
		fill: fill ?? 'transparent',
		fillNone: fill === undefined,
		stroke: rendered.stroke === 'none' ? 'transparent' : rendered.stroke,
		strokeWidth: rendered.strokeWidth,
		opacity: drawingShapeMeshOpacity(shape),
		imageUrl: rendered.imageUrl,
		position: { x: worldX(center.x), y: worldY(center.y), z },
		rotation: { x: 0, y: 0, z: 0 },
		text: shape.text ?? '',
		textColor: rendered.fontColor,
		fontSize: rendered.fontSize,
		halfWidth: rendered.width / 2,
		halfHeight: rendered.height / 2,
		textBlock,
	};
}

/**
 * Map a viewBox point (y-down, before the shape's rotation / flip) into the
 * mesh-local space (y-up, centred on the shape's footprint centre).
 */
function toMeshLocal(p: Point2, shape: PptxSmartArtDrawingShape, rendered: RenderedShape): Point2 {
	const turned = applyShapeTransform(
		p,
		rendered.cx,
		rendered.cy,
		shape.rotation,
		shape.flipHorizontal,
		shape.flipVertical,
	);
	return { x: turned.x - rendered.cx, y: -(turned.y - rendered.cy) };
}

/**
 * Build the 3D model directly from a SmartArt element's cached
 * `drawingShapes`, or `undefined` when it has none (caller falls back to the
 * layout-engine model).
 */
export function buildSmartArt3DDrawingModel(data: PptxSmartArtData): SmartArt3DModel | undefined {
	const shapes = data.drawingShapes;
	if (!shapes || shapes.length === 0) {
		return undefined;
	}
	const viewBox = computeDrawingViewBox(shapes);
	const palette = resolvePalette(data);
	const rendered = projectDrawingShapes(
		'smartart3d',
		shapes,
		viewBox,
		palette,
		data.style ?? 'flat',
	);

	const category = resolveSmartArt3DStylePath(shapes);
	const meshes: SmartArt3DMesh[] = shapes.map((shape, i) => {
		const mesh = meshForDrawingShape(shape, rendered[i], i, viewBox.width, viewBox.height);
		if (category !== 'flat') {
			decorateSmartArt3DMesh(mesh, shape, rendered[i], (p) => toMeshLocal(p, shape, rendered[i]));
		}
		return mesh;
	});

	return {
		meshes,
		connectors: [],
		bounds: { width: viewBox.width, height: viewBox.height },
		background: data.chrome?.backgroundColor,
		styleCategory: category,
		...resolveSmartArt3DSceneSetup(data, category),
	};
}
