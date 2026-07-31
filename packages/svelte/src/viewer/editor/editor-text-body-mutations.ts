import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/**
 * Pure patch builders for the Home tab's body-level text controls: text
 * direction, column count, and the text-shadow toggle.
 *
 * These sit alongside `editor-paragraph-mutations.ts` rather than inside it
 * because they are `a:bodyPr` / effect properties rather than paragraph
 * properties, but they share its convention exactly: write at the element's
 * `textStyle` level (the base every run and paragraph inherits from) and
 * return a patch rather than mutating, so the caller decides when a history
 * entry is spent.
 */

function textStyleBase(el: PptxElement): TextStyle {
	return hasTextProperties(el) ? (el.textStyle ?? {}) : {};
}

/** Set the body text direction (`a:bodyPr/@vert`). */
export function setTextDirectionPatch(
	el: PptxElement,
	textDirection: TextStyle['textDirection'],
): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), textDirection } } as Partial<PptxElement>;
}

/** Set the body column count (`a:bodyPr/@numCol`). */
export function setColumnCountPatch(el: PptxElement, columnCount: number): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), columnCount } } as Partial<PptxElement>;
}

/** True when the element currently carries a text shadow. */
export function hasTextShadow(el: PptxElement | undefined): boolean {
	return el ? Boolean(textStyleBase(el).textShadowColor) : false;
}

/**
 * Toggle PowerPoint's default text shadow on or off.
 *
 * Off clears every shadow field rather than only the colour: leaving a stale
 * blur/offset behind would make the next "on" inherit settings the user never
 * chose. The on-values are React's, so a deck shadowed in one binding looks the
 * same in the others.
 */
export function toggleTextShadowPatch(el: PptxElement): Partial<PptxElement> {
	const base = textStyleBase(el);
	const next: TextStyle = hasTextShadow(el)
		? {
				...base,
				textShadowColor: undefined,
				textShadowBlur: undefined,
				textShadowOffsetX: undefined,
				textShadowOffsetY: undefined,
				textShadowOpacity: undefined,
			}
		: {
				...base,
				textShadowColor: '#000000',
				textShadowBlur: 2,
				textShadowOffsetX: 1,
				textShadowOffsetY: 1,
				textShadowOpacity: 0.5,
			};
	return { textStyle: next } as Partial<PptxElement>;
}
