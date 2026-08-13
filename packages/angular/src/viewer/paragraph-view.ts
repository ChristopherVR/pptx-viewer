import type { PptxElement, TextSegment } from 'pptx-viewer-core';

import { buildParagraphs } from '../internal/shared';
import type { FieldSubstitutionContext, PictureBulletMarker } from '../internal/shared';
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
	/** Parsed OMML for an inline equation run (rendered as MathML). */
	equationXml?: Record<string, unknown>;
	/** Optional equation number for numbered equations. */
	equationNumber?: string;
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
			}
			if (run.equation) {
				out.equationXml = run.equation.xml;
				out.equationNumber = run.equation.number;
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
