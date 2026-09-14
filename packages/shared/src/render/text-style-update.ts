/**
 * The one text-style update every binding applies from the ribbon, the
 * inspector and the inline editor's keyboard shortcuts.
 *
 * With an inline selection the run-level half of `updates` is scoped to the
 * selected characters (`applyStyleToSelectedSegments`) while the body-level
 * half (`text-style-scope.ts`) still reaches `element.textStyle`; the
 * decoration flags the edit touched are then reconciled so the body's CSS
 * decoration agrees with the runs. Without a selection the whole update goes
 * to the body and to every run, the behaviour all five bindings already had.
 */

import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { InlineTextSelection } from './inline-selection-utils';
import { applyStyleToSelectedSegments } from './inline-selection-utils';
import type { TextDecorationFlag } from './selection-format-state';
import { TEXT_DECORATION_FLAGS } from './selection-format-state';
import { reconcileDecorationFlags, splitTextStyleUpdate } from './text-style-scope';

/** What a text-style update hands back to the binding. */
export interface TextStyleUpdateResult {
	/** The element patch to apply through the binding's update-element operation. */
	patch: Partial<PptxElement>;
	/** The selection remapped onto the new segments; `null` when there was none. */
	newSelection: InlineTextSelection | null;
}

/**
 * Build the element patch for `updates`.
 *
 * @param selection - The active inline text selection, or `null` for a
 *   whole-element edit.
 * @param segments - A fresher copy of the element's segments (a live inline
 *   edit whose text is not yet on the model); defaults to the element's own.
 */
export function applyTextStyleUpdate(
	element: PptxElement,
	updates: Partial<TextStyle>,
	selection: InlineTextSelection | null,
	segments?: readonly TextSegment[],
): TextStyleUpdateResult {
	if (!hasTextProperties(element)) {
		return { patch: {}, newSelection: null };
	}
	const current = segments ?? element.textSegments;

	if (selection && current && current.length > 0) {
		const { body, run } = splitTextStyleUpdate(updates);
		let textStyle: TextStyle = { ...element.textStyle, ...body };
		let textSegments: TextSegment[] = [...current];
		let newSelection = selection;
		if (Object.keys(run).length > 0) {
			const scoped = applyStyleToSelectedSegments(textSegments, selection, run);
			textSegments = scoped.newSegments;
			newSelection = scoped.newSelection;
		}
		const touched = TEXT_DECORATION_FLAGS.filter((flag): flag is TextDecorationFlag => flag in run);
		if (touched.length > 0) {
			const reconciled = reconcileDecorationFlags(textSegments, textStyle, touched);
			textStyle = reconciled.textStyle;
			textSegments = reconciled.textSegments;
		}
		return { patch: { textStyle, textSegments } as Partial<PptxElement>, newSelection };
	}

	const textStyle: TextStyle = { ...element.textStyle, ...updates };
	const textSegments = current?.map((segment) => ({
		...segment,
		style: { ...segment.style, ...updates },
	}));
	return {
		patch: (textSegments ? { textStyle, textSegments } : { textStyle }) as Partial<PptxElement>,
		newSelection: null,
	};
}
