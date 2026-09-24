/**
 * The drawing shapes the 3D SmartArt scene uses for a diagram whose cached
 * drawing was dropped by a STRUCTURAL edit (add / remove / reorder a node).
 *
 * Such a diagram has no `drawingShapes` until it is saved, so without this it
 * fell back to the layout-engine 3D model, which knows nothing of the quick
 * style's bevel / scene 3D and rendered flat. Core's `relayoutSmartArt`
 * recomputes the shapes and re-applies the quick style's per-label 3D (the
 * same shapes the save caches), so the diagram keeps its bevel / scene look
 * both before and after save.
 *
 * @module render/smartart-3d-regenerated-drawing
 */
import type { PptxSmartArtData } from 'pptx-viewer-core';
import { relayoutSmartArt, smartArtQuickStyleHas3d } from 'pptx-viewer-core';

/**
 * `data` with regenerated, 3D-styled `drawingShapes` when its cached drawing
 * is gone and its quick style carries 3D; otherwise `data` itself (an intact
 * drawing, or a flat style that keeps the existing layout-engine path).
 */
export function withRegeneratedSmartArt3DDrawing(
	data: PptxSmartArtData,
	size: { width: number; height: number },
): PptxSmartArtData {
	if ((data.drawingShapes?.length ?? 0) > 0 || !smartArtQuickStyleHas3d(data.quickStyle)) {
		return data;
	}
	const drawingShapes = relayoutSmartArt(data, Math.max(size.width, 1), Math.max(size.height, 1));
	return drawingShapes.length > 0 ? { ...data, drawingShapes } : data;
}
