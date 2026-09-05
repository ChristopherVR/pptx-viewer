import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { NormAutofitShrinkResult } from 'pptx-viewer-shared';
import {
	canInteractWithElement,
	remapTextToSegments,
	resolveInlineEditAutoFitHeight,
	resolveInlineEditNormAutofitShrink,
} from 'pptx-viewer-shared';

export { readEditableText } from 'pptx-viewer-shared';

/**
 * Pure helpers for inline text editing. The editable surface itself is a
 * Svelte component (`InlineTextEditor.svelte`); this module only holds the
 * framework-agnostic logic: which elements are editable, remapping edited
 * plain text back onto the original rich segments (via the shared
 * `remapTextToSegments`, so per-run styles and field metadata survive), and
 * reading plain text out of a contenteditable surface.
 */

/**
 * Only elements that carry text (and are not locked) get the inline editor.
 * Equation-bearing text NEVER enters inline editing: the editor would only see
 * the literal "[Equation]" placeholder and committing would permanently drop
 * the OMML (`textSegments[].equationXml`). Mirrors the vanilla/Vue/React guard.
 */
export function canInlineEditElement(element: PptxElement | undefined): boolean {
	// The lock is asked of shared `canInteractWithElement`, not read off
	// `locks.noTextEdit` by hand: `noSelect` subsumes `noTextEdit`, and folding
	// that composition in one place is what stops the five bindings drifting
	// over which flags imply which.
	if (!element || !hasTextProperties(element) || !canInteractWithElement(element, 'textEdit')) {
		return false;
	}
	return !element.textSegments?.some((seg) => seg.equationXml);
}

/** Remap edited plain text back onto the element's original segments. */
export function remapInlineText(
	element: PptxElement,
	text: string,
): { text: string; textSegments: TextSegment[] } {
	const withText = hasTextProperties(element) ? element : undefined;
	const segments: TextSegment[] | undefined = withText?.textSegments;
	const style: TextStyle | undefined = withText?.textStyle;
	return { text, textSegments: remapTextToSegments(text, segments, style) };
}

/**
 * `a:spAutoFit` ("Resize shape to fit text") editor-commit resize: decide the
 * element's new height from its text style, current height, and the live
 * (still-mounted) editor DOM node - `undefined` when the element carries no
 * text properties, autofit isn't `'shrink'`, or the measured height did not
 * meaningfully change.
 *
 * `EditorElementController#commitInlineText` calls this before it replaces
 * the element; `editorEl` there is found via
 * `document.querySelector('[data-inline-editor]')`, which still resolves at
 * that point because `InlineTextEditor.svelte`'s `close()` invokes `oncommit`
 * (the call that reaches here) BEFORE `onclose()` - only `onclose()` sets
 * `editingId = null`, which is what unmounts the editor on Svelte's next
 * update.
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
 * Called from the same place and for the same DOM-still-mounted reason as
 * {@link resolveInlineTextAutoFitHeight} (see its doc comment).
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

/** Initial plain text + optional font style for the inline surface. */
export interface InlineTextSurface {
	text: string;
	fontSize: number | undefined;
	fontFamily: string | undefined;
}

/** Resolve the seed text and font hints for an element's inline editor. */
export function resolveInlineSurface(element: PptxElement): InlineTextSurface {
	const withText = hasTextProperties(element) ? element : undefined;
	return {
		text: withText?.text ?? '',
		fontSize: withText?.textStyle?.fontSize,
		fontFamily: withText?.textStyle?.fontFamily,
	};
}
