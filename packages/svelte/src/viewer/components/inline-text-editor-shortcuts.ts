import type { PptxElement } from 'pptx-viewer-core';
import {
	fontSizeOf,
	mapEditorKey,
	mapInlineTextFormatKey,
	stepFontSizePt,
} from 'pptx-viewer-shared';
import type { EditorKeyInput } from 'pptx-viewer-shared';

import { setFontSizePatch, toggleTextFlagPatch } from '../editor/editor-format-mutations';
import { setAlignPatch } from '../editor/editor-paragraph-mutations';
import { clearFormattingPatch } from '../editor/editor-text-extra-mutations';

/** The formatting shortcuts `InlineTextEditor` can dispatch mid-edit. */
export interface InlineFormatCallbacks {
	/** An element patch to apply, built by the same functions the ribbon uses. */
	onformat?: (patch: Partial<PptxElement>) => void;
	oncopyformat?: () => void;
	onpasteformat?: () => void;
	onhyperlink?: () => void;
	onfind?: () => void;
	onfindreplace?: () => void;
}

/**
 * Resolve and dispatch PowerPoint's text-formatting shortcuts fired while a
 * caret sits inside `InlineTextEditor`'s contenteditable surface.
 *
 * Extracted out of the component so the decision logic (which key means
 * which patch) is unit-testable without mounting Svelte, and so the component
 * itself stays under this repo's file-size budget. The guard passed to
 * `mapEditorKey` is always `{ isEditingText: true, hasSelection: true }`: an
 * inline editor is only ever open on a selected element, mid-edit, so both
 * are true by construction rather than read off any input.
 *
 * Returns `true` when a shortcut was recognised and dispatched, so the caller
 * knows to `preventDefault()` the key; `false` leaves the key (and the
 * browser's native contenteditable handling, if any) alone.
 */
export function handleInlineFormatShortcut(
	event: EditorKeyInput,
	element: PptxElement,
	callbacks: InlineFormatCallbacks,
): boolean {
	const { onformat, oncopyformat, onpasteformat, onhyperlink, onfind, onfindreplace } = callbacks;

	const boldItalicUnderline = mapInlineTextFormatKey(event);
	if (boldItalicUnderline) {
		onformat?.(toggleTextFlagPatch(element, boldItalicUnderline));
		return true;
	}

	const { action } = mapEditorKey(event, { isEditingText: true, hasSelection: true });
	switch (action) {
		case 'alignLeft':
			onformat?.(setAlignPatch(element, 'left'));
			return true;
		case 'alignCenter':
			onformat?.(setAlignPatch(element, 'center'));
			return true;
		case 'alignRight':
			onformat?.(setAlignPatch(element, 'right'));
			return true;
		case 'alignJustify':
			onformat?.(setAlignPatch(element, 'justify'));
			return true;
		case 'increaseFontSize':
			onformat?.(setFontSizePatch(element, stepFontSizePt(fontSizeOf(element), 'increase')));
			return true;
		case 'decreaseFontSize':
			onformat?.(setFontSizePatch(element, stepFontSizePt(fontSizeOf(element), 'decrease')));
			return true;
		case 'clearFormatting':
			onformat?.(clearFormattingPatch(element));
			return true;
		case 'copyFormat':
			oncopyformat?.();
			return true;
		case 'pasteFormat':
			onpasteformat?.();
			return true;
		case 'hyperlink':
			onhyperlink?.();
			return true;
		case 'find':
			onfind?.();
			return true;
		case 'findReplace':
			onfindreplace?.();
			return true;
		default:
			return false;
	}
}
