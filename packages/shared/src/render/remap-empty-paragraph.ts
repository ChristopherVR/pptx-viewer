import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';

/** Materialize typed body text without borrowing a display marker's style. */
export function remapEmptyParagraph(
	text: string,
	segments: TextSegment[],
	terminator?: TextSegment,
): TextSegment[] | undefined {
	const source = segments[0] ?? terminator;
	const insertionStyle = source?.paragraphInsertionStyle;
	if (
		!source ||
		!insertionStyle ||
		segments.length > 1 ||
		(segments.length > 0 && source.text !== '' && !isBulletMarkerSegment(source))
	) {
		return undefined;
	}
	if (text.length === 0) {
		return segments.map((segment) => ({ ...segment }));
	}
	const first = { ...source };
	delete first.paragraphInsertionStyle;
	const bullet = first.bulletInfo;
	if (bullet && !bullet.none && segments.length > 0) {
		return [first, { text, style: { ...insertionStyle } }];
	}
	delete first.isParagraphBreak;
	return [{ ...first, text, style: { ...insertionStyle } }];
}
