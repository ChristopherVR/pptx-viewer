/**
 * viewer-keyboard-text-commands.ts: the text-formatting half of the keyboard
 * shortcut handler (paragraph alignment, the font-size ladder, and
 * clear-character-formatting), split out of {@link ViewerKeyboardService} to
 * keep that file under this repo's file-size limit.
 *
 * These three commands share one shape: resolve the current selection/inline
 * snapshot, build a `Partial<TextStyle>`, and apply it through
 * {@link patchTextStyle}, which already knows how to route the patch to a
 * live inline-edit snapshot instead of the committed element when one is
 * open. Font-size stepping additionally needs the whole-element path
 * (`textFontSizePatch`) when there is no live snapshot, matching
 * `ribbon-font-controls.component.ts`'s own `patchFontSize`, so every run's
 * `textSegments` gets the new size too, not just the element's own style.
 */
import type { PptxElement, TextStyle } from 'pptx-viewer-core';

import {
	stepFontSizePt,
	textFontSizePatch,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from '../internal/shared';
import type { InlineTextEditSnapshot } from '../internal/shared';
import type { EditorStateService } from './editor-state.service';
import { isTextElement, patchTextStyle, textStyleOf } from './ribbon-text-helpers';

/** The pieces `applyTextCommand` needs from {@link ViewerCanvasEditingService}. */
export interface InlineSnapshotAccess {
	readInlineSnapshot(): InlineTextEditSnapshot | undefined;
	formatInlineSnapshot(next: InlineTextEditSnapshot): boolean;
}

/** Paragraph alignment or clear-character-formatting, applied to the selection. */
export function applyTextCommand(
	editor: EditorStateService,
	slideIndex: number,
	element: PptxElement | null,
	patch: Partial<TextStyle>,
	inlineEditing: InlineSnapshotAccess | null,
): void {
	patchTextStyle(
		editor,
		slideIndex,
		element,
		patch,
		inlineEditing?.readInlineSnapshot(),
		(next) => inlineEditing?.formatInlineSnapshot(next) ?? false,
	);
}

/**
 * Step the selection's font size one rung along PowerPoint's size ladder
 * (Ctrl+Shift+>/< and Ctrl+]/[). Mirrors the ribbon's grow/shrink buttons
 * exactly, including the "24pt when nothing is set" default and the
 * live-inline-edit-snapshot special case.
 */
export function stepSelectionFontSize(
	editor: EditorStateService,
	slideIndex: number,
	element: PptxElement | null,
	direction: 'increase' | 'decrease',
	inlineEditing: InlineSnapshotAccess | null,
): void {
	if (!element || !isTextElement(element)) {
		return;
	}
	const currentFontSizePx = textStyleOf(element)?.fontSize;
	const currentPt = currentFontSizePx === undefined ? 24 : textFontSizePxToPt(currentFontSizePx);
	const nextFontSize = textFontSizePtToPx(stepFontSizePt(currentPt, direction));

	const snapshot = inlineEditing?.readInlineSnapshot();
	if (snapshot?.elementId === element.id && snapshot.textSegments) {
		applyTextCommand(editor, slideIndex, element, { fontSize: nextFontSize }, inlineEditing);
		return;
	}
	editor.updateElement(slideIndex, element.id, textFontSizePatch(element, nextFontSize));
}
