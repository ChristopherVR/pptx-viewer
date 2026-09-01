/**
 * `arrange-extras` - the pure gating logic behind the ribbon's Arrange group
 * shape-level extras: Group, Ungroup, and the outline-width spinner.
 *
 * WHY this lives in shared: `canGroupSelection`, `canUngroupSelection`,
 * `canSetStrokeWidth`, and `strokeWidthOf` were hand-ported, near-verbatim,
 * into React's `ShapeArrangeExtras.tsx`, Vue's `ShapeArrangeExtras.vue`,
 * Angular's `ribbon-shape-extras.component.ts`, Svelte's `ArrangeExtras.svelte`,
 * and vanilla's `arrange-extras.ts`. A pure decision function here is fixed
 * once for all five bindings and can no longer drift.
 *
 * NOTE: this covers only the ribbon's shape-extras gate, which requires an
 * editable deck (`canEdit`) up front. A second, unrelated family exists (Vue's
 * `useAlignGroup` composable and Angular's `EditorToolbarComponent`) that
 * gates Group/Ungroup on selection count alone, with no `canEdit` check; see
 * the module doc in the fix report for the discrepancy.
 *
 * @module render/arrange-extras
 */
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

/** Outline thickness the renderer assumes when the shape declares none. */
export const DEFAULT_STROKE_WIDTH = 1;

/** Grouping needs an editable deck and at least two selected elements. */
export function canGroupSelection(canEdit: boolean, selectedCount: number): boolean {
	return canEdit && selectedCount >= 2;
}

/** Ungrouping needs an editable deck and a selection that IS a group. */
export function canUngroupSelection(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element?.type === 'group';
}

/** An outline width only exists on an element that carries shape properties. */
export function canSetStrokeWidth(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element !== null && hasShapeProperties(element);
}

/** The stroke width to show for a selection, defaulted for a shape without one. */
export function strokeWidthOf(element: PptxElement | null): number {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_STROKE_WIDTH;
	}
	return element.shapeStyle?.strokeWidth ?? DEFAULT_STROKE_WIDTH;
}
