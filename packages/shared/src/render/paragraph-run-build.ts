/**
 * The two per-paragraph builders `buildParagraphs` composes: turning a
 * paragraph's segments into rendered runs, and styling its bullet marker.
 *
 * Split out of `text-paragraphs` to keep each module focused; both are pure and
 * reached through the same barrel, so no binding import changes.
 */

import type { TextSegment } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';

import { DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { ParagraphBulletResult } from './bullet-list';
import {
	buildScriptRunsFor,
	buildTabLinesFor,
	resolveRunExtrasContext,
} from './paragraph-run-enrich';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { substituteFieldText } from './text-field-substitution';
import type { RunFontSpec } from './text-metric-tracking';
import { applyUnderlineVariant } from './text-run-decoration';
import { buildRunEffectStyle } from './text-run-effects';
import type { RunEquation, RunHyperlink } from './text-run-meta';
import { resolveRunEquation, resolveRunHyperlink } from './text-run-meta';
import type { RunRuby } from './text-run-ruby';
import { resolveRunRuby } from './text-run-ruby';
import { authoredLetterSpacingPx, splitStyledRun } from './text-run-spacing';
import type { RunStyle } from './text-run-style';
import { resolveRunFont, segmentStyleToCss } from './text-run-style';
import type { ScriptFontFields, ScriptFontPiece } from './text-script-fonts';
import type { TabStopSpec } from './text-tab-layout';
import type { TabbedLineRun } from './text-tab-run-build';

/** One rendered run, as {@link buildParagraphRuns} emits it. */
export interface BuiltRun {
	text: string;
	style: RunStyle;
	hyperlink?: RunHyperlink;
	equation?: RunEquation;
	ruby?: RunRuby;
	segmentIndex?: number;
	charStart?: number;
	/**
	 * Per-script (`a:ea`/`a:cs`/`a:sym`) font-fallback pieces for this run's
	 * text, when it authors a distinct east-Asian / complex-script / symbol
	 * font the text actually needs. A binding renders these as nested spans
	 * instead of one plain text node. Absent for the common single-font case.
	 */
	scriptRuns?: ScriptFontPiece[];
	/**
	 * Measured tab-stop layout for this run's text, when it contains `\t` and
	 * the paragraph authors explicit tab stops (`a:tabLst`). Present INSTEAD OF
	 * the ordinary per-word metric split (see `buildParagraphRuns`), so a
	 * binding that sees this renders these lines/pieces rather than `text`
	 * directly. Absent for the common no-tab case.
	 */
	tabLines?: TabbedLineRun[];
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
	/** The body's own `a:ea`/`a:cs`/`a:sym` fields, for a run that authors none. */
	blockScriptStyle: ScriptFontFields | undefined;
	/** Parsed `a:pPr/a:tabLst` entries, when the body authors any. */
	tabStops: TabStopSpec[] | undefined;
	/** `a:pPr/@defTabSz` in px. */
	defaultTabSize: number | undefined;
	/** Context for `a:fld` substitution, when the caller supplied one. */
	fieldContext: FieldSubstitutionContext | undefined;
}

/**
 * Build one paragraph's runs: field-substituted text, per-run CSS, hyperlink,
 * inline equation, and the per-word metric split.
 */
export function buildParagraphRuns(input: ParagraphRunBuildInput): BuiltRun[] {
	const {
		paraSegments,
		paraIndices,
		markerSegment,
		fontScale,
		blockFont,
		blockScriptStyle,
		tabStops,
		defaultTabSize,
		fieldContext,
	} = input;
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
		const runFont = resolveRunFont(style, seg.style ?? {}, blockFont);
		// Per-script fonts and tab-stop layout are both resolved once per
		// SEGMENT (not per word-piece below): neither depends on which piece of
		// the segment's text is being rendered.
		const extrasCtx = resolveRunExtrasContext({
			seg,
			style,
			runFont,
			blockFont,
			blockScriptStyle,
			tabStops,
			defaultTabSize,
		});

		// A ruby run is emitted WHOLE, never through the per-word metric split
		// below: the annotation belongs to the whole segment, so splitting it
		// would repeat the same reading over every word of the base text.
		// (React, which looks a run's ruby up by `segmentIndex`, does exactly
		// that today for any multi-word `a:ruby`.)
		const ruby = resolveRunRuby(
			seg,
			typeof seg.style?.fontSize === 'number'
				? seg.style.fontSize
				: (blockFont.fontSizePx ?? DEFAULT_TEXT_FONT_SIZE),
			blockFont,
			typeof style.color === 'string' ? style.color : undefined,
		);
		if (ruby) {
			const rubyRun: BuiltRun = { text, style, ruby, segmentIndex, charStart: 0 };
			if (hyperlink) {
				rubyRun.hyperlink = hyperlink;
			}
			const rubyScriptRuns = buildScriptRunsFor(text, extrasCtx, style);
			if (rubyScriptRuns) {
				rubyRun.scriptRuns = rubyScriptRuns;
			}
			runs.push(rubyRun);
			continue;
		}

		// A run whose text contains an authored `\t` and whose body declares
		// explicit tab stops gets a MEASURED layout instead of the per-word
		// metric split below: per-stop alignment (`ctr`/`r`/`dec`) and leader
		// glyphs need the whole line's tab-separated pieces together, which the
		// metric split (word/gap granularity) would fragment. The layout itself
		// (`buildRunTabLines` / `text-tab-run-build.ts`) still gives each piece its
		// own PowerPoint advance-width correction, computed against the same
		// tracked width the pieces are positioned with, so this is no longer a
		// trade-off against the per-word split's metric FIDELITY - only its
		// per-word GRANULARITY, which does not matter here: a tab piece is one
		// fixed-position inline-block, never a wrappable word.
		const tabLines = buildTabLinesFor(text, extrasCtx, style);
		if (tabLines) {
			const run: BuiltRun = { text, style, tabLines, segmentIndex, charStart: 0 };
			if (hyperlink) {
				run.hyperlink = hyperlink;
			}
			runs.push(run);
			continue;
		}

		// Each word and each gap carries its own PowerPoint metric tracking, so a
		// line the browser assembles out of them measures exactly what PowerPoint
		// measured and breaks where PowerPoint breaks (#149). Emitting them as
		// sibling RUNS rather than nested spans is what gets this to
		// Vue/Svelte/Vanilla with no binding change: they already render one span
		// per run.
		let charStart = 0;
		for (const piece of splitStyledRun(text, style, runFont, authoredLetterSpacingPx(seg.style))) {
			const run: BuiltRun = { ...piece, segmentIndex, charStart };
			if (hyperlink) {
				run.hyperlink = hyperlink;
			}
			const scriptRuns = buildScriptRunsFor(piece.text, extrasCtx, piece.style);
			if (scriptRuns) {
				run.scriptRuns = scriptRuns;
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
