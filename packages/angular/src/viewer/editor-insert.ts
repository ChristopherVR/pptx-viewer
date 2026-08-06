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

import { DEFAULT_INSERT_CHART_KIND, createDefaultChartElement } from '../internal/shared';
import type { InsertChartKind, ShapePresetType } from '../internal/shared';

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
 * @param chartKind - The insert-dropdown entry to create ('column' yields
 *   vertical columns, 'bar' horizontal bars); a raw `PptxChartType` is still
 *   accepted for callers that predate the dropdown ids.
 */
export function newChartElement(
	chartKind: InsertChartKind | PptxChartType = DEFAULT_INSERT_CHART_KIND,
): PptxElement {
	return { ...createDefaultChartElement(chartKind), id: '' } as PptxElement;
}

/**
 * Create a new shape element for any Insert > Shapes picker preset geometry.
 *
 * The shared `newShapeElement` only covers the rect/ellipse/line trio used by
 * the Insert tab quick buttons; this factory accepts the full shared preset
 * catalogue ({@link ShapePresetType}) offered by the Home tab Shapes dropdown.
 * Defaults mirror React's toolbar insert path (`useInsertElements.handleAddShape`):
 * same position, size, and blue fill / dark stroke, so the dropdown inserts
 * identically across bindings. The id is `''` so
 * `EditorStateService.addElement` assigns a real one.
 *
 * @param shapeType - Preset geometry (OOXML `a:prstGeom` value) to insert.
 * @param name - Element name; defaults to the capitalised preset type.
 */
export function newPresetShapeElement(shapeType: ShapePresetType, name?: string): PptxElement {
	return {
		type: 'shape',
		id: '',
		name: name ?? shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
		x: 150,
		y: 150,
		width: 200,
		height: 150,
		shapeType,
		shapeStyle: {
			fillColor: '#3b82f6',
			strokeColor: '#1f2937',
			strokeWidth: 2,
		},
	} as PptxElement;
}
