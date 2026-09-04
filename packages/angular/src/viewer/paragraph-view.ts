import type { PptxElement, TextSegment } from 'pptx-viewer-core';

import { buildParagraphs } from '../internal/shared';
import type {
	FieldSubstitutionContext,
	PictureBulletMarker,
	ReflectionWrapperStyle,
	ScriptFontPiece,
	TabbedLineRun,
} from '../internal/shared';
import type { StyleMap } from './element-style';

/**
 * Angular's paragraph view model, built from the SHARED `buildParagraphs`.
 *
 * This module replaces the ~190-line hand-ported paragraph builder that used to
 * live inside `element-renderer.component.ts` (self-documented as "hand-ported
 * from `buildParagraphs`"). That copy had already drifted: it applied a
 * paragraph's bullet unconditionally, with none of shared's "suppress the
 * bullet on a paragraph with no visible text" rule, so a whitespace-only or
 * marker-only paragraph painted a stray bullet here and nothing elsewhere.
 *
 * It also replaces the segment walk that used to follow the shared call. Runs
 * carry their own `hyperlink` and `equation` now (see `text-run-meta`), so the
 * walk that re-attached those two facts by matching each run's characters back
 * onto the segment it came from is gone, and Vue, Svelte and Vanilla render
 * both from the same model instead of dropping them.
 *
 * What is left here is a pure rename: shared's neutral field names onto the
 * ones this binding's template already binds.
 */

/** A single rendered run inside an Angular paragraph. */
export interface TextRun {
	text: string;
	style: StyleMap;
	/** Safe `href` when this run carries a renderable hyperlink. */
	href?: string;
	/** Hyperlink tooltip / title text. */
	tooltip?: string;
	/** `<a target>`, from `a:hlinkClick/@tgtFrame` when authored, else `_blank`. */
	target?: string;
	/** `<a rel>` paired with {@link target}. */
	rel?: string;
	/** Parsed OMML for an inline equation run (rendered as MathML). */
	equationXml?: Record<string, unknown>;
	/** Optional equation number for numbered equations. */
	equationNumber?: string;
	/** `a:ruby` phonetic guide (furigana / pinyin) rendered above this run. */
	rubyText?: string;
	/** `[ngStyle]` map for the `<rt>` annotation (size / family / alignment). */
	rubyStyle?: StyleMap;
	/**
	 * Per-script (`a:ea`/`a:cs`/`a:sym`) font-fallback pieces for this run's
	 * text, when it authors a distinct east-Asian / complex-script / symbol
	 * font the text actually needs. The template renders these as nested spans
	 * instead of `text`. Absent for the common single-font case.
	 */
	scriptRuns?: ScriptFontPiece[];
	/**
	 * Measured tab-stop layout for this run's text, present when it contains an
	 * authored `\t` and the paragraph declares explicit tab stops. The template
	 * renders these lines/pieces instead of `text`, honouring per-stop
	 * alignment and leader glyphs a plain CSS `tab-size` cannot express.
	 */
	tabLines?: TabbedLineRun[];
	/**
	 * `a:reflection` mirrored-sibling wrapper style for this run, or `undefined`
	 * for the common no-reflection case - the text-run counterpart of a
	 * shape/picture's `ReflectionOverlay` (`element-effect-defs.ts`). The
	 * template renders a sibling `<span>` positioned/masked by this style,
	 * painted with the same text, instead of the old `-webkit-box-reflect`
	 * (Firefox never implemented that property).
	 */
	reflection?: ReflectionWrapperStyle;
}

/** A rendered paragraph: runs plus bullet + indent + spacing metadata. */
export interface Paragraph {
	runs: TextRun[];
	/** Bullet / number marker text, when this paragraph is a list item. */
	bulletMarker?: string;
	/** Resolved picture marker, or metadata for its accessible glyph fallback. */
	bulletPicture?: PictureBulletMarker;
	/** `[ngStyle]` map for the bullet marker (colour / font / hang width). */
	bulletStyle: StyleMap;
	/** Left indent in px (hanging-indent layout). */
	indentPx: number;
	/** `text-indent` in px (first-line / hanging indent), when authored. */
	textIndentPx?: number;
	/**
	 * True when the paragraph has no runs and no bullet: an authored blank line
	 * (`<a:p><a:endParaRPr/></a:p>`), which PowerPoint gives a full line box.
	 * The template renders a `<br>` for it so the gap survives (issue #131).
	 */
	isEmpty?: boolean;
	/** Per-paragraph `line-height` from this paragraph's own `a:lnSpc`. */
	lineHeight?: number | string;
	/** `margin-top` in px from `a:spcBef` (space before), when overridden. */
	spaceBeforePx?: number;
	/** `margin-bottom` in px from `a:spcAft` (space after), when overridden. */
	spaceAfterPx?: number;
	/** `font-size` in px re-basing the paragraph's CSS line boxes onto its runs. */
	strutFontSizePx?: number;
	/**
	 * This paragraph's own `text-align` / BiDi `direction` / kinsoku line-break
	 * rules, when it overrides the body's. Bound with `[ngStyle]` under the
	 * explicit geometry bindings, which win.
	 */
	paragraphStyle?: StyleMap;
}

/**
 * Build the Angular paragraph view model for an element.
 *
 * `segmentOverrides` is the slice of an `a:linkedTxbx` chain this box paints
 * (see `getOverflowSegments`); shared threads it through so a chain resolves
 * identically in all five bindings.
 */
export function buildAngularParagraphs(
	element: PptxElement,
	fieldContext?: FieldSubstitutionContext,
	segmentOverrides?: readonly TextSegment[],
): Paragraph[] {
	return buildParagraphs(element, fieldContext, segmentOverrides).map((para) => ({
		runs: para.runs.map((run) => {
			const out: TextRun = { text: run.text, style: run.style };
			// A `ppaction://` slide jump resolves to no `href` (shared refuses to
			// make an internal action look like a URL) and this binding has no
			// click handler for one, so it renders as plain text - unchanged.
			if (run.hyperlink?.href) {
				out.href = run.hyperlink.href;
				out.tooltip = run.hyperlink.tooltip;
				out.target = run.hyperlink.target ?? '_blank';
				out.rel = run.hyperlink.rel ?? 'noopener noreferrer';
			}
			if (run.equation) {
				out.equationXml = run.equation.xml;
				out.equationNumber = run.equation.number;
			}
			// `a:ruby`: the phonetic guide. Rendered nowhere but React until wave 4,
			// because `buildParagraphs` never carried it.
			if (run.ruby) {
				out.rubyText = run.ruby.text;
				out.rubyStyle = run.ruby.style;
			}
			if (run.scriptRuns) {
				out.scriptRuns = run.scriptRuns;
			}
			if (run.tabLines) {
				out.tabLines = run.tabLines;
			}
			if (run.reflection) {
				out.reflection = run.reflection;
			}
			return out;
		}),
		bulletMarker: para.bulletMarker,
		bulletPicture: para.bulletPicture,
		bulletStyle: para.bulletStyle,
		indentPx: para.marginLeftPx ?? 0,
		textIndentPx: para.textIndentPx,
		isEmpty: para.isEmpty,
		lineHeight: para.lineHeight,
		spaceBeforePx: para.spaceBeforePx,
		spaceAfterPx: para.spaceAfterPx,
		strutFontSizePx: para.strutFontSizePx,
		paragraphStyle: para.paragraphStyle,
	}));
}
