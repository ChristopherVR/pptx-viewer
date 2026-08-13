/**
 * The one-call form of {@link rebuildDrawingShapesIfCleared} that every edit
 * commit path actually wants.
 *
 * A structural SmartArt edit (add / remove / promote / demote / reorder / style
 * / layout switch) clears `drawingShapes` to `[]`, which tells the renderer the
 * cached `dsp` geometry is stale. `rebuildDrawingShapesIfCleared` regenerates it
 * from the DiagramML interpreter so the richer cached-shape path stays active
 * instead of dropping to the family approximation. Its six arguments are always
 * derived from the same updated data, so passing them by hand at every commit
 * site is how two bindings came to skip the call entirely.
 *
 * @module smartart-reflow-element
 */

import type { PptxSmartArtData } from 'pptx-viewer-core';

import { resolvePalette } from './smartart-drawing';
import type { BoundingBox } from './smartart-layout-types';
import { rebuildDrawingShapesIfCleared } from './smartart-reflow-to-shapes';

/**
 * Reflow a SmartArt element's cached drawing shapes after an edit, if the edit
 * cleared them.
 *
 * Returns the data unchanged when the cached drawing is still populated, when
 * the element never had one (`drawingShapes === undefined`), or when there are
 * no nodes: the F20 precedence rule that the cached `dsp` drawing always wins
 * over recomputation is preserved exactly.
 *
 * @param data      - The SmartArt data as the edit left it.
 * @param elementId - Owning element id, used for stable SVG keys.
 * @param box       - Pixel bounding box of the element.
 */
export function reflowSmartArtData(
	data: PptxSmartArtData,
	elementId: string,
	box: BoundingBox,
): PptxSmartArtData {
	return rebuildDrawingShapesIfCleared(
		data,
		data.layout,
		resolvePalette(data),
		data.style ?? 'flat',
		elementId,
		box,
	);
}
