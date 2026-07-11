import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';

import { canFormatText, readTextFormatState } from './editor-format-mutations';

/**
 * Pure paragraph-level formatting-patch builders for the vanilla editor
 * (list type, indent, alignment, line spacing). Split out of
 * `editor-format-mutations.ts` (character-level formatting) to keep both
 * files within the project's file-size budget; same whole-element scope note
 * applies (see that module's docs): there is no per-paragraph selection model
 * in this binding, so these toggles apply element-wide.
 */

/** Indent step in px applied by the increase/decrease indent buttons. */
const INDENT_STEP_PX = 24;

function patchTextStyle(el: PptxElement, patch: Partial<TextStyle>): Partial<PptxElement> {
	if (!canFormatText(el)) {
		return {};
	}
	const textStyle: TextStyle = { ...el.textStyle, ...patch };
	const segments: TextSegment[] | undefined = el.textSegments?.map((seg) => ({
		...seg,
		style: { ...seg.style, ...patch },
	}));
	return segments ? { textStyle, textSegments: segments } : { textStyle };
}

/** Toggle the paragraph list type (bullet/numbered) element-wide; re-clicking clears it. */
export function toggleListType(
	el: PptxElement,
	kind: Exclude<TextStyle['listType'], 'none' | undefined>,
): Partial<PptxElement> {
	const current = readTextFormatState(el).listType;
	return patchTextStyle(el, { listType: current === kind ? 'none' : kind });
}

/** Step the paragraph left margin (indent) by `deltaSteps` * {@link INDENT_STEP_PX}, clamped >= 0. */
export function adjustIndent(el: PptxElement, deltaSteps: number): Partial<PptxElement> {
	const current = readTextFormatState(el).paragraphMarginLeft;
	const next = Math.max(0, current + deltaSteps * INDENT_STEP_PX);
	return patchTextStyle(el, { paragraphMarginLeft: next });
}

/** Set the paragraph text alignment element-wide. */
export function setTextAlign(el: PptxElement, align: TextStyle['align']): Partial<PptxElement> {
	return patchTextStyle(el, { align });
}

/** Set the line-spacing multiplier element-wide. */
export function setLineSpacing(el: PptxElement, lineSpacing: number): Partial<PptxElement> {
	return patchTextStyle(el, { lineSpacing });
}
