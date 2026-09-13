import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { ElementBulletPatch } from './bullet-toggle';
import { isBulletMarkerSegment } from './bullet-toggle';
import { applyStyleToSelectedSegments } from './inline-selection-utils';
import type { InlineTextSelection } from './inline-selection-utils';
import { applyListStyleUpdate, restoreParagraphMetadata } from './text-list-style-update';
import { updateTextSegmentStyle } from './update-text-segment-style';

/** Format the current rich draft. The caller must reconcile its live DOM before committing. */
export function buildInlineListStylePatch(
	element: PptxElement,
	updates: Partial<TextStyle>,
	selection: InlineTextSelection | null,
): ElementBulletPatch | undefined {
	if (!hasTextProperties(element) || !element.textSegments) {
		return undefined;
	}
	if (updates.listType !== undefined) {
		const patch = applyListStyleUpdate(element, updates, selection).patch;
		return {
			...('textStyle' in patch ? { textStyle: patch.textStyle } : {}),
			...('textSegments' in patch ? { textSegments: patch.textSegments } : {}),
		};
	}
	return {
		textSegments: selection
			? restoreParagraphMetadata(
					element.textSegments,
					applyStyleToSelectedSegments(element.textSegments, selection, updates).newSegments,
				)
			: element.textSegments.map((segment) =>
					updateTextSegmentStyle(segment, updates, {
						updateBodyStyle: !(segment.paragraphInsertionStyle && isBulletMarkerSegment(segment)),
					}),
				),
		...(selection ? {} : { textStyle: { ...element.textStyle, ...updates } }),
	};
}
