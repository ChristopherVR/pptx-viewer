/**
 * SmartArt relayout on edit.
 *
 * When SmartArt nodes are added, removed, or reordered the layout needs
 * re-evaluation.  This module provides the single entry-point
 * `relayoutSmartArt` which delegates to the layout engine and converts
 * the output back to `PptxSmartArtDrawingShape[]` so the rendering
 * pipeline can consume it directly.
 *
 * @module smartart-relayout
 */

import type { PptxSmartArtData, PptxSmartArtDrawingShape, SmartArtLayoutType } from '../types';
import type { ContainerBounds } from './smartart-helpers';
import { computeSmartArtLayout, layoutEngineShapesToDrawingShapes } from './smartart-layout-engine';

/**
 * Re-evaluate SmartArt layout after an editing operation.
 *
 * Delegates to the layout engine to compute new positions for every node
 * based on the current `resolvedLayoutType` (or raw `layoutType` string),
 * then converts the engine output to `PptxSmartArtDrawingShape[]` for the
 * rendering pipeline.
 *
 * If the layout type is unsupported or the engine returns no results the
 * existing `drawingShapes` are returned unchanged as a fallback.
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
	// When there are no nodes at all, return an empty array.
	if (!smartArtData.nodes || smartArtData.nodes.length === 0) {
		return [];
	}

	const bounds: ContainerBounds = {
		x: 0,
		y: 0,
		width: containerWidth,
		height: containerHeight,
	};

	// Attempt layout engine computation.
	const engineShapes = computeSmartArtLayout(smartArtData, bounds);

	if (engineShapes && engineShapes.length > 0) {
		const layoutType: SmartArtLayoutType = smartArtData.resolvedLayoutType ?? 'list';

		return layoutEngineShapesToDrawingShapes(engineShapes, smartArtData.nodes, layoutType);
	}

	// Fallback: return existing drawingShapes unchanged when the engine
	// cannot compute a layout (e.g. unsupported or unknown type).
	return smartArtData.drawingShapes ?? [];
}
