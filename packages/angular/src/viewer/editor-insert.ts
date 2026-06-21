/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure element-factory functions were extracted to `pptx-viewer-shared`
 * (`render/editor-insert`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so `editor-toolbar.component`,
 * `power-point-viewer.component`, `ribbon.component`, the colocated tests, and
 * any future importers are unchanged.
 */

import type { PptxChartType, PptxElement } from 'pptx-viewer-core';

import { createDefaultChartElement } from '../internal/shared';

export {
	newTextElement,
	newShapeElement,
	newTableElement,
	newSmartArtElement,
	newEquationElement,
} from '../internal/shared';

/**
 * SmartArt data-model editing operations, re-exported from `pptx-viewer-core`.
 *
 * These are the single source of truth for SmartArt mutations (add / remove /
 * text / reorder / promote / demote / layout switch); the Angular SmartArt
 * inspector (`smart-art-properties.component.ts` and its pure helper
 * `smart-art-properties-helpers.ts`) imports them from this barrel so the
 * binding never reimplements editing logic. Each returns a new immutable
 * `PptxSmartArtData` and clears `drawingShapes` to trigger layout reflow.
 */
export {
	addSmartArtNode,
	addSmartArtNodeAsChild,
	removeSmartArtNode,
	updateSmartArtNodeText,
	reorderSmartArtNode,
	promoteSmartArtNode,
	demoteSmartArtNode,
	switchSmartArtLayout,
	SWITCHABLE_LAYOUT_TYPES,
} from 'pptx-viewer-core';

/**
 * Create a new chart element with sensible defaults.
 *
 * Delegates to the shared `createDefaultChartElement` (the single source of
 * truth every binding uses): three sample categories, one "Series 1" with
 * sample values, the legend on, and a default position/size. The id is cleared
 * to `''` so `EditorStateService.addElement` assigns a real id, matching the
 * other factories surfaced by this shim.
 *
 * @param chartType - The chart family to create (bar, line, pie, etc.).
 */
export function newChartElement(chartType: PptxChartType): PptxElement {
	return { ...createDefaultChartElement(chartType), id: '' } as PptxElement;
}
