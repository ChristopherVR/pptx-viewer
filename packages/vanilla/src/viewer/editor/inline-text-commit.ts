import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { InlineTextEditSnapshot, NormAutofitShrinkResult } from 'pptx-viewer-shared';
import {
	reconcileInlineListSnapshot,
	remapTextToSegments,
	resolveInlineEditAutoFitHeight,
	resolveInlineEditNormAutofitShrink,
} from 'pptx-viewer-shared';

/** Remap edited plain text back onto the element's original segments. */
export function remapInlineText(
	element: PptxElement,
	text: string,
	snapshot?: InlineTextEditSnapshot,
): { text: string; textSegments: TextSegment[] } {
	const withText = hasTextProperties(element) ? element : undefined;
	const segments: TextSegment[] | undefined = withText?.textSegments;
	const style: TextStyle | undefined = withText?.textStyle;
	const rich =
		snapshot?.elementId === element.id ? reconcileInlineListSnapshot(snapshot, text) : undefined;
	return { text, textSegments: rich?.textSegments ?? remapTextToSegments(text, segments, style) };
}

/**
 * `a:spAutoFit` ("Resize shape to fit text") editor-commit resize: decide the
 * element's new height from its text style, current height, and the live
 * (still-mounted) editor DOM node - `undefined` when the element carries no
 * text properties, autofit isn't `'shrink'`, or the measured height did not
 * meaningfully change.
 *
 * `EditorOperations.commitInlineText` calls this before it replaces the
 * element; `editorEl` there is found via
 * `document.querySelector('[data-inline-editor]')`, which resolves to the
 * live surface because `close()` (above) fires `onCommit` - the call that
 * reaches `commitInlineText` - BEFORE `surface.remove()`.
 */
export function resolveInlineTextAutoFitHeight(
	element: PptxElement,
	editorEl: HTMLElement | null,
): number | undefined {
	if (!hasTextProperties(element)) {
		return undefined;
	}
	return resolveInlineEditAutoFitHeight(element.textStyle, element.height, editorEl);
}

/**
 * `a:normAutofit` ("Shrink text on overflow") editor-commit recompute: decide
 * the element's new `fontScale`/`lnSpcReduction` from its text style, current
 * (fixed) height, and the live editor DOM node - `'unchanged'` when the
 * element carries no text properties, autofit isn't `'normal'`, or the
 * measured height did not meaningfully change. Mutually exclusive with
 * {@link resolveInlineTextAutoFitHeight} (`a:spAutoFit`); both read
 * `autoFitMode`, only one mode is ever set.
 *
 * `EditorOperations.commitInlineText` calls this before it replaces the
 * element, for the same reason (and at the same point) it calls
 * {@link resolveInlineTextAutoFitHeight}.
 */
export function resolveInlineTextNormAutofitShrink(
	element: PptxElement,
	editorEl: HTMLElement | null,
): NormAutofitShrinkResult {
	if (!hasTextProperties(element)) {
		return 'unchanged';
	}
	return resolveInlineEditNormAutofitShrink(element.textStyle, element.height, editorEl);
}
