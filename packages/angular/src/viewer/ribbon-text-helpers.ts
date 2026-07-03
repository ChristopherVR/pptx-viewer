/**
 * ribbon-text-helpers.ts: shared text-style helpers for the ribbon's Font and
 * Paragraph control groups (split out of {@link RibbonComponent} so both the
 * {@link RibbonFontControlsComponent} and {@link RibbonParagraphControlsComponent}
 * mutate the selection's `textStyle` through the same code path).
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import type { EditorStateService } from './editor-state.service';

/** The selection's text style, or null when the element carries no text props. */
export function textStyleOf(el: PptxElement | null): TextStyle | null {
	return el && hasTextProperties(el) ? (el.textStyle ?? null) : null;
}

/** Whether the given element can take text formatting. */
export function isTextElement(el: PptxElement | null): boolean {
	return el !== null && hasTextProperties(el);
}

/** Merge `patch` into the selection's text style and commit via the editor. */
export function patchTextStyle(
	editor: EditorStateService,
	slideIndex: number,
	el: PptxElement | null,
	patch: Partial<TextStyle>,
): void {
	if (!el || !hasTextProperties(el)) {
		return;
	}
	editor.updateElement(slideIndex, el.id, {
		textStyle: { ...el.textStyle, ...patch } as TextStyle,
	} as Partial<PptxElement>);
}
