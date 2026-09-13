import type { TextSegment } from 'pptx-viewer-core';

import { inlineListParagraphMetadata } from './inline-list-seed';
import type { InlineTextEditSnapshot } from './inline-list-types';
import { remapTextToSegments } from './remap-text';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

/** AutoCorrect cannot move paragraph identity or turn a soft break into a paragraph. */
export function reconcileInlineListSnapshot(
	snapshot: InlineTextEditSnapshot,
	transformedText: string,
): InlineTextEditSnapshot | undefined {
	if (snapshot.text === transformedText) {
		return snapshot;
	}
	if (!snapshot.textSegments) {
		return undefined;
	}
	const before = snapshot.text.split('\n');
	const after = transformedText.split('\n');
	if (before.length !== after.length) {
		return undefined;
	}
	const lines: Array<{ runs: TextSegment[]; terminator?: TextSegment }> = [{ runs: [] }];
	for (const segment of snapshot.textSegments) {
		if (segment.isLineBreak || isParagraphSeparatorSegment(segment)) {
			lines.at(-1)!.terminator = segment;
			lines.push({ runs: [] });
		} else {
			if (segment.text.includes('\n')) {
				return undefined;
			}
			lines.at(-1)!.runs.push(segment);
		}
	}
	if (lines.length !== after.length) {
		return undefined;
	}
	const result: TextSegment[] = [];
	for (const [index, line] of lines.entries()) {
		if (before[index] === after[index]) {
			result.push(...line.runs);
		} else {
			const mapped = remapTextToSegments(after[index], line.runs, undefined);
			if (line.runs[0] && mapped[0]) {
				Object.assign(mapped[0], inlineListParagraphMetadata(line.runs[0]));
			}
			result.push(...mapped);
		}
		if (line.terminator) {
			result.push(line.terminator);
		}
	}
	return { ...snapshot, text: transformedText, textSegments: result };
}
