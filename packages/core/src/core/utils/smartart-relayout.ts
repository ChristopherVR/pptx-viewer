/**
 * SmartArt relayout on edit.
 *
 * When SmartArt nodes are added, removed, or reordered the layout needs
 * re-evaluation. This module provides the single entry-point
 * `relayoutSmartArt`, which delegates to
 * `computeSmartArtElementsWithoutCache` (the DiagramML interpreter when a
 * recognised `layoutDefinition` is present, falling back through the same
 * algorithmic/heuristic chain the save pipeline uses) and converts the
 * `PptxElement[]` output back to `PptxSmartArtDrawingShape[]` so the
 * rendering pipeline can consume it directly.
 *
 * @module smartart-relayout
 */

import { smartArtElementsToDrawingShapes } from '../core/runtime/smartart-fabrication-drawing';
import type { PptxSmartArtData, PptxSmartArtDrawingShape } from '../types';
import { computeSmartArtElementsWithoutCache, decomposeSmartArt } from './smartart-decompose';
import { applySmartArtQuickStyle3d } from './smartart-quick-style-3d';

/**
 * Re-evaluate SmartArt layout after an editing operation.
 *
 * Delegates to `computeSmartArtElementsWithoutCache`, then converts its
 * shapes back to `PptxSmartArtDrawingShape[]` for the rendering pipeline.
 * Non-shape elements (connectors) are dropped, matching the existing
 * convention for cached drawing shapes. Falls back to the existing
 * `drawingShapes`, unchanged, when nothing can be computed (e.g. every node
 * has empty text, or the layout type is unrecognised).
 *
 * The recomputed shapes carry the quick style's per-label 3D
 * ({@link applySmartArtQuickStyle3d}), so a bevel / scene styled diagram
 * stays 3D after a node is added, removed or reordered.
 *
 * @param smartArtData    - The SmartArt data model (nodes, layout type, etc.).
 * @param containerWidth  - Width of the container on the slide (pixels).
 * @param containerHeight - Height of the container on the slide (pixels).
 * @returns Array of drawing shapes with recalculated positions.
 */
export function relayoutSmartArt(
	smartArtData: PptxSmartArtData,
	containerWidth: number,
	containerHeight: number,
): PptxSmartArtDrawingShape[] {
	if (!smartArtData.nodes || smartArtData.nodes.length === 0) {
		return [];
	}
	const elements = computeSmartArtElementsWithoutCache(smartArtData, {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight,
	});
	if (!elements || elements.length === 0) {
		return smartArtData.drawingShapes ?? [];
	}
	return applySmartArtQuickStyle3d(smartArtElementsToDrawingShapes(elements), smartArtData);
}

/**
 * The drawing shapes the save pipeline caches for a SmartArt whose cached
 * drawing was dropped (a structural edit) or never existed (SDK-created):
 * the decompose/layout output, plus the quick style's per-label 3D the way
 * PowerPoint bakes it onto each shape when it re-lays out a diagram.
 */
export function regenerateSmartArtDrawingShapes(
	smartArtData: PptxSmartArtData,
	containerWidth: number,
	containerHeight: number,
): PptxSmartArtDrawingShape[] {
	const elements = decomposeSmartArt(smartArtData, {
		x: 0,
		y: 0,
		width: Math.max(containerWidth, 1),
		height: Math.max(containerHeight, 1),
	});
	return applySmartArtQuickStyle3d(smartArtElementsToDrawingShapes(elements), smartArtData);
}
