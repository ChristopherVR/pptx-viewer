import type { EastAsianBreakOptions, RunFontSpec } from 'pptx-viewer-shared';
import {
	followingText,
	pieceLetterSpacing,
	splitEastAsianBreaks,
	splitRunForMetrics,
} from 'pptx-viewer-shared';
import React from 'react';

/** What a caller needs to give a run's pieces their own metric tracking. */
export interface MetricTextContext {
	/** The font the run paints with, for measuring each piece. */
	font: RunFontSpec;
	/** Authored `a:rPr/@spc` in px; each piece's tracking layers on top. */
	authoredPx: number;
	/**
	 * The run's own decoration, which every span nested inside the run has to
	 * repeat: `text-decoration-*` does not inherit, so a piece span reports
	 * `none` of its own even while the run's underline is drawn through it.
	 * Shared `nestedTextDecorationStyle` decides the subset.
	 */
	nestedStyle?: React.CSSProperties;
	/**
	 * The paragraph's `@hangingPunct` / `@eaLnBrk="0"` (shared
	 * `RenderParagraph.eastAsianBreaks`). The four shared-builder bindings get
	 * these as sibling runs; React rebuilds them here from the same
	 * `splitEastAsianBreaks`, as it does the metric pieces.
	 */
	eastAsian?: EastAsianBreakOptions;
	/**
	 * The text right after the text being rendered (the next piece, line or
	 * run), so an East Asian break at that boundary follows the same rules as
	 * one inside it (shared `followingText`). Absent at a paragraph end.
	 */
	following?: string;
}

type Inner = (text: string, key: string) => React.ReactNode;

/**
 * Hanging-punctuation / kinsoku-off pieces of `text` (shared
 * `text-east-asian-breaks`): plain text keeps the caller's rendering, a
 * hanging mark or its advance-carrying space gets its own span. `baseStyle` is
 * the enclosing piece's own style, repeated because an `inline-block` does not
 * receive an ancestor's text decoration.
 */
function renderEastAsianPieces(
	text: string,
	metric: MetricTextContext,
	keyPrefix: string,
	inner: Inner,
	baseStyle: React.CSSProperties | undefined,
	following: string | undefined,
): React.ReactNode {
	const parts = splitEastAsianBreaks(text, metric.eastAsian, metric.font, following);
	if (parts.length === 1 && !parts[0].style) {
		return inner(parts[0].text, keyPrefix);
	}
	return parts.map((part, i) => {
		const key = `${keyPrefix}-e${i}`;
		return part.style ? (
			<span key={key} style={{ ...(baseStyle ?? metric.nestedStyle), ...part.style }}>
				{inner(part.text, key)}
			</span>
		) : (
			<React.Fragment key={key}>{inner(part.text, key)}</React.Fragment>
		);
	});
}

/**
 * Wrap each word (and each whitespace gap) of `text` in its own span carrying
 * the tracking that renders it at PowerPoint's width, so a line assembled out
 * of whole pieces measures exactly what PowerPoint measured (issue #149).
 *
 * The four shared-builder bindings get this by emitting sibling runs; React
 * builds its own spans, so it splits here, at the one place plain run text
 * becomes nodes. `inner` keeps whatever the caller was already doing with the
 * text (script-aware fonts) intact inside each piece.
 *
 * With no metric context, or nothing to split, this is the caller's own
 * rendering unchanged - one text node, no extra DOM.
 */
export function renderMetricPieces(
	text: string,
	metric: MetricTextContext | undefined,
	keyPrefix: string,
	inner: Inner,
): React.ReactNode {
	if (!metric || !text) {
		return inner(text, keyPrefix);
	}
	const pieces = splitRunForMetrics(text, metric.font);
	if (pieces.length <= 1) {
		return renderEastAsianPieces(text, metric, keyPrefix, inner, undefined, metric.following);
	}
	return pieces.map((piece, i) => {
		const key = `${keyPrefix}-w${i}`;
		const style: React.CSSProperties = {
			...metric.nestedStyle,
			letterSpacing: pieceLetterSpacing(metric.authoredPx, piece.tracking),
		};
		return (
			<span key={key} style={style}>
				{renderEastAsianPieces(
					piece.text,
					metric,
					key,
					inner,
					style,
					followingText(pieces, i, metric.following),
				)}
			</span>
		);
	});
}
