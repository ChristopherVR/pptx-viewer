/**
 * ribbon-text-helpers.ts: shared text-style helpers for the ribbon's Font and
 * Paragraph control groups (split out of {@link RibbonComponent} so both the
 * {@link RibbonFontControlsComponent} and {@link RibbonParagraphControlsComponent}
 * mutate the selection's `textStyle` through the same code path).
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import {
	buildInlineListStylePatch,
	getInlineEditorSelectionResult,
	readEditableText,
	setElementBullets,
	transformInlineListCase,
} from '../internal/shared';
import type { ElementBulletPatch, InlineTextEditSnapshot } from '../internal/shared';
import { INLINE_EDITOR_SELECTOR } from '../internal/shared-src/render/context-menu-target';
import { textStylePatch } from '../internal/shared-src/render/inspector-helpers';
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
	const editor = document.querySelector<HTMLElement>(INLINE_EDITOR_SELECTOR);
	return editor instanceof HTMLTextAreaElement
		? editor.value
		: editor
			? readEditableText(editor)
			: undefined;
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
export function formatInlineListStyle(
	el: PptxElement,
	patch: Partial<TextStyle>,
	draft: InlineTextEditSnapshot,
	formatSnapshot: (snapshot: InlineTextEditSnapshot) => boolean,
): (ElementBulletPatch & { text: string }) | undefined {
	if (!hasTextProperties(el) || draft.elementId !== el.id || !draft.textSegments) {
		return undefined;
	}
	const selection = getInlineEditorSelectionResult(draft.textSegments);
	if (selection.kind !== 'supported') {
		return undefined;
	}
	const changes = buildInlineListStylePatch(
		{ ...el, text: draft.text, textSegments: draft.textSegments },
		patch,
		selection.selection,
	);
	if (!changes?.textSegments || !formatSnapshot({ ...draft, textSegments: changes.textSegments })) {
		return undefined;
	}
	return { text: draft.text, ...changes };
}

export function patchTextStyle(
	editor: EditorStateService,
	slideIndex: number,
	el: PptxElement | null,
	patch: Partial<TextStyle>,
	snapshot?: InlineTextEditSnapshot,
	formatSnapshot?: (snapshot: InlineTextEditSnapshot) => boolean,
): void {
	if (!el || !hasTextProperties(el)) {
		return;
	}
	const { listType, ...stylePatch } = patch;
	const draft = snapshot?.elementId === el.id && snapshot.textSegments ? snapshot : undefined;
	if (snapshot && formatSnapshot && !draft) {
		return;
	}
	if (draft && formatSnapshot) {
		const changes = formatInlineListStyle(el, patch, draft, formatSnapshot);
		if (changes) {
			editor.updateElement(slideIndex, el.id, changes);
		}
		return;
	}
	if (listType !== undefined) {
		const liveText = draft?.text ?? currentInlineEditorText();
		const base =
			liveText === undefined
				? el
				: {
						...el,
						text: liveText,
						textSegments:
							draft?.textSegments ??
							(el.textSegments
								? remapTextToSegments(liveText, el.textSegments, el.textStyle)
								: undefined),
					};
		const listed = { ...base, ...setElementBullets(base, listType) };
		if (!hasTextProperties(listed)) {
			return;
		}
		editor.updateElement(slideIndex, el.id, {
			...(liveText !== undefined ? { text: liveText } : {}),
			textSegments: listed.textSegments,
			...textStylePatch(listed, stylePatch),
		});
		return;
	}
	const current = draft ? { ...el, text: draft.text, textSegments: draft.textSegments } : el;
	editor.updateElement(slideIndex, el.id, {
		...(draft ? { text: draft.text, textSegments: draft.textSegments } : {}),
		...textStylePatch(current, patch),
	});
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
	snapshot?: InlineTextEditSnapshot,
	endSession?: () => void,
): void {
	if (!el || !hasTextProperties(el)) {
		return;
	}
	// Reconcile against the live inline-editor text first (same remap the
	// commit path uses): case-transforming a stale snapshot leaves whatever the
	// user typed since untransformed once the edit session commits. See
	// `currentInlineEditorText`.
	const draft = snapshot?.elementId === el.id && snapshot.textSegments ? snapshot : undefined;
	if (snapshot && endSession) {
		if (!draft) {
			return;
		}
		const next = transformInlineListCase(draft, null, mode);
		if (next === draft) {
			return;
		}
		endSession();
		editor.updateElement(slideIndex, el.id, { text: next.text, textSegments: next.textSegments });
		return;
	}
	const liveText = draft?.text ?? currentInlineEditorText();
	const baseSegments =
		draft?.textSegments ??
		(liveText !== undefined && el.textSegments
			? remapTextToSegments(liveText, el.textSegments, el.textStyle)
			: el.textSegments);
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
