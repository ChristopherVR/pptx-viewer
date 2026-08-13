import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import {
	buildParagraphs,
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
} from 'pptx-viewer-shared';
import type { ParagraphRun, RenderParagraph } from 'pptx-viewer-shared';
import React from 'react';

import type { ElementAnimationState } from './animation-timeline';
import { wrapWithTextBuildAnimation } from './text-animation';
import type { FieldSubstitutionContext } from './text-field-substitution';
import type { ElementFindHighlights } from './text-segment-helpers';
import { renderParagraphRun } from './text-segment-render';
import type { RunRenderContext } from './text-segment-render';

// Per-paragraph BiDi direction + text-alignment resolution live in
// pptx-viewer-shared (render/text-paragraph-style). Re-exported here so existing
// React import paths keep working.
export { resolveCssTextAlign, resolveParagraphAlign, resolveParagraphRtl };

/**
 * Render an element's rich text as React nodes.
 *
 * The MODEL is shared `buildParagraphs`, the single paragraph builder all five
 * bindings now use: it groups segments into paragraphs (splitting on `a:p`
 * separators and NOT on a soft `a:br`, which React's retired private grouping
 * got wrong), resolves each paragraph's bullet marker, hanging indent, spacing,
 * strut size, alignment and kinsoku rules, and splits each run into the pieces
 * that make a line measure what PowerPoint measured. This module is the React
 * view layer over that descriptor.
 *
 * React re-joins the per-word pieces of a segment into one span before
 * rendering it. That is deliberate: its find-match highlights, per-script font
 * spans and tab stops all split the SEGMENT's text on their own axes, and the
 * inline editor maps a DOM selection back through one `data-seg-idx` span per
 * segment. The pieces are rebuilt inside that span from the same shared
 * `splitRunForMetrics`, so the wrapping decision is still shared's.
 */
export function renderTextSegments(
	element: PptxElement,
	fallbackColor: string,
	emptyFallback?: string,
	findHighlights?: ElementFindHighlights,
	onHyperlinkClick?: (url: string) => void,
	fieldContext?: FieldSubstitutionContext,
	/** Per-sub-element animation states for text build animations. */
	subElementAnimStates?: ReadonlyMap<string, ElementAnimationState>,
	/** When provided, these segments replace element.textSegments (linked text boxes). */
	segmentOverrides?: readonly TextSegment[],
	/** When true, hyperlinks require Ctrl+Click (editing mode). */
	requireCtrlClick?: boolean,
): React.ReactNode {
	if (!hasTextProperties(element)) {
		return emptyFallback || null;
	}

	const segments = segmentOverrides ?? element.textSegments;
	if (!segments || segments.length === 0) {
		if (!element.text && element.promptText) {
			return (
				<span style={{ opacity: 0.5, color: '#888888', pointerEvents: 'none' }}>
					{element.promptText}
				</span>
			);
		}
		return element.text || emptyFallback || '';
	}

	const paragraphs = buildParagraphs(element, fieldContext, segmentOverrides);
	const ctx: Omit<RunRenderContext, 'paragraphRtl'> = {
		element,
		fallbackColor,
		findHighlights,
		onHyperlinkClick,
		requireCtrlClick,
	};

	return paragraphs.map((para, paraIndex) =>
		renderParagraph(para, paraIndex, paragraphs.length, segments, ctx, subElementAnimStates),
	);
}

/**
 * One run per SOURCE SEGMENT: shared's per-word pieces re-joined, keeping the
 * segment's hyperlink and equation, so React renders one span per segment as it
 * always has (see the note on `renderTextSegments`).
 */
function joinRunsBySegment(runs: readonly ParagraphRun[]): ParagraphRun[] {
	const out: ParagraphRun[] = [];
	for (const run of runs) {
		const last = out[out.length - 1];
		if (
			last &&
			run.segmentIndex !== undefined &&
			last.segmentIndex === run.segmentIndex &&
			!last.equation &&
			!run.equation
		) {
			last.text += run.text;
			continue;
		}
		out.push({ ...run });
	}
	return out;
}

/** Render one paragraph as a `<div>` wrapper (or a bare fragment when it needs none). */
function renderParagraph(
	para: RenderParagraph,
	paraIndex: number,
	paraCount: number,
	segments: readonly TextSegment[],
	ctx: Omit<RunRenderContext, 'paragraphRtl'>,
	subElementAnimStates: ReadonlyMap<string, ElementAnimationState> | undefined,
): React.ReactNode {
	const element = ctx.element;
	const runCtx: RunRenderContext = { ...ctx, paragraphRtl: para.rtl };
	const runs = joinRunsBySegment(para.runs);
	const renderedRuns = runs.map((run) =>
		renderParagraphRun(run, segments[run.segmentIndex ?? -1], runCtx),
	);

	const paraStyle: React.CSSProperties = {
		// `text-align`, BiDi `direction` / `unicode-bidi` and the kinsoku
		// line-break rules, resolved by shared from this paragraph's own `a:pPr`.
		...(para.paragraphStyle as React.CSSProperties | undefined),
	};
	if (para.strutFontSizePx !== undefined) {
		paraStyle.fontSize = para.strutFontSizePx;
	}
	if (para.spaceBeforePx !== undefined) {
		paraStyle.marginTop = para.spaceBeforePx;
	}
	if (para.spaceAfterPx !== undefined) {
		paraStyle.marginBottom = para.spaceAfterPx;
	}
	if (para.lineHeight !== undefined) {
		paraStyle.lineHeight = para.lineHeight;
	}
	// An RTL paragraph's hanging indent belongs on the other side, or the bullet
	// and its text sit off the right edge of the box.
	if (para.marginLeftPx !== undefined) {
		if (para.rtl === true) {
			paraStyle.marginRight = para.marginLeftPx;
		} else {
			paraStyle.marginLeft = para.marginLeftPx;
		}
	}
	if (para.textIndentPx !== undefined) {
		paraStyle.textIndent = para.textIndentPx;
	}

	const marker = renderBulletMarker(para, paraIndex, element.id);
	const wrappedContent = wrapWithTextBuildAnimation(
		element.id,
		paraIndex,
		renderedRuns,
		runs,
		subElementAnimStates,
		// A staged build splits the paragraph but must not flatten it: each piece
		// is re-rendered through the SAME run renderer, so it keeps its run's
		// font, size, colour and decoration while it animates.
		(run, text, pieceKey) =>
			renderParagraphRun(
				{ ...run, text },
				segments[run.segmentIndex ?? -1],
				runCtx,
				`-build-${pieceKey}`,
			),
	);

	const needsWrapper = Object.keys(paraStyle).length > 0 || marker !== null;
	if (!needsWrapper) {
		return (
			<React.Fragment key={`${element.id}-para-${paraIndex}`}>
				{wrappedContent}
				{paraIndex < paraCount - 1 ? <br /> : null}
			</React.Fragment>
		);
	}

	return (
		<div key={`${element.id}-para-${paraIndex}`} style={paraStyle}>
			{marker}
			{/* An authored blank line (`<a:p><a:endParaRPr/></a:p>`) has no runs, so
			    its wrapper would collapse to zero height and the gap a deck uses to
			    separate a heading from its bullet list would disappear. A `<br>`
			    gives it a line box without adding to `textContent` (issue #131). */}
			{para.isEmpty ? <br /> : wrappedContent}
		</div>
	);
}

/**
 * The paragraph's bullet: a picture marker, a glyph marker, or nothing.
 *
 * Both the decision (is there a bullet, is it suppressed on a paragraph with no
 * visible text) and the marker's own CSS - including the `min-width` that
 * reserves exactly the hanging distance so the first line's text lands on the
 * indent stop - come from shared, which is what keeps the five bindings' bullet
 * layout identical.
 */
function renderBulletMarker(
	para: RenderParagraph,
	paraIndex: number,
	elementId: string,
): React.ReactNode {
	const picture = para.bulletPicture;
	if (picture?.src) {
		return (
			<img
				key={`${elementId}-para-${paraIndex}-bullet-img`}
				src={picture.src}
				alt={picture.accessibleLabel}
				style={{
					width: picture.sizePx,
					height: picture.sizePx,
					display: 'inline-block',
					verticalAlign: 'middle',
					marginInlineEnd: 4,
					objectFit: 'contain',
				}}
			/>
		);
	}
	if (para.bulletMarker === undefined) {
		return null;
	}
	return (
		<span
			key={`${elementId}-para-${paraIndex}-bullet`}
			className='pptx-bullet'
			style={para.bulletStyle as React.CSSProperties}
			aria-label={picture?.accessibleLabel}
		>
			{para.bulletMarker}
		</span>
	);
}
