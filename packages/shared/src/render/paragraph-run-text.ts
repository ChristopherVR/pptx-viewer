/**
 * The text each segment of a paragraph renders as, and what follows it.
 *
 * `buildParagraphRuns` needs both: the first to build a run, the second so
 * East Asian line breaking (`text-east-asian-breaks`) can decide a break AT a
 * run boundary by the same rules as one inside a run. PowerPoint ignores run
 * boundaries there (COM: `あいうえ` + a red `」たち` with `eaLnBrk="0"` puts
 * `」` at the start of line 2, exactly as one run does).
 *
 * @module paragraph-run-text
 */
import type { TextSegment } from 'pptx-viewer-core';

import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import { resolveRunEquation } from './text-run-meta';

/**
 * The text a segment renders: `\n` for a line break, a field's substituted
 * value, otherwise its own text. The field's own `a:fld/a:rPr@lang` wins over
 * the deck-wide locale for date/time formatting.
 */
export function resolveSegmentRunText(
	seg: TextSegment,
	fieldContext: FieldSubstitutionContext | undefined,
): string {
	const rawText = seg.isLineBreak ? '\n' : seg.text;
	return seg.fieldType
		? substituteFieldText(rawText, seg.fieldType, fieldContext, seg.style?.language)
		: rawText;
}

/**
 * For each segment, the text of the next segment that renders any (skipping
 * the bullet marker and empty runs), or `undefined` when an inline equation
 * or the paragraph end comes first: an equation is its own inline box, so no
 * character-level rule reaches across it.
 */
export function resolveFollowingSegmentTexts(
	paraSegments: readonly TextSegment[],
	markerSegment: TextSegment | undefined,
	fieldContext: FieldSubstitutionContext | undefined,
): Array<string | undefined> {
	const out: Array<string | undefined> = Array.from({ length: paraSegments.length });
	let following: string | undefined;
	for (let at = paraSegments.length - 1; at >= 0; at--) {
		out[at] = following;
		const seg = paraSegments[at];
		if (seg === markerSegment) {
			continue;
		}
		if (resolveRunEquation(seg)) {
			following = undefined;
			continue;
		}
		const text = resolveSegmentRunText(seg, fieldContext);
		if (text) {
			following = text;
		}
	}
	return out;
}
