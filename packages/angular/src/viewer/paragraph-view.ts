import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	buildParagraphs,
	resolveAutoFitFontScale,
	segmentStyleToCss,
	substituteFieldText,
} from '../internal/shared';
import type { FieldSubstitutionContext, PictureBulletMarker } from '../internal/shared';
import type { StyleMap } from './element-style';
import { resolveHyperlinkHref } from './hyperlink';

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
 * Only the two things shared's `ParagraphRun` does not model are resolved here:
 * a run's HYPERLINK and an inline EQUATION run. Both are per-segment facts that
 * `buildParagraphs` drops (it returns `{ text, style }` only), and Angular is
 * the one binding whose template renders them, so they are re-attached to the
 * shared runs rather than reimplementing the builder for their sake. When
 * shared's `ParagraphRun` grows those fields, {@link attachRunMetadata} and its
 * segment walk can be deleted outright and the other bindings get hyperlinked
 * text for free.
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
}

/** Per-segment extras shared's `ParagraphRun` does not carry. */
interface RunMetadata {
	href?: string;
	tooltip?: string;
	equationXml?: Record<string, unknown>;
	equationNumber?: string;
}

/** One metadata-bearing segment plus the text it actually renders. */
interface MetadataEntry {
	text: string;
	meta: RunMetadata;
}

/** Whether a segment carries anything the shared run model would drop. */
function segmentMetadata(seg: TextSegment): RunMetadata | undefined {
	const href = resolveHyperlinkHref(seg.style?.hyperlink);
	if (seg.equationXml) {
		return {
			href,
			tooltip: href ? seg.style?.hyperlinkTooltip : undefined,
			equationXml: seg.equationXml,
			equationNumber: seg.equationNumber,
		};
	}
	if (!href) {
		return undefined;
	}
	return { href, tooltip: seg.style?.hyperlinkTooltip };
}

/**
 * Split segments into paragraphs on the same condition shared's
 * `buildParagraphs` uses, so entry group `i` lines up with paragraph `i`.
 *
 * A bare `"\n"` is the slide-LOAD path's paragraph separator; `isParagraphBreak`
 * is only set by the edit remap. Shared drops trailing blank paragraphs, which
 * only ever shortens its result, so matching by index from the front stays
 * aligned.
 */
function groupSegments(segments: readonly TextSegment[]): TextSegment[][] {
	const groups: TextSegment[][] = [[]];
	for (const seg of segments) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			groups.push([]);
			continue;
		}
		groups[groups.length - 1].push(seg);
	}
	return groups;
}

/** What a segment renders after field substitution / line-break normalisation. */
function renderedText(
	seg: TextSegment,
	fieldContext: FieldSubstitutionContext | undefined,
): string {
	const raw = seg.isLineBreak ? '\n' : seg.text;
	return seg.fieldType ? substituteFieldText(raw, seg.fieldType, fieldContext) : raw;
}

/** First entry at or after `from` whose text starts with `text` (-1 if none). */
function findEntryStartingWith(
	entries: readonly MetadataEntry[],
	from: number,
	text: string,
): number {
	for (let at = Math.max(from, 0); at < entries.length; at++) {
		if (entries[at].text.length > 0 && entries[at].text.startsWith(text)) {
			return at;
		}
	}
	return -1;
}

/**
 * Walk one paragraph's segments alongside the runs shared built from them and
 * hand each run its segment's hyperlink, re-inserting the inline equation runs
 * shared drops (an equation segment has empty text, so shared's `if (text)`
 * guard skips it).
 *
 * Shared splits a run per word for PowerPoint metric tracking, so several runs
 * map onto one segment; the walk consumes each segment's text by length. A
 * segment shared dropped entirely (the bullet-marker segment) is skipped by the
 * resync, and a run that cannot be located simply gets no metadata, which is
 * the pre-existing rendering rather than a wrong link.
 */
function attachRunMetadata(
	runs: TextRun[],
	segments: readonly TextSegment[],
	fieldContext: FieldSubstitutionContext | undefined,
	equationStyle: (seg: TextSegment) => StyleMap,
): TextRun[] {
	const entries: MetadataEntry[] = [];
	const equationSegments = new Map<number, TextSegment>();
	for (const seg of segments) {
		const meta = segmentMetadata(seg);
		if (meta?.equationXml) {
			equationSegments.set(entries.length, seg);
		}
		entries.push({ text: renderedText(seg, fieldContext), meta: meta ?? {} });
	}

	const out: TextRun[] = [];
	let index = 0;
	let offset = 0;

	/** Emit any zero-length equation entries sitting at the cursor. */
	const flushEquations = (): void => {
		while (index < entries.length && entries[index].text.length === offset) {
			const seg = entries[index].text.length === 0 ? equationSegments.get(index) : undefined;
			if (seg) {
				const entry = entries[index];
				out.push({
					text: '',
					style: equationStyle(seg),
					equationXml: entry.meta.equationXml,
					equationNumber: entry.meta.equationNumber,
				});
			}
			index++;
			offset = 0;
		}
	};

	for (const run of runs) {
		flushEquations();
		if (index >= entries.length || !entries[index].text.startsWith(run.text, offset)) {
			// Resync past a segment shared dropped (the marker segment) or any
			// mismatch, rather than mis-attributing the link to the wrong run.
			const found = findEntryStartingWith(entries, index, run.text);
			if (found >= 0) {
				index = found;
				offset = 0;
			}
		}
		const entry =
			index < entries.length && entries[index].text.startsWith(run.text, offset)
				? entries[index]
				: undefined;
		if (entry) {
			offset += run.text.length;
		}
		out.push(
			entry?.meta.href
				? { ...run, href: entry.meta.href, tooltip: entry.meta.tooltip }
				: { ...run },
		);
	}
	flushEquations();
	return out;
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
	const shared = buildParagraphs(element, fieldContext, segmentOverrides);
	const paragraphs: Paragraph[] = shared.map((para) => ({
		runs: para.runs.map((run) => ({ text: run.text, style: run.style })),
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
	}));

	const segments = hasTextProperties(element)
		? (segmentOverrides ?? element.textSegments)
		: undefined;
	if (!segments || segments.length === 0) {
		return paragraphs;
	}
	// The walk exists only for hyperlinks and inline equations; skip it entirely
	// (and keep the shared output untouched) for the overwhelmingly common body
	// of plain text.
	if (!segments.some((seg) => seg.equationXml || seg.style?.hyperlink)) {
		return paragraphs;
	}

	const fontScale = resolveAutoFitFontScale(
		hasTextProperties(element) ? element.textStyle : undefined,
	);
	const equationStyle = (seg: TextSegment): StyleMap => segmentStyleToCss(seg, fontScale);
	const groups = groupSegments(segments);
	for (let i = 0; i < paragraphs.length; i++) {
		const group = groups[i];
		if (!group || group.length === 0) {
			continue;
		}
		const runs = attachRunMetadata(paragraphs[i].runs, group, fieldContext, equationStyle);
		paragraphs[i].runs = runs;
		if (runs.length > 0) {
			// An equation run is content: the paragraph is no longer the authored
			// blank line shared saw (its `<a:t>` is empty), so it must not also
			// render the blank-line `<br>`.
			paragraphs[i].isEmpty = undefined;
		}
	}
	// Shared drops paragraphs after the last one carrying text, and an equation
	// paragraph carries none (its runs are empty, the maths lives in
	// `equationXml`). This binding renders equations ONLY as paragraph runs, so
	// without this a trailing equation would vanish from the slide.
	for (let i = paragraphs.length; i < groups.length; i++) {
		const runs = attachRunMetadata([], groups[i], fieldContext, equationStyle);
		if (runs.length > 0) {
			paragraphs.push({ runs, bulletStyle: {}, indentPx: 0 });
		}
	}
	return paragraphs;
}
