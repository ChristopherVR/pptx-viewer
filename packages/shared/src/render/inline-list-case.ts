import { isBulletMarkerSegment } from './bullet-toggle';
import { inlineListBodyText } from './inline-list-body';
import type { InlineTextEditSnapshot } from './inline-list-types';
import type { InlineTextSelection } from './inline-selection-utils';
import { applyCaseTransformToSegments } from './text-case-transform';
import type { ChangeCaseMode } from './text-case-transform';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

/** Explicit model transaction. The caller ends the native editing session before applying it. */
export function transformInlineListCase(
	snapshot: InlineTextEditSnapshot,
	selection: InlineTextSelection | null,
	mode: ChangeCaseMode,
): InlineTextEditSnapshot {
	if (!snapshot.textSegments) {
		return snapshot;
	}
	const source = snapshot.textSegments;
	let first = true;
	const textSegments = applyCaseTransformToSegments(source, selection, mode).map(
		(segment, index) => {
			const marker = first && isBulletMarkerSegment(source[index]);
			first = isParagraphSeparatorSegment(source[index]);
			return marker ? source[index] : segment;
		},
	);
	const text = inlineListBodyText(textSegments);
	return text === snapshot.text ? snapshot : { ...snapshot, text, textSegments };
}
