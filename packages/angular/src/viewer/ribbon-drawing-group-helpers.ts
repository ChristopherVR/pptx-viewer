/**
 * ribbon-drawing-group-helpers.ts: pure readers/patch-builders for the Home
 * tab Drawing group's Fill/Outline swatch pickers.
 *
 * Split out of `ribbon-drawing-group.component.ts` (which is already over
 * this repo's 300-LOC file budget) so wiring the theme-colour grid did not
 * have to grow that file further; the component re-exports these for the
 * existing test import surface.
 *
 * @module viewer/ribbon-drawing-group-helpers
 */
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, ShapeStyle } from 'pptx-viewer-core';

const DEFAULT_FILL_COLOR = '#ffffff',
	DEFAULT_OUTLINE_COLOR = '#000000';

/** Fill/Outline only apply to an editable, selected shape-like element. */
export function canFormatShapeSelection(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element !== null && hasShapeProperties(element);
}

/** The colour the Fill swatch dot shows for the current selection. */
export function fillColorOf(element: PptxElement | null): string {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_FILL_COLOR;
	}
	return element.shapeStyle?.fillColor ?? DEFAULT_FILL_COLOR;
}

/** The colour the Outline swatch dot shows for the current selection. */
export function outlineColorOf(element: PptxElement | null): string {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_OUTLINE_COLOR;
	}
	return element.shapeStyle?.strokeColor ?? DEFAULT_OUTLINE_COLOR;
}

/** The selection's stored fill theme ref, if any (highlights the matching theme swatch). */
export function fillColorRefOf(element: PptxElement | null): PptxThemeColorRef | undefined {
	if (element === null || !hasShapeProperties(element)) {
		return undefined;
	}
	return element.shapeStyle?.fillColorRef;
}

/** The selection's stored outline theme ref, if any (highlights the matching theme swatch). */
export function outlineColorRefOf(element: PptxElement | null): PptxThemeColorRef | undefined {
	if (element === null || !hasShapeProperties(element)) {
		return undefined;
	}
	return element.shapeStyle?.strokeColorRef;
}

/**
 * The element patch a Fill/Outline swatch pick commits, or `undefined` when
 * the selection has no shape style to patch. Merges into the EXISTING
 * `shapeStyle` (not a replace) so picking a fill colour never clears an
 * already-set outline, and vice versa.
 */
export function shapeStylePatch(
	element: PptxElement | null,
	style: Partial<ShapeStyle>,
): Partial<PptxElement> | undefined {
	if (element === null || !hasShapeProperties(element)) {
		return undefined;
	}
	return { shapeStyle: { ...element.shapeStyle, ...style } } as Partial<PptxElement>;
}
