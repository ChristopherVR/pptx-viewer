/**
 * "Change Case" text mutation (PowerPoint's Aa dropdown: Sentence case, lower,
 * UPPER, Capitalize Each Word, tOGGLE cASE). Unlike `textCaps` (a purely
 * visual `text-transform`-style render hint), these modes rewrite the actual
 * characters, matching PowerPoint's own behaviour. Framework-agnostic; no
 * framework imports.
 */
import type { TextSegment } from 'pptx-viewer-core';

import type { InlineTextSelection } from './inline-selection-utils';

export type ChangeCaseMode = 'sentence' | 'lower' | 'upper' | 'capitalize' | 'toggle';

/** Sentence-ending punctuation that starts a new sentence for `'sentence'` mode. */
const SENTENCE_END_RE = /([.!?]\s+)/u;

/** Transform a plain-text string per the given Change Case mode. */
export function transformTextCase(text: string, mode: ChangeCaseMode): string {
	switch (mode) {
		case 'upper':
			return text.toUpperCase();
		case 'lower':
			return text.toLowerCase();
		case 'toggle':
			return Array.from(text)
				.map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()))
				.join('');
		case 'capitalize':
			return text.replace(
				/\p{L}[\p{L}\p{N}'’]*/gu,
				(word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
			);
		case 'sentence':
			return text
				.toLowerCase()
				.split(SENTENCE_END_RE)
				.map((part) => {
					const firstLetter = part.search(/\p{L}/u);
					if (firstLetter === -1) {
						return part;
					}
					return (
						part.slice(0, firstLetter) +
						part.charAt(firstLetter).toUpperCase() +
						part.slice(firstLetter + 1)
					);
				})
				.join('');
		default:
			return text;
	}
}

/**
 * Apply a Change Case transform to a set of text segments, either within an
 * inline-editor selection range (mirrors {@link applyStyleToSelectedSegments})
 * or, when `selection` is `null`, across every segment's text.
 */
export function applyCaseTransformToSegments(
	segments: TextSegment[],
	selection: InlineTextSelection | null,
	mode: ChangeCaseMode,
): TextSegment[] {
	if (!selection) {
		return segments.map((seg) =>
			seg.isParagraphBreak || seg.text === '\n'
				? seg
				: { ...seg, text: transformTextCase(seg.text, mode) },
		);
	}

	const { startSegIdx, startOffset, endSegIdx, endOffset } = selection;
	const result: TextSegment[] = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];

		if (seg.isParagraphBreak || seg.text === '\n' || i < startSegIdx || i > endSegIdx) {
			result.push(seg);
			continue;
		}

		const from = i === startSegIdx ? startOffset : 0;
		const to = i === endSegIdx ? endOffset : seg.text.length;

		if (from >= to) {
			result.push(seg);
			continue;
		}

		const before = seg.text.slice(0, from);
		const selected = transformTextCase(seg.text.slice(from, to), mode);
		const after = seg.text.slice(to);
		result.push({ ...seg, text: before + selected + after });
	}

	return result;
}
