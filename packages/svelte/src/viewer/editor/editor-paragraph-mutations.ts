import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/**
 * Pure paragraph-level patch builders for the Home tab's Paragraph group:
 * bullet/numbered list, indent, alignment, and line spacing. Formatting is
 * applied at the element `textStyle` level (the base every run/paragraph
 * inherits from), matching the convention in `editor-format-mutations.ts`.
 */

/** Indent step (px) applied per increase/decrease-indent click. */
const INDENT_STEP_PX = 24;

function textStyleBase(el: PptxElement): TextStyle {
	return hasTextProperties(el) ? (el.textStyle ?? {}) : {};
}

/** Toggle the paragraph list type between the given kind and `'none'`. */
export function toggleListTypePatch(
	el: PptxElement,
	kind: 'bullet' | 'numbered',
): Partial<PptxElement> {
	const base = textStyleBase(el);
	const next = base.listType === kind ? 'none' : kind;
	return { textStyle: { ...base, listType: next } } as Partial<PptxElement>;
}

/** Increase or decrease the paragraph left margin by one indent step. */
export function adjustIndentPatch(el: PptxElement, delta: 1 | -1): Partial<PptxElement> {
	const base = textStyleBase(el);
	const next = Math.max(0, (base.paragraphMarginLeft ?? 0) + delta * INDENT_STEP_PX);
	return { textStyle: { ...base, paragraphMarginLeft: next } } as Partial<PptxElement>;
}

/** Set the paragraph alignment. */
export function setAlignPatch(el: PptxElement, align: TextStyle['align']): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), align } } as Partial<PptxElement>;
}

/** Set the line spacing multiplier (e.g. 1.15 = 115%). */
export function setLineSpacingPatch(el: PptxElement, lineSpacing: number): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), lineSpacing } } as Partial<PptxElement>;
}
