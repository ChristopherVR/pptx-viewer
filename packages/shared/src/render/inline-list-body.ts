import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

/** Authored body projection, excluding only a paragraph's dedicated display marker. */
export function inlineListBodyText(segments: readonly TextSegment[] | undefined): string {
	let first = true;
	let text = '';
	for (const segment of segments ?? []) {
		if (isParagraphSeparatorSegment(segment)) {
			text += '\n';
			first = true;
		} else {
			if (!first || !isBulletMarkerSegment(segment)) {
				text += segment.isLineBreak ? '\n' : segment.text;
			}
			first = false;
		}
	}
	return text;
}
