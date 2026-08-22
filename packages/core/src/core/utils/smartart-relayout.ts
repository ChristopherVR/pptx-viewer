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
import { computeSmartArtElementsWithoutCache } from './smartart-decompose';

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
	return smartArtElementsToDrawingShapes(elements);
}
