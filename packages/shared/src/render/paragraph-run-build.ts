/**
 * `buildParagraphRuns`: turns a paragraph's segments into rendered runs.
 * Split out of `text-paragraphs` to keep each module focused; the bullet
 * marker builder this module used to also hold lives in
 * `paragraph-bullet-marker-style.ts` (re-exported here unchanged), and both
 * are reached through the same barrel, so no binding import changes.
 */

import type { TextSegment } from 'pptx-viewer-core';

import { DEFAULT_TEXT_FONT_SIZE } from '../constants';
import {
	applyRunReflection,
	buildScriptRunsFor,
	buildTabLinesFor,
	resolveRunExtrasContext,
	resolveRunReflection,
} from './paragraph-run-enrich';
import { resolveFollowingSegmentTexts, resolveSegmentRunText } from './paragraph-run-text';
import { resolveParagraphStrutFontSize } from './paragraph-strut';
import type { ReflectionWrapperStyle } from './reflection';
import { splitWordsForUnderline, splitsUnderlineIntoWords } from './text-decoration';
import { splitEastAsianRunPieces } from './text-east-asian-breaks';
import type { EastAsianBreakOptions } from './text-east-asian-breaks';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { applyFontAlignmentFallback } from './text-font-alignment';
import type { RunFontSpec } from './text-metric-tracking';
import { applyUnderlineVariant, nestedTextDecorationStyle } from './text-run-decoration';
import { buildRunEffectStyle } from './text-run-effects';
import { stitchContinuousGradientFill } from './text-run-gradient-span';
import type { RunEquation, RunHyperlink } from './text-run-meta';
import { resolveRunEquation, resolveRunHyperlink } from './text-run-meta';
import type { RunRuby } from './text-run-ruby';
import { resolveRunRuby } from './text-run-ruby';
import {
	authoredLetterSpacingPx,
	splitStyledRun,
	stripUnderlineDecoration,
} from './text-run-spacing';
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
	 * font the text actually needs. Absent for the common single-font case.
	 */
	scriptRuns?: ScriptFontPiece[];
	/**
	 * Measured tab-stop layout for this run's text, when it contains `\t` and
	 * the paragraph authors explicit tab stops (`a:tabLst`). Present INSTEAD OF
	 * the ordinary per-word metric split (see `buildParagraphRuns`). Absent for
	 * the common no-tab case.
	 */
	tabLines?: TabbedLineRun[];
	/** `a:reflection` mirrored-sibling wrapper (see `resolveRunReflection`). */
	reflection?: ReflectionWrapperStyle;
	/**
	 * `a:rPr/@u="words"` word/gap pieces of THIS run's own `text` (see
	 * `splitWordsForUnderline`), present only on a `ruby` run whose underline
	 * is `words`: the ruby annotation reads over the whole base text, so (unlike
	 * the ordinary per-word split, which emits separate sibling `BuiltRun`s) the
	 * base text has to stay ONE run and this instead lets a binding wrap each
	 * word in its own nested span, keeping the single `<ruby>` element intact.
	 * Same shape as `scriptRuns`: a word entry carries the run's decoration
	 * subset for its own span, a gap entry has no `style` and renders as bare
	 * text. When present the run's own `style` has had its underline STRIPPED
	 * (an ancestor's underline is drawn through every inline descendant, so a
	 * nested gap could never lose it otherwise); a binding renders these in
	 * place of `text`, exactly as it renders `scriptRuns`.
	 */
	underlineWordPieces?: ScriptFontPiece[];
	/** The advance-carrying space after a hanging `、`/`。` (`text-east-asian-breaks`). */
	hangingSpace?: true;
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
	/** This paragraph's own (or the body's, when it authors none) `a:pPr/@defTabSz` in px. */
	defaultTabSize: number | undefined;
	/**
	 * This paragraph's own (or the body's) `a:pPr/@fontAlgn`, applied to every run
	 * as a `vertical-align` fallback - a run's own baseline shift always wins.
	 */
	fontAlignment: string | undefined;
	/** Context for `a:fld` substitution, when the caller supplied one. */
	fieldContext: FieldSubstitutionContext | undefined;
	/** Whether the paragraph is right-to-left (tab stops measure from the right). */
	rtl?: boolean;
	/** `@hangingPunct` / `@eaLnBrk="0"` pieces (see `text-east-asian-breaks`). */
	eastAsianBreaks?: EastAsianBreakOptions;
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
		fontAlignment,
		fieldContext,
		rtl,
		eastAsianBreaks,
	} = input;
	const runs: BuiltRun[] = [];
	// What follows each segment, so an East Asian break AT a run boundary obeys
	// the same rules as one inside a run (COM: PowerPoint ignores the boundary).
	const followingTexts = eastAsianBreaks
		? resolveFollowingSegmentTexts(paraSegments, markerSegment, fieldContext)
		: undefined;
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
			const equationStyle = segmentStyleToCss(seg, fontScale, { blockFont });
			// `m:oMath` carries no `a:rPr/@sz` of its own, so `segmentStyleToCss`
			// (which only sets `fontSize` when the SEGMENT authors one) leaves it
			// unset here, and the equation's `<span>` fell back to whatever
			// `font-size` its ancestor happened to resolve to. That is not a
			// stable fact: it is a coincidence of DOM nesting rather than a shared
			// decision, and it broke Vue, Angular, Svelte and Vanilla for
			// `LinkedAndMaths` (text-layout.pptx): the paragraph's own runs are
			// 14pt while the shape default is 24pt, and the equation inherited the
			// 24pt shape default there instead of the paragraph's own 14pt, while
			// React's different DOM nesting happened to inherit the right value.
			// Setting it explicitly, from the same "smallest run in the
			// paragraph" rule the line-height strut uses (falling back to the
			// body default when the paragraph declares nothing smaller), makes
			// the size a decision every binding reaches identically instead of
			// one that depends on how deep the equation node sits.
			if (typeof equationStyle.fontSize !== 'string') {
				// `resolveParagraphStrutFontSize` compares its segments' RAW
				// (pre-`fontScale`) sizes against the body's own RAW size, then
				// scales the result itself - the same contract `text-paragraphs.ts`
				// calls it under. `blockFont.fontSizePx` is already scaled (see
				// `RunFontSpec.fontSizePx`'s doc comment), so it is un-scaled back
				// here rather than passed straight through, which would compare a
				// scaled body size against unscaled run sizes and double-scale the
				// fallback below.
				const bodyFontSizeRaw =
					typeof blockFont.fontSizePx === 'number' && fontScale !== 0
						? blockFont.fontSizePx / fontScale
						: blockFont.fontSizePx;
				const strutFontSize = resolveParagraphStrutFontSize(
					paraSegments,
					bodyFontSizeRaw,
					fontScale,
				);
				const fallbackFontSize = strutFontSize ?? blockFont.fontSizePx ?? DEFAULT_TEXT_FONT_SIZE;
				equationStyle.fontSize = `${fallbackFontSize}px`;
			}
			runs.push({
				text: '',
				style: equationStyle,
				equation,
				segmentIndex,
				charStart: 0,
			});
			continue;
		}
		const text = resolveSegmentRunText(seg, fieldContext);
		if (!text) {
			continue;
		}
		const style = segmentStyleToCss(seg, fontScale, { text, blockFont });
		applyUnderlineVariant(style, seg);
		// `u="words"`: word/gap pieces so only the words carry the underline.
		// Computed once here (not just in the plain per-word-split branch below)
		// because the ruby and tab-stop branches below also need it: both emit
		// the run as ONE piece (never through `splitStyledRun`'s per-word split),
		// so without this they fell back to `resolveUnderlineDecorationStyle`'s
		// continuous-underline approximation even when the run's OWN text has
		// no ruby/tab in the way.
		const underlineWords = splitsUnderlineIntoWords(seg.style);
		// `a:pPr/@fontAlgn` positions the run within the LINE box when the
		// paragraph mixes run sizes; a run's own super/subscript shift always
		// wins (see `applyFontAlignmentFallback`).
		applyFontAlignmentFallback(style, fontAlignment);
		// Per-run text effects (gradient/pattern fill, outer/inner shadow, 3D
		// extrusion text-shadow, blur, HSL, alpha opacity). No-op `{}` for plain
		// runs, so ordinary text is unchanged.
		if (seg.style) {
			Object.assign(style, buildRunEffectStyle(seg.style));
		}
		const reflection = resolveRunReflection(seg.style, blockFont);
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
			rtl,
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
			applyRunReflection(rubyRun, reflection);
			const rubyScriptRuns = buildScriptRunsFor(text, extrasCtx, style);
			if (rubyScriptRuns) {
				rubyRun.scriptRuns = rubyScriptRuns;
			}
			// `u="words"` + ruby: the base text stays ONE run (the annotation
			// reads over the whole thing, not per word), so the per-word gap
			// cannot come from splitting into sibling runs the way the plain
			// path does. `underlineWordPieces` gives a binding the same word/gap
			// breakdown to render as nested spans INSIDE this run's base text
			// instead, without touching the ruby annotation itself; the run's
			// own span gives up the underline so it is not drawn through the gaps.
			// A run that also needs per-script font spans keeps the continuous
			// fallback: those pieces render in place of the text too, and the two
			// splits do not compose.
			if (underlineWords && !rubyScriptRuns) {
				const words = splitWordsForUnderline(text);
				if (words.length > 0) {
					const decoration = nestedTextDecorationStyle(style);
					rubyRun.style = stripUnderlineDecoration(style);
					rubyRun.underlineWordPieces = words.map((word) =>
						word.underline && decoration
							? { text: word.text, style: decoration }
							: { text: word.text },
					);
				}
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
		const tabLines = buildTabLinesFor(text, extrasCtx, style, underlineWords);
		if (tabLines) {
			const run: BuiltRun = { text, style, tabLines, segmentIndex, charStart: 0 };
			if (hyperlink) {
				run.hyperlink = hyperlink;
			}
			applyRunReflection(run, reflection);
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
		for (const { sourceLength, ...piece } of splitEastAsianRunPieces(
			splitStyledRun(text, style, runFont, authoredLetterSpacingPx(seg.style), underlineWords),
			eastAsianBreaks,
			runFont,
			followingTexts?.[at],
		)) {
			const run: BuiltRun = { ...piece, segmentIndex, charStart };
			if (hyperlink) {
				run.hyperlink = hyperlink;
			}
			applyRunReflection(run, reflection);
			const scriptRuns = buildScriptRunsFor(piece.text, extrasCtx, piece.style);
			if (scriptRuns) {
				run.scriptRuns = scriptRuns;
			}
			runs.push(run);
			charStart += sourceLength;
		}
	}
	// Adjacent runs authored with the identical gradient/pattern text fill
	// (`p(r('GRADIENT ', grad) + r('SPANS RUNS', grad))`) paint as ONE
	// continuous fill in PowerPoint, not two independent 0%-100% fills.
	stitchContinuousGradientFill(runs);
	return runs;
}

// Re-exported so existing `import { buildBulletMarkerStyle } from
// './paragraph-run-build'` call sites (`text-paragraphs.ts`) keep working
// unchanged now that the bullet-marker builder lives in its own module (kept
// under this repo's ~300-LOC guideline).
export { buildBulletMarkerStyle } from './paragraph-bullet-marker-style';
