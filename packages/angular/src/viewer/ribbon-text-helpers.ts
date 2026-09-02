/**
 * ribbon-text-helpers.ts: shared text-style helpers for the ribbon's Font and
 * Paragraph control groups (split out of {@link RibbonComponent} so both the
 * {@link RibbonFontControlsComponent} and {@link RibbonParagraphControlsComponent}
 * mutate the selection's `textStyle` through the same code path).
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import { INLINE_EDITOR_SELECTOR } from '../internal/shared-src/render/context-menu-target';
import { remapTextToSegments } from '../internal/shared-src/render/remap-text';
import type { ChangeCaseMode } from '../internal/shared-src/render/text-case-transform';
import { transformTextCase } from '../internal/shared-src/render/text-case-transform';
import type { EditorStateService } from './editor-state.service';

/**
 * The live (uncommitted) plain text of the open inline-edit `<textarea
 * data-inline-editor>`, or `undefined` when none is open. The textarea is
 * UNCONTROLLED (see `slide-canvas.component.ts`): typing updates its own
 * `.value` and only publishes to collaboration broadcast on input, never the
 * model, so `element.textSegments`/`.text` can be stale relative to what is
 * on screen for the whole edit session, not just mid-keystroke.
 */
function currentInlineEditorText(): string | undefined {
	if (typeof document === 'undefined') {
		return undefined;
	}
	const editor = document.querySelector<HTMLTextAreaElement>(INLINE_EDITOR_SELECTOR);
	return editor ? editor.value : undefined;
}

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

/**
 * Rewrite the selection's text characters (ribbon Aa "Change Case" dropdown).
 * Unlike {@link patchTextStyle}, this mutates content, not style.
 */
export function transformSelectedTextCase(
	editor: EditorStateService,
	slideIndex: number,
	el: PptxElement | null,
	mode: ChangeCaseMode,
): void {
	if (!el || !hasTextProperties(el)) {
		return;
	}
	// Reconcile against the live inline-editor text first (same remap the
	// commit path uses): case-transforming a stale snapshot leaves whatever the
	// user typed since untransformed once the edit session commits. See
	// `currentInlineEditorText`.
	const liveText = currentInlineEditorText();
	const baseSegments =
		liveText !== undefined && el.textSegments
			? remapTextToSegments(liveText, el.textSegments, el.textStyle)
			: el.textSegments;
	const baseText = liveText ?? el.text;

	const updates: Partial<PptxElement> = {};
	if (baseSegments && baseSegments.length > 0) {
		(updates as { textSegments?: unknown }).textSegments = baseSegments.map((s) =>
			s.isParagraphBreak || s.text === '\n' ? s : { ...s, text: transformTextCase(s.text, mode) },
		);
	}
	if (typeof baseText === 'string') {
		(updates as { text?: string }).text = transformTextCase(baseText, mode);
	}
	editor.updateElement(slideIndex, el.id, updates);
}
