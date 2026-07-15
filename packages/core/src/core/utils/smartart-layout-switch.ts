import type { PptxSmartArtData, PptxSmartArtDrawingShape, SmartArtLayoutType } from '../types';

/**
 * Supported layout types for the visual layout switcher.
 *
 * These are the layout categories that have a working reflow implementation in
 * `reflowSmartArtLayout` (see `smartart-editing-reflow*`), so switching to any
 * of them re-lays-out the diagram while preserving node data and connections.
 * Every entry below has a matching `case` in the reflow dispatcher:
 *   list, process, hierarchy, cycle, matrix, pyramid, funnel, target, gear,
 *   venn, timeline, relationship, chevron, bending.
 *
 * `unknown` is intentionally excluded (it has no meaningful target layout).
 */
export const SWITCHABLE_LAYOUT_TYPES: readonly SmartArtLayoutType[] = [
	'list',
	'process',
	'hierarchy',
	'cycle',
	'matrix',
	'pyramid',
	'funnel',
	'target',
	'gear',
	'venn',
	'timeline',
	'relationship',
	'chevron',
	'bending',
] as const;

/**
 * Switch a SmartArt diagram to a new layout type while preserving node data.
 *
 * This function creates a new `PptxSmartArtData` with the layout type changed
 * but all node content, connections, colours, and styles intact.
 *
 * @param currentData The existing SmartArt data
 * @param newLayoutType The target layout category
 * @returns Updated SmartArt data with the new layout applied
 */
export function switchSmartArtLayout(
	currentData: PptxSmartArtData,
	newLayoutType: SmartArtLayoutType,
): PptxSmartArtData {
	// If the layout is already the target, return as-is
	if (currentData.resolvedLayoutType === newLayoutType) {
		return currentData;
	}

	return {
		...currentData,
		// Clear the raw layoutType string since the user is explicitly
		// choosing a resolved category - this avoids the heuristic
		// re-resolve overriding their choice.
		layoutType: newLayoutType,
		resolvedLayoutType: newLayoutType,
		// Clear the named layout preset - switching category invalidates it
		layout: undefined,
		layoutDirty: true,
		drawingDirty: true,
		// Mark stale pre-computed drawing shapes from the old layout so the
		// reflow pipeline (rebuildDrawingShapesIfCleared) regenerates them for
		// the new layout type. If the element never had drawing shapes (freshly
		// inserted), leave undefined so the family SVG renderer handles it
		// without triggering a lossy polygon-to-chevron reflow.
		drawingShapes: markShapesStale(currentData.drawingShapes),
		// Preserve everything else: nodes, connections, colours, styles, chrome, etc.
	};
}

/**
 * Mark drawing shapes as stale (needs rebuild) when they were previously
 * populated, or leave undefined when they never existed.
 */
function markShapesStale(
	shapes: PptxSmartArtDrawingShape[] | undefined,
): PptxSmartArtDrawingShape[] | undefined {
	return shapes !== undefined && shapes.length > 0 ? [] : undefined;
}

/**
 * Check whether a layout type is one of the supported switchable types.
 */
export function isSwitchableLayoutType(layoutType: SmartArtLayoutType): boolean {
	return (SWITCHABLE_LAYOUT_TYPES as readonly string[]).includes(layoutType);
}
