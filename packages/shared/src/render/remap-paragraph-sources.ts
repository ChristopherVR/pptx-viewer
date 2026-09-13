import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import { withoutRenderedBulletPrefix } from './remap-text-bullets';

export interface RemapSourceParagraph {
	segments: TextSegment[];
	terminator?: TextSegment;
}

function matches(text: string, paragraph: RemapSourceParagraph): boolean {
	const first = paragraph.segments[0];
	const marker =
		first &&
		isBulletMarkerSegment(first) &&
		(!first.bulletInfo?.autoNumType || first.bulletInfo.paragraphIndex !== undefined)
			? first
			: undefined;
	const body = paragraph.segments
		.slice(marker ? 1 : 0)
		.map((segment) => segment.text)
		.join('');
	return text === body || withoutRenderedBulletPrefix(text, paragraph.segments, marker) === body;
}

/**
 * Preserve exact ordered paragraphs, matching duplicates from the ends first.
 * Interior anchors also survive when AutoCorrect changes a separate paragraph.
 * Gaps keep positional donors; extra paragraphs have no original metadata source.
 * This infers no moves or case equivalence from plain editor text.
 */
export function alignParagraphSources(
	texts: readonly string[],
	original: readonly RemapSourceParagraph[],
): Array<number | undefined> {
	const sources: Array<number | undefined> = Array.from({ length: texts.length });
	let prefix = 0;
	while (
		prefix < texts.length &&
		prefix < original.length &&
		matches(texts[prefix], original[prefix])
	) {
		sources[prefix] = prefix;
		prefix += 1;
	}
	let oldEnd = original.length;
	let newEnd = texts.length;
	while (oldEnd > prefix && newEnd > prefix && matches(texts[newEnd - 1], original[oldEnd - 1])) {
		sources[--newEnd] = --oldEnd;
	}
	const anchors: Array<[number, number]> = [];
	const oldCount = oldEnd - prefix;
	const newCount = newEnd - prefix;
	// Bound quadratic work for unusually large text bodies. Their ambiguous
	// middle retains positional behavior while exact prefix/suffix still work.
	if (oldCount * newCount <= 10_000) {
		const lengths = Array.from({ length: oldCount + 1 }, () => new Uint16Array(newCount + 1));
		for (let old = oldCount - 1; old >= 0; old--) {
			for (let next = newCount - 1; next >= 0; next--) {
				lengths[old][next] = matches(texts[prefix + next], original[prefix + old])
					? lengths[old + 1][next + 1] + 1
					: Math.max(lengths[old + 1][next], lengths[old][next + 1]);
			}
		}
		let old = 0;
		let next = 0;
		while (old < oldCount && next < newCount) {
			if (matches(texts[prefix + next], original[prefix + old])) {
				anchors.push([prefix + next++, prefix + old++]);
			} else if (lengths[old + 1][next] >= lengths[old][next + 1]) {
				// Ties discard the old candidate first, consistently with token diff.
				old++;
			} else {
				next++;
			}
		}
	}
	anchors.push([newEnd, oldEnd]);
	let oldCursor = prefix;
	let newCursor = prefix;
	for (const [newAnchor, oldAnchor] of anchors) {
		while (oldCursor < oldAnchor && newCursor < newAnchor) {
			sources[newCursor++] = oldCursor++;
		}
		if (newAnchor < newEnd) {
			sources[newAnchor] = oldAnchor;
		}
		oldCursor = oldAnchor + 1;
		newCursor = newAnchor + 1;
	}
	return sources;
}
