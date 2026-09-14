/**
 * Pressed state and toggle decision for the ribbon's Bold / Italic /
 * Underline / Strikethrough buttons.
 *
 * Every binding used to decide the next value as `!element.textStyle.bold`:
 * the body-level style, which knows nothing about the runs. A word that is
 * bold at run level inside a non-bold body read as "off", so clicking Bold
 * re-applied bold and the word could never be un-bolded from the ribbon.
 *
 * The state is derived from the runs the user selected (all content runs when
 * nothing is selected; the body style when there are no runs at all), as a
 * tri-state so a mixed selection is honest: PowerPoint turns a mixed or off
 * selection ON, and only an all-on selection OFF.
 */

import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import type { InlineTextSelection } from './inline-selection-utils';

/** The pressed state of one toggle over the selected runs. */
export type TextStyleFlagState = 'on' | 'off' | 'mixed';

/** The boolean run decorations the ribbon toggles. */
export type TextDecorationFlag = 'bold' | 'italic' | 'underline' | 'strikethrough';

export const TEXT_DECORATION_FLAGS: readonly TextDecorationFlag[] = [
	'bold',
	'italic',
	'underline',
	'strikethrough',
];

/** Per-toggle tri-state, one entry per {@link TextDecorationFlag}. */
export type SelectionTextStyleFlags = Record<TextDecorationFlag, TextStyleFlagState>;

/** A run that carries text: not a paragraph break, not a display-only bullet marker. */
export function isContentSegment(segment: TextSegment): boolean {
	return (
		!segment.isParagraphBreak &&
		segment.text !== '\n' &&
		segment.text.length > 0 &&
		!isBulletMarkerSegment(segment)
	);
}

/**
 * The content runs a toggle acts on: those inside the selection's segment
 * range, or every content run when there is no selection.
 */
export function contentSegmentsInSelection(
	segments: readonly TextSegment[] | undefined,
	selection: InlineTextSelection | null,
): TextSegment[] {
	if (!segments) {
		return [];
	}
	return segments.filter(
		(segment, index) =>
			isContentSegment(segment) &&
			(!selection || (index >= selection.startSegIdx && index <= selection.endSegIdx)),
	);
}

function flagState(values: readonly boolean[]): TextStyleFlagState {
	if (values.every((value) => value)) {
		return 'on';
	}
	return values.some((value) => value) ? 'mixed' : 'off';
}

/**
 * The tri-state of each decoration over the selected runs. A run without an
 * explicit value inherits the body's, exactly as the renderer paints it. With
 * no content runs at all the body style decides.
 */
export function getSelectionTextStyleFlags(
	segments: readonly TextSegment[] | undefined,
	selection: InlineTextSelection | null,
	elementTextStyle: Partial<TextStyle> | undefined,
): SelectionTextStyleFlags {
	const runs = contentSegmentsInSelection(segments, selection);
	const flags = {} as SelectionTextStyleFlags;
	for (const flag of TEXT_DECORATION_FLAGS) {
		const body = elementTextStyle?.[flag] ?? false;
		flags[flag] =
			runs.length === 0
				? flagState([body])
				: flagState(runs.map((run) => run.style?.[flag] ?? body));
	}
	return flags;
}

/** What a click should write: only an all-on selection turns off. */
export function nextToggleValue(state: TextStyleFlagState): boolean {
	return state !== 'on';
}

/**
 * {@link getSelectionTextStyleFlags} for an element: its runs (or `segments`,
 * a fresher copy from a live inline edit) against its body style. All off for
 * an element without text properties.
 */
export function textStyleFlagsOf(
	element: PptxElement | null | undefined,
	selection: InlineTextSelection | null = null,
	segments?: readonly TextSegment[],
): SelectionTextStyleFlags {
	if (!element || !hasTextProperties(element)) {
		return { bold: 'off', italic: 'off', underline: 'off', strikethrough: 'off' };
	}
	return getSelectionTextStyleFlags(segments ?? element.textSegments, selection, element.textStyle);
}
