/**
 * 3D (scene3d/sp3d) extraction for SmartArt cached drawing shapes
 * (`ppt/diagrams/drawing*.xml`, `dsp:sp`).
 *
 * PowerPoint bakes each shape's fully-resolved extrusion/bevel/contour
 * (`a:sp3d`) directly onto its cached `dsp:spPr`, for every non-flat quick
 * style. Bevel quick styles (Polished, Inset, Cartoon, Powder) also cache a
 * per-shape `a:scene3d` (always `orthographicFront`, so the 2D layout is
 * undistorted); Scene quick styles (Brick, Flat, Metallic, Sunset, Bird's Eye)
 * instead put ONE camera on the whole diagram
 * (`PptxSmartArtQuickStyle.scene3d`) and cache no per-shape scene3d at all.
 * A rare few scene styles (Bird's Eye) also extrude the label text itself via
 * `dsp:txBody/a:bodyPr/a:sp3d`.
 *
 * Reuses the SAME parse logic an ordinary shape's `p:spPr/a:scene3d|a:sp3d`
 * goes through (`core/builders/shape-style-3d-helpers.ts`), and the same
 * `a:bodyPr/a:sp3d` text-extrusion parser ordinary text bodies use
 * (`core/utils/text-body-sp3d.ts`), so no 3D parsing logic is duplicated.
 *
 * @module pptx-runtime/smartart-drawing-shape-3d
 */

import type { Pptx3DScene, Pptx3DShape, Text3DStyle, TextStyle, XmlObject } from '../../types';
import { parseTextBodySp3d } from '../../utils/text-body-sp3d';
import { parsePptx3DScene, parsePptx3DShape } from '../builders/shape-style-3d-helpers';
import type { DrawingShapeStyleDeps } from './smartart-drawing-shape-style';

/** 3D fields resolved from a cached drawing shape's `spPr` and `bodyPr`. */
export interface DrawingShape3d {
	scene3d?: Pptx3DScene;
	shape3d?: Pptx3DShape;
	text3d?: Text3DStyle;
}

/**
 * Resolve `a:scene3d` / `a:sp3d` from a cached drawing shape's `spPr`, and
 * `a:sp3d` from its `txBody/bodyPr`, into {@link DrawingShape3d}.
 */
export function extractDrawingShape3d(
	spPr: XmlObject,
	txBody: XmlObject | undefined,
	deps: DrawingShapeStyleDeps,
): DrawingShape3d {
	const result: DrawingShape3d = {};

	const scene3dNode = deps.getChild(spPr, 'scene3d');
	if (scene3dNode) {
		result.scene3d = parsePptx3DScene(scene3dNode);
	}

	const shape3dNode = deps.getChild(spPr, 'sp3d');
	if (shape3dNode) {
		result.shape3d = parsePptx3DShape(shape3dNode, deps.parseColor);
	}

	const bodyPr = txBody ? deps.getChild(txBody, 'bodyPr') : undefined;
	if (bodyPr) {
		const textStyle: TextStyle = {};
		parseTextBodySp3d(bodyPr, textStyle, deps.parseColor);
		if (textStyle.text3d) {
			result.text3d = textStyle.text3d;
		}
	}

	return result;
}
