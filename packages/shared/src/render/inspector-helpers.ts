/**
 * inspector-helpers.ts: Pure (no framework) helpers for the inspector panel.
 *
 * Readers extract display values from a PptxElement (with sensible defaults),
 * and patch builders produce shallow-merge-ready Partial<PptxElement> objects
 * for the binding's element-update path. Shared across React, Vue, and Angular.
 */

import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';

const DEFAULT_FILL = '#ffffff';
const DEFAULT_STROKE = '#000000';
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_FONT_SIZE = 12;

/**
 * Returns the fill colour of the element's shapeStyle, or a white default.
 * Only meaningful for elements that pass `hasShapeProperties`.
 */
export function fillColorOf(el: PptxElement): string {
	if (hasShapeProperties(el)) {
		return el.shapeStyle?.fillColor ?? DEFAULT_FILL;
	}
	return DEFAULT_FILL;
}

/**
 * Returns the stroke colour of the element's shapeStyle, or a black default.
 * Only meaningful for elements that pass `hasShapeProperties`.
 */
export function strokeColorOf(el: PptxElement): string {
	if (hasShapeProperties(el)) {
		return el.shapeStyle?.strokeColor ?? DEFAULT_STROKE;
	}
	return DEFAULT_STROKE;
}

/**
 * Returns the text colour from the element's textStyle, or a black default.
 * Only meaningful for elements that pass `hasTextProperties`.
 */
export function textColorOf(el: PptxElement): string {
	if (hasTextProperties(el)) {
		return el.textStyle?.color ?? DEFAULT_TEXT_COLOR;
	}
	return DEFAULT_TEXT_COLOR;
}

/**
 * Returns the font size (in points) from the element's textStyle,
 * or DEFAULT_FONT_SIZE when absent.
 */
export function fontSizeOf(el: PptxElement): number {
	if (hasTextProperties(el)) {
		return el.textStyle?.fontSize ?? DEFAULT_FONT_SIZE;
	}
	return DEFAULT_FONT_SIZE;
}

/** Returns whether the element's text is bold (false when absent). */
export function isBold(el: PptxElement): boolean {
	if (hasTextProperties(el)) {
		return el.textStyle?.bold ?? false;
	}
	return false;
}

/** Returns whether the element's text is italic (false when absent). */
export function isItalic(el: PptxElement): boolean {
	if (hasTextProperties(el)) {
		return el.textStyle?.italic ?? false;
	}
	return false;
}

/** Returns whether the element's text has underline (false when absent). */
export function isUnderline(el: PptxElement): boolean {
	if (hasTextProperties(el)) {
		return el.textStyle?.underline ?? false;
	}
	return false;
}

/**
 * Changes to apply to shapeStyle: a subset of ShapeStyle fields editable
 * from the inspector panel.
 */
export interface ShapeStyleChanges {
	fillColor?: string;
	strokeColor?: string;
}

/**
 * Builds a Partial<PptxElement> patch that merges the given changes into the
 * element's existing shapeStyle without dropping any other shapeStyle fields.
 */
export function shapeStylePatch(el: PptxElement, changes: ShapeStyleChanges): Partial<PptxElement> {
	const base = hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	return {
		shapeStyle: {
			...base,
			...changes,
		},
	} as Partial<PptxElement>;
}

/**
 * Changes to apply to textStyle: a subset of TextStyle fields editable
 * from the inspector panel.
 */
export interface TextStyleChanges {
	color?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
}

/**
 * Builds a Partial<PptxElement> patch that merges the given changes into the
 * element's existing textStyle without dropping any other textStyle fields.
 */
export function textStylePatch(el: PptxElement, changes: TextStyleChanges): Partial<PptxElement> {
	const base = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return {
		textStyle: {
			...base,
			...changes,
		},
	} as Partial<PptxElement>;
}
