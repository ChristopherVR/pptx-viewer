import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { fontSizeOf, shapeStylePatch, textStylePatch } from 'pptx-viewer-shared';

/**
 * Pure patch builders for the formatting toolbar / inspector.
 *
 * Each function reads the CURRENT element and returns a `Partial<PptxElement>`
 * that shallow-merges (via `updateElement`) onto it, preserving every other
 * `textStyle` / `shapeStyle` field. The common text/shape merges reuse the
 * shared `textStylePatch` / `shapeStylePatch` helpers (`inspector-helpers`);
 * `highlightColor` (text) and `strokeWidth` (shape) are merged locally because
 * the shared `TextStyleChanges` / `ShapeStyleChanges` types don't yet cover
 * them (extraction candidate: extend those shared change types).
 *
 * NOTE (rich runs): formatting is applied at the *element* `textStyle` level,
 * which the shared paragraph builder uses as the base for every run. Elements
 * that carry per-run overrides (`textSegments`/`paragraphs` with their own
 * styles) keep those overrides; this pass intentionally does not rewrite
 * individual runs (no per-selection run formatting).
 */

/** Smallest / largest font size (pt) the toolbar will set. */
const MIN_FONT = 1;
const MAX_FONT = 400;

function clampFont(size: number): number {
	return Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round(size)));
}

/** Toggleable boolean text-style flags. */
export type TextFlag = 'bold' | 'italic' | 'underline';

/** Flip a boolean text flag (bold / italic / underline). */
export function toggleTextFlagPatch(el: PptxElement, flag: TextFlag): Partial<PptxElement> {
	const current = hasTextProperties(el) ? (el.textStyle?.[flag] ?? false) : false;
	return textStylePatch(el, { [flag]: !current });
}

/** Set an absolute font size (clamped to a sane range). */
export function setFontSizePatch(el: PptxElement, size: number): Partial<PptxElement> {
	return textStylePatch(el, { fontSize: clampFont(size) });
}

/** Nudge the font size by `delta` points (clamped). */
export function adjustFontSizePatch(el: PptxElement, delta: number): Partial<PptxElement> {
	return textStylePatch(el, { fontSize: clampFont(fontSizeOf(el) + delta) });
}

/** Set the text (foreground) colour. */
export function setTextColorPatch(el: PptxElement, color: string): Partial<PptxElement> {
	return textStylePatch(el, { color });
}

/** Read the text highlight colour (empty string when unset). */
export function highlightColorOf(el: PptxElement): string {
	return hasTextProperties(el) ? (el.textStyle?.highlightColor ?? '') : '';
}

/** Set the text highlight colour, preserving other text-style fields. */
export function setHighlightColorPatch(el: PptxElement, color: string): Partial<PptxElement> {
	const base = hasTextProperties(el) ? (el.textStyle ?? {}) : {};
	return { textStyle: { ...base, highlightColor: color } } as Partial<PptxElement>;
}

/** Set the shape fill colour. */
export function setFillColorPatch(el: PptxElement, color: string): Partial<PptxElement> {
	return shapeStylePatch(el, { fillColor: color });
}

/** Set the shape stroke (outline) colour. */
export function setStrokeColorPatch(el: PptxElement, color: string): Partial<PptxElement> {
	return shapeStylePatch(el, { strokeColor: color });
}

/** Read the shape stroke width (defaults to 1 when unset). */
export function strokeWidthOf(el: PptxElement): number {
	return hasShapeProperties(el) ? (el.shapeStyle?.strokeWidth ?? 1) : 1;
}

/** Set the shape stroke width (px), preserving other shape-style fields. */
export function setStrokeWidthPatch(el: PptxElement, width: number): Partial<PptxElement> {
	const base = hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	return { shapeStyle: { ...base, strokeWidth: Math.max(0, width) } } as Partial<PptxElement>;
}
