/**
 * Which 3D pipeline a SmartArt quick style needs, decided from the cached
 * drawing alone (framework-agnostic, pure).
 *
 * PowerPoint caches three shapes of quick style in `ppt/diagrams/drawing*.xml`:
 *
 * - **flat** (Simple Fill .. Intense Effect): no `a:sp3d` on any shape.
 * - **bevel** (Polished, Inset, Cartoon, Powder): every shape carries its own
 *   `a:scene3d` (always `orthographicFront`) plus an `a:sp3d` bevel, so the
 *   2D layout stays undistorted and only the edges are lit.
 * - **scene** (Brick, Flat, Metallic, Sunset, Bird's Eye Scene): shapes carry
 *   only `a:sp3d`; the one camera for the whole diagram lives in the quick
 *   style part (`dgm:styleDef/dgm:scene3d`).
 *
 * Working rule: any shape with `scene3d` -> bevel; else any shape with a
 * non-empty `shape3d` -> scene; else flat.
 *
 * @module render/smartart-3d-style-path
 */
import type { Pptx3DShape, PptxSmartArtDrawingShape } from 'pptx-viewer-core';

import type { SmartArt3DStyleCategory } from './smartart-3d-types';

/** Whether an `a:sp3d` carries anything that changes the rendered solid. */
export function hasSmartArtShape3D(shape3d: Pptx3DShape | undefined): boolean {
	if (!shape3d) {
		return false;
	}
	return (
		(shape3d.extrusionHeight ?? 0) > 0 ||
		(shape3d.contourWidth ?? 0) > 0 ||
		(shape3d.bevelTopWidth ?? 0) > 0 ||
		(shape3d.bevelTopHeight ?? 0) > 0 ||
		shape3d.bevelTopType !== undefined ||
		(shape3d.bevelBottomWidth ?? 0) > 0 ||
		shape3d.bevelBottomType !== undefined
	);
}

/** Decide the 3D pipeline for a SmartArt's cached drawing shapes. */
export function resolveSmartArt3DStylePath(
	shapes: readonly Pick<PptxSmartArtDrawingShape, 'scene3d' | 'shape3d'>[],
): SmartArt3DStyleCategory {
	if (shapes.some((shape) => shape.scene3d !== undefined)) {
		return 'bevel';
	}
	if (shapes.some((shape) => hasSmartArtShape3D(shape.shape3d))) {
		return 'scene';
	}
	return 'flat';
}
