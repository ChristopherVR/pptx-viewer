/**
 * Content-based pairing of the inline editor's paragraphs with the paragraphs
 * they were edited from, for {@link remapTextToSegments}.
 *
 * Mapping paragraph N of the edited text to original paragraph N is wrong as
 * soon as a paragraph is split (Enter in the middle of one), inserted, pasted
 * or deleted anywhere but the end: everything after the edit shifts by one and
 * borrows the level, paragraph properties and run styles of an unrelated
 * neighbour, and the last original falls off the end and loses its metadata.
 *
 * The heuristic, in order:
 *
 * 1. Both sides are normalised: the display-only bullet marker is dropped (the
 *    same `dedicatedBulletMarker` rule the remap uses to strip a rendered
 *    "1. " or "• " the editor echoes back) and the text is trimmed.
 * 2. Each edited/original pair gets an integer score. Identical text scores
 *    1000. When the shorter text survives intact inside the longer one (as a
 *    prefix, a suffix, or a prefix plus suffix around an insertion) the pair
 *    is a containment and scores 500 plus up to 250 by length ratio, which is
 *    what both halves of a split and a paragraph with words added or removed
 *    look like. Otherwise the shared prefix plus shared suffix must cover at
 *    least half of the shorter text (a partially retyped paragraph) and the
 *    pair scores up to 250. Anything else does not match.
 * 3. An order-preserving one-to-one alignment maximising the total score is
 *    chosen (longest-common-subsequence style dynamic programming). On equal
 *    totals the earlier edited paragraph keeps the match, so the first half
 *    of a split stays paired with its origin, and the earlier original wins.
 * 4. Unmatched edited paragraphs facing unmatched originals in the same gap
 *    between two matches pair positionally: a fully retyped paragraph keeps
 *    its slot instead of being treated as new.
 * 5. Every other unmatched edited paragraph is an insert (or the split-off
 *    tail) and inherits from the nearest preceding matched original - never
 *    from an unrelated later one. With no preceding match it inherits from
 *    the original paragraph that follows it (Enter at the very start).
 * 6. Unmatched paragraphs past the last original are appends and keep the
 *    append semantics (`continueAutoNumberedParagraph`, no paragraph
 *    metadata policy imposed).
 */
import type { TextSegment } from 'pptx-viewer-core';

import { dedicatedBulletMarker, withoutRenderedBulletPrefix } from './remap-text-bullets';

/** One paragraph of the original segments, with the terminator that ended it. */
export interface OriginalParagraph {
	segments: TextSegment[];
	/** The paragraph-break segment; core carries an empty paragraph's metadata on it. */
	terminator?: TextSegment;
}

/** How one edited paragraph relates to the original paragraphs. */
export type ParagraphMapping =
	/** Edited from `original`: restore its paragraph metadata. */
	| { kind: 'matched'; original: number }
	/** New paragraph inside the text, `offset` paragraphs after its `donor`. */
	| { kind: 'inserted'; donor: number; offset: number }
	/** New paragraph past the last original, `offset` paragraphs after it. */
	| { kind: 'appended'; donor: number; offset: number };

/** Split segments into paragraphs at every paragraph break, keeping the break. */
export function splitOriginalParagraphs(segments: readonly TextSegment[]): OriginalParagraph[] {
	const paragraphs: OriginalParagraph[] = [{ segments: [] }];
	for (const segment of segments) {
		if (segment.text === '\n' || segment.isParagraphBreak) {
			paragraphs[paragraphs.length - 1].terminator = segment;
			paragraphs.push({ segments: [] });
		} else {
			paragraphs[paragraphs.length - 1].segments.push(segment);
		}
	}
	return paragraphs;
}

/** The comparable content of an original paragraph (no marker, trimmed). */
export function originalParagraphText(paragraph: OriginalParagraph): string {
	const marker = dedicatedBulletMarker(paragraph.segments);
	return paragraph.segments
		.filter((segment) => segment !== marker)
		.map((segment) => segment.text)
		.join('')
		.trim();
}

/** The comparable content of an edited paragraph relative to `paragraph`'s marker. */
export function editedParagraphText(text: string, paragraph: OriginalParagraph): string {
	return withoutRenderedBulletPrefix(
		text,
		paragraph.segments,
		dedicatedBulletMarker(paragraph.segments),
	).trim();
}

const EXACT_SCORE = 1000;
const CONTAINMENT_BASE = 500;
const RATIO_WEIGHT = 250;
const PARTIAL_THRESHOLD = 0.5;

/** Integer similarity of two normalised paragraph texts; 0 means no match. */
export function paragraphSimilarity(edited: string, original: string): number {
	if (edited === original) {
		return EXACT_SCORE;
	}
	if (edited.length === 0 || original.length === 0) {
		return 0;
	}
	const shorter = Math.min(edited.length, original.length);
	const longer = Math.max(edited.length, original.length);
	let prefix = 0;
	while (prefix < shorter && edited[prefix] === original[prefix]) {
		prefix++;
	}
	let suffix = 0;
	while (
		suffix < shorter - prefix &&
		edited[edited.length - 1 - suffix] === original[original.length - 1 - suffix]
	) {
		suffix++;
	}
	const shared = prefix + suffix;
	if (shared === shorter) {
		return CONTAINMENT_BASE + Math.round((RATIO_WEIGHT * shorter) / longer);
	}
	const ratio = shared / shorter;
	return ratio >= PARTIAL_THRESHOLD ? Math.round(RATIO_WEIGHT * ratio) : 0;
}

/**
 * Order-preserving one-to-one alignment: for each edited paragraph the index
 * of the original it matches, or `undefined`.
 */
export function alignParagraphs(
	editedTexts: readonly string[],
	originals: readonly OriginalParagraph[],
): Array<number | undefined> {
	const originalTexts = originals.map(originalParagraphText);
	const score = (i: number, j: number): number =>
		paragraphSimilarity(editedParagraphText(editedTexts[i], originals[j]), originalTexts[j]);
	const rows = editedTexts.length;
	const cols = originals.length;
	const best: number[][] = Array.from({ length: rows + 1 }, () =>
		new Array<number>(cols + 1).fill(0),
	);
	for (let i = 1; i <= rows; i++) {
		for (let j = 1; j <= cols; j++) {
			const pair = score(i - 1, j - 1);
			best[i][j] = Math.max(
				best[i - 1][j],
				best[i][j - 1],
				pair > 0 ? best[i - 1][j - 1] + pair : 0,
			);
		}
	}
	const matches: Array<number | undefined> = new Array<number | undefined>(rows).fill(undefined);
	let i = rows;
	let j = cols;
	while (i > 0 && j > 0) {
		if (best[i][j] === best[i - 1][j]) {
			i--;
		} else if (best[i][j] === best[i][j - 1]) {
			j--;
		} else {
			matches[i - 1] = j - 1;
			i--;
			j--;
		}
	}
	return matches;
}

/** Decide, for every edited paragraph, which original it takes its metadata from. */
export function mapEditedParagraphs(
	editedTexts: readonly string[],
	originals: readonly OriginalParagraph[],
): ParagraphMapping[] {
	const matches = alignParagraphs(editedTexts, originals);
	const mappings: ParagraphMapping[] = [];
	let nextOriginal = 0;
	let anchor: number | undefined;
	let anchorEdited = -1;
	for (let i = 0; i < editedTexts.length; i++) {
		const matched = matches[i];
		if (matched !== undefined) {
			mappings.push({ kind: 'matched', original: matched });
			nextOriginal = matched + 1;
			anchor = matched;
			anchorEdited = i;
			continue;
		}
		const nextMatch = matches.slice(i + 1).find((match) => match !== undefined);
		const gapEnd = nextMatch ?? originals.length;
		if (nextOriginal < gapEnd) {
			mappings.push({ kind: 'matched', original: nextOriginal });
			anchor = nextOriginal;
			anchorEdited = i;
			nextOriginal++;
			continue;
		}
		if (nextMatch === undefined && nextOriginal >= originals.length) {
			mappings.push({ kind: 'appended', donor: originals.length - 1, offset: i - anchorEdited });
		} else if (anchor === undefined) {
			// Nothing precedes it: continue the paragraph that follows, in place.
			mappings.push({ kind: 'inserted', donor: nextOriginal, offset: 0 });
		} else {
			mappings.push({ kind: 'inserted', donor: anchor, offset: i - anchorEdited });
		}
	}
	return mappings;
}
