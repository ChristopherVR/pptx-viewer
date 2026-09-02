import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import {
	applyCaseTransformToSegments,
	readEditableText,
	remapTextToSegments,
} from 'pptx-viewer-shared';

/**
 * Pure font-formatting patch builders that extend `editor-format-mutations.ts`
 * (bold/italic/underline/size/colour) with the rest of the Home tab's Font
 * group: strikethrough, font family, character spacing, change-case, and
 * clear formatting. Kept in a sibling file so neither module grows past the
 * repo's 300-LOC budget.
 */

function textStyleBase(el: PptxElement): TextStyle {
	return hasTextProperties(el) ? (el.textStyle ?? {}) : {};
}

/** Toggle the strikethrough flag. */
export function toggleStrikethroughPatch(el: PptxElement): Partial<PptxElement> {
	const base = textStyleBase(el);
	return { textStyle: { ...base, strikethrough: !base.strikethrough } } as Partial<PptxElement>;
}

/** Set the font family, preserving other text-style fields. */
export function setFontFamilyPatch(el: PptxElement, fontFamily: string): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), fontFamily } } as Partial<PptxElement>;
}

/** Set the character spacing (1/100 pt, OOXML `spc` units). */
export function setCharacterSpacingPatch(el: PptxElement, spacing: number): Partial<PptxElement> {
	return { textStyle: { ...textStyleBase(el), characterSpacing: spacing } } as Partial<PptxElement>;
}

/**
 * Rewrite the element's full text to the given case, via the shared
 * `applyCaseTransformToSegments` (selection-free: transforms every run).
 * Falls back to a `textCaps` style toggle for elements with no `textSegments`
 * (e.g. table cells), matching React's behaviour.
 */
export function changeCasePatch(el: PptxElement, mode: ChangeCaseMode): Partial<PptxElement> {
	if (hasTextProperties(el) && el.textSegments && el.textSegments.length > 0) {
		// `InlineTextEditor.svelte`'s contenteditable is uncontrolled: it "stays
		// uncontrolled and only commits on blur/Escape", so `el.textSegments` can
		// be stale relative to what is on screen for the whole edit session.
		// Reconcile against the live DOM text first (same remap the commit path
		// uses), or case-transforming a stale snapshot leaves whatever the user
		// typed since untransformed once the session commits.
		const liveEditor =
			typeof document === 'undefined'
				? null
				: document.querySelector<HTMLElement>('[data-inline-editor]');
		const liveText = liveEditor ? readEditableText(liveEditor) : undefined;
		const baseSegments =
			liveText !== undefined
				? remapTextToSegments(liveText, el.textSegments, el.textStyle)
				: el.textSegments;
		const next = applyCaseTransformToSegments(baseSegments, null, mode);
		const text = next
			.filter((seg) => !seg.isParagraphBreak)
			.map((seg) => seg.text)
			.join('');
		return { textSegments: next, text } as Partial<PptxElement>;
	}
	return {
		textStyle: { ...textStyleBase(el), textCaps: mode === 'upper' ? 'all' : 'none' },
	} as Partial<PptxElement>;
}

/** Reset bold/italic/underline/strikethrough/highlight to their defaults. */
export function clearFormattingPatch(el: PptxElement): Partial<PptxElement> {
	return {
		textStyle: {
			...textStyleBase(el),
			bold: false,
			italic: false,
			underline: false,
			strikethrough: false,
			highlightColor: undefined,
		},
	} as Partial<PptxElement>;
}
