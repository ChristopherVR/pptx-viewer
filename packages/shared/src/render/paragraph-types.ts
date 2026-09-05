/**
 * The two descriptor types `buildParagraphs` (in `text-paragraphs.ts`) returns:
 * a single rendered run (`ParagraphRun`) and a rendered paragraph of them
 * (`RenderParagraph`). Every one of the five bindings imports these two types
 * from the package barrel to type its own run/paragraph components, so they
 * live in their own module rather than inside the (much longer) builder that
 * produces them - keeping `text-paragraphs.ts` itself under the repo's
 * ~300 LOC guideline without hiding the split behind a re-export shim: the
 * barrel (`render/index.ts`) exports this module directly, so no importer
 * (inside `pptx-viewer-shared` or across the five bindings) has to change its
 * import path, since every one of them already goes through the package root
 * (`pptx-viewer-shared`), never a deep `.../text-paragraphs` path.
 */

import type { PictureBulletMarker } from './bullet-list';
import type { ReflectionWrapperStyle } from './reflection';
import type { RunEquation, RunHyperlink } from './text-run-meta';
import type { RunRuby } from './text-run-ruby';
import type { RunStyle } from './text-run-style';
import type { ScriptFontPiece } from './text-script-fonts';
import type { TabbedLineRun } from './text-tab-run-build';

/** A single rendered run within a paragraph. */
export interface ParagraphRun {
	text: string;
	style: RunStyle;
	/**
	 * The run's hyperlink (`a:hlinkClick` / `a:hlinkMouseOver`), when it has one.
	 * A binding renders the run inside an `<a href>` when {@link RunHyperlink.href}
	 * is set, and routes {@link RunHyperlink.url} to its click handler otherwise
	 * (internal `ppaction://` slide jumps).
	 */
	hyperlink?: RunHyperlink;
	/**
	 * An inline equation (`m:oMath`) this run renders INSTEAD of `text`, which is
	 * empty for it. Emitted in the run sequence so the maths lands at its
	 * authored position between the runs around it.
	 */
	equation?: RunEquation;
	/**
	 * The run's phonetic guide (`a:ruby`: furigana, pinyin, bopomofo), when it
	 * has one. A binding renders `<ruby>{text}<rt style>{ruby.text}</rt></ruby>`;
	 * a run carrying one is never split per word, so the annotation appears once
	 * over the whole base run.
	 *
	 * Core parsed and saved ruby from the start, but `buildParagraphs` never read
	 * it, so the annotation rendered in React alone.
	 */
	ruby?: RunRuby;
	/**
	 * Index of the `textSegments` entry (of the override list when one was
	 * supplied) this run was built from.
	 *
	 * Shared splits one authored run into several per-word runs for PowerPoint's
	 * metric tracking, so this is many-to-one. It is the seam a binding uses to
	 * reach the facts the neutral model does not carry - React's find-match
	 * highlights, per-script font spans, tab stops and ruby all key off the
	 * originating segment - without regrouping the segments itself and drifting
	 * from the grouping here.
	 */
	segmentIndex?: number;
	/**
	 * Offset of this run's `text` within its segment's RENDERED text (after field
	 * substitution), so a caller holding per-segment character offsets can map
	 * them onto the split runs.
	 */
	charStart?: number;
	/**
	 * Per-script (`a:ea`/`a:cs`/`a:sym`) font-fallback pieces for this run's
	 * text, when a script it contains needs a font distinct from its own. A
	 * binding renders these as nested spans in place of `text` (see
	 * `text-script-fonts.ts`); absent for the common single-font case.
	 */
	scriptRuns?: ScriptFontPiece[];
	/**
	 * Measured tab-stop layout for this run's text, present when it contains an
	 * authored `\t` and the paragraph declares explicit tab stops. A binding
	 * renders these lines/pieces in place of `text`, honouring per-stop
	 * alignment and leader glyphs a plain CSS `tab-size` cannot express (see
	 * `text-tab-run-build.ts`). Absent for the common no-tab case.
	 */
	tabLines?: TabbedLineRun[];
	/**
	 * `a:rPr/@u="words"` word/gap pieces of a RUBY run's base text, present only
	 * when such a run's underline is `words` (the ordinary per-word split emits
	 * sibling runs instead; a tab piece carries its own `words`). Same shape as
	 * `scriptRuns` and rendered the same way, in place of `text`: a word entry
	 * carries the decoration for its own span, a gap entry is bare text. The
	 * run's own `style` has the underline stripped when this is set (see
	 * `paragraph-run-build.ts`).
	 */
	underlineWordPieces?: ScriptFontPiece[];
	/**
	 * `a:reflection` mirrored-sibling wrapper style for this run (the text-run
	 * counterpart of a shape/picture's `ComputedEffectStyle.reflection`), or
	 * `undefined` for the common no-reflection case. A binding renders a sibling
	 * node just below the run's own, painted with the same text, positioned and
	 * masked by this style - see `render/reflection.ts`'s
	 * `getTextReflectionWrapperStyle`.
	 */
	reflection?: ReflectionWrapperStyle;
}

/** A rendered paragraph: runs plus resolved bullet + hanging-indent metadata. */
export interface RenderParagraph {
	runs: ParagraphRun[];
	/** Bullet glyph / number to render before the runs (or `undefined`). */
	bulletMarker?: string;
	/** Picture marker rendered before runs, or fallback metadata when unresolved. */
	bulletPicture?: PictureBulletMarker;
	/** Inline style for the bullet marker (font / size / colour). */
	bulletStyle: RunStyle;
	/** `margin-left` in px for the whole paragraph (hanging-indent layout). */
	marginLeftPx?: number;
	/** `text-indent` in px (first-line / hanging indent). */
	textIndentPx?: number;
	/**
	 * Per-paragraph `line-height` from this paragraph's own `a:pPr > a:lnSpc`.
	 * A unitless multiplier for proportional spacing (`a:spcPct`) or a `"<n>pt"`
	 * string for exact spacing (`a:spcPts`). Undefined when the paragraph does
	 * not override spacing (binding keeps the body-level line-height).
	 */
	lineHeight?: number | string;
	/** `margin-top` in px from this paragraph's `a:pPr > a:spcBef` (space before). */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from this paragraph's `a:pPr > a:spcAft` (space after). */
	spaceAfterPx?: number;
	/**
	 * `font-size` in px to set on the paragraph element so its CSS line boxes
	 * are built from its OWN runs rather than the text body's default size.
	 * Undefined when the paragraph already matches the body default.
	 *
	 * See `resolveParagraphStrutFontSize` for why this is needed: without it a
	 * paragraph of small runs inside a larger-defaulting body is laid out on
	 * too-tall lines and overflows its shape.
	 */
	strutFontSizePx?: number;
	/**
	 * True when the paragraph has no runs and no bullet: an authored blank line
	 * (`<a:p><a:endParaRPr/></a:p>`).
	 *
	 * PowerPoint gives such a paragraph a full line box, which is how decks
	 * space a heading away from the bullet list under it. A binding must render
	 * something with height for it (a `<br>`), or the gap disappears and the
	 * block reads as one dense run of text (issue #131, slides 13-14).
	 */
	isEmpty?: boolean;
	/**
	 * Indices of this paragraph's segments in the rendered segment list (the
	 * override list when one was supplied), in authored order and INCLUDING the
	 * bullet-marker segment the runs drop.
	 *
	 * The seam a binding uses to reach paragraph facts the neutral model does not
	 * carry, without regrouping the segments itself and drifting from the
	 * grouping here - which is exactly how React ended up splitting on every
	 * `"\n"` and treating a soft `a:br` as a paragraph break.
	 */
	segmentIndices: number[];
	/**
	 * True when this paragraph resolves right-to-left (`a:pPr/@rtl`, or the text
	 * body's default). A binding that mirrors its hanging indent for RTL reads
	 * this; the direction itself is already in {@link paragraphStyle}.
	 */
	rtl?: boolean;
	/**
	 * Extra CSS for the paragraph box, beyond the margin / indent / spacing
	 * fields above: this paragraph's own `text-align` (`a:pPr/@algn`), its BiDi
	 * `direction`, and the kinsoku line-breaking rules (`@eaLnBrk`,
	 * `@latinLnBrk`, `@hangingPunct`). Absent when the paragraph overrides none
	 * of them, which is the common case.
	 *
	 * All three used to be resolved in React's private paragraph renderer only,
	 * so a deck that centred one paragraph of a left-aligned body, or set CJK
	 * break rules, rendered differently in the other four bindings.
	 */
	paragraphStyle?: RunStyle;
}
