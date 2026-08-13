/**
 * The two per-paragraph builders `buildParagraphs` composes: turning a
 * paragraph's segments into rendered runs, and styling its bullet marker.
 *
 * Split out of `text-paragraphs` to keep each module focused; both are pure and
 * reached through the same barrel, so no binding import changes.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import type { ParagraphBulletResult } from './bullet-list';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import type { RunFontSpec } from './text-metric-tracking';
import { buildRunEffectStyle } from './text-run-effects';
import type { RunEquation, RunHyperlink } from './text-run-meta';
import { resolveRunEquation, resolveRunHyperlink } from './text-run-meta';
import type { RunStyle } from './text-run-style';
import {
	applyUnderlineVariant,
	authoredLetterSpacingPx,
	resolveRunFont,
	segmentStyleToCss,
	splitStyledRun,
} from './text-run-style';

/** One rendered run, as {@link buildParagraphRuns} emits it. */
export interface BuiltRun {
	text: string;
	style: RunStyle;
	hyperlink?: RunHyperlink;
	equation?: RunEquation;
	segmentIndex?: number;
	charStart?: number;
}

/** Everything the run builder needs besides the paragraph's own segments. */
export interface ParagraphRunBuildInput {
	/** This paragraph's segments, in authored order. */
	paraSegments: readonly TextSegment[];
	/** Each entry's index in the rendered segment list, parallel to the above. */
	paraIndices: readonly number[];
	/** The core-inserted bullet-marker segment to drop, when there is one. */
	markerSegment: TextSegment | undefined;
	/** The body's `a:normAutofit/@fontScale`. */
	fontScale: number;
	/** What a run that declares no font of its own inherits from the body. */
	blockFont: RunFontSpec;
	/** Context for `a:fld` substitution, when the caller supplied one. */
	fieldContext: FieldSubstitutionContext | undefined;
}

/**
 * Build one paragraph's runs: field-substituted text, per-run CSS, hyperlink,
 * inline equation, and the per-word metric split.
 */
export function buildParagraphRuns(input: ParagraphRunBuildInput): BuiltRun[] {
	const { paraSegments, paraIndices, markerSegment, fontScale, blockFont, fieldContext } = input;
	const runs: BuiltRun[] = [];
	for (const [at, seg] of paraSegments.entries()) {
		if (seg === markerSegment) {
			continue;
		}
		const segmentIndex = paraIndices[at];
		// An inline equation carries no text at all (`a:t` is empty and the maths
		// lives in a sibling `m:oMath`), so it has to be emitted before the
		// `if (text)` guard below or it disappears - which is exactly what
		// happened in Vue, Svelte and Vanilla.
		const equation = resolveRunEquation(seg);
		if (equation) {
			runs.push({
				text: '',
				style: segmentStyleToCss(seg, fontScale, { blockFont }),
				equation,
				segmentIndex,
				charStart: 0,
			});
			continue;
		}
		const rawText = seg.isLineBreak ? '\n' : seg.text;
		const text = seg.fieldType
			? substituteFieldText(rawText, seg.fieldType, fieldContext)
			: rawText;
		if (!text) {
			continue;
		}
		const style = segmentStyleToCss(seg, fontScale, { text, blockFont });
		applyUnderlineVariant(style, seg);
		// Per-run text effects (gradient/pattern fill, outer/inner shadow, 3D
		// extrusion text-shadow, blur, HSL, alpha opacity, glow, reflection).
		// No-op `{}` for plain runs, so ordinary text is unchanged.
		if (seg.style) {
			Object.assign(style, buildRunEffectStyle(seg.style));
		}
		const hyperlink = resolveRunHyperlink(seg.style);
		// Each word and each gap carries its own PowerPoint metric tracking, so a
		// line the browser assembles out of them measures exactly what PowerPoint
		// measured and breaks where PowerPoint breaks (#149). Emitting them as
		// sibling RUNS rather than nested spans is what gets this to
		// Vue/Svelte/Vanilla with no binding change: they already render one span
		// per run.
		let charStart = 0;
		for (const piece of splitStyledRun(
			text,
			style,
			resolveRunFont(style, seg.style ?? {}, blockFont),
			authoredLetterSpacingPx(seg.style),
		)) {
			const run: BuiltRun = { ...piece, segmentIndex, charStart };
			if (hyperlink) {
				run.hyperlink = hyperlink;
			}
			runs.push(run);
			charStart += piece.text.length;
		}
	}
	return runs;
}

/**
 * The bullet marker's own inline style: colour, typeface, weight/slant, size,
 * and the box that reserves the hanging distance.
 */
export function buildBulletMarkerStyle(
	bullet: ParagraphBulletResult | undefined,
	firstSeg: TextSegment | undefined,
	fontScale: number,
	textIndentPx: number | undefined,
): RunStyle {
	const bulletStyle: RunStyle = {};
	if (!bullet) {
		return bulletStyle;
	}
	if (bullet.color) {
		bulletStyle.color = bullet.color;
	}
	if (bullet.fontFamily) {
		bulletStyle.fontFamily = bullet.fontFamily;
	} else if (firstSeg?.style?.fontFamily) {
		// A bullet that declares no `a:buFont` is painted in the paragraph's own
		// typeface, which is what React does (the marker rides the first segment's
		// span). Leaving it to inherit the text BODY's declaration picked a
		// different family whenever the first run overrode it, and a marker glyph's
		// advance is what positions the whole first line.
		bulletStyle.fontFamily = getSubstituteFontFamily(firstSeg.style.fontFamily);
	}
	// Weight / slant come from the marker's OWN segment, never from the text
	// body: a bold heading whose marker segment core parsed as regular painted a
	// bold glyph here and a regular one in React, and a heavier marker is also a
	// wider one, so the first line started further in.
	bulletStyle.fontWeight = firstSeg?.style?.bold ? 700 : 400;
	bulletStyle.fontStyle = firstSeg?.style?.italic ? 'italic' : 'normal';
	// The marker shrinks with the body's autofit scale exactly as its runs do (an
	// explicit `a:buSzPts` is an absolute size and stays put).
	const runFontSize = firstSeg?.style?.fontSize;
	if (typeof bullet.sizePts === 'number') {
		bulletStyle.fontSize = `${bullet.sizePts}px`;
	} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
		bulletStyle.fontSize = `${runFontSize * fontScale * (bullet.sizePercent / 100)}px`;
	} else if (fontScale !== 1 && typeof runFontSize === 'number') {
		bulletStyle.fontSize = `${runFontSize * fontScale}px`;
	}
	// PowerPoint draws the marker at `marL + indent` and starts the text at
	// `marL`, so the marker's box is exactly the hanging distance wide. Reserving
	// it here is what makes the runs line up on the indent stop instead of butting
	// straight against the glyph, and it removes the need for a spacer character
	// after the marker: a non-breaking space inherits the marker's font, and
	// Wingdings maps U+00A0 to a visible dot, which painted a second bullet
	// (issue #131, slides 13-14).
	const hangPx = typeof textIndentPx === 'number' && textIndentPx < 0 ? -textIndentPx : undefined;
	bulletStyle.display = 'inline-block';
	// `text-indent` inherits, and an inline-block is a block container: without
	// this reset the marker box applies the paragraph's negative first-line indent
	// AGAIN internally and paints the glyph a full hang-width left of its own box
	// (outside the text inset).
	bulletStyle.textIndent = '0px';
	if (hangPx !== undefined) {
		bulletStyle.minWidth = `${hangPx}px`;
	} else {
		bulletStyle.marginInlineEnd = '0.35em';
	}
	return bulletStyle;
}
