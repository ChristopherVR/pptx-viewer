import type { RunStyle } from 'pptx-viewer-shared';
import { splitWordsForUnderline, stripUnderlineDecoration } from 'pptx-viewer-shared';
import React from 'react';

import type { MetricTextContext, ScriptFonts } from './text-segment-helpers';
import { renderMetricPieces, renderScriptAwareText } from './text-segment-helpers';

/**
 * D2-G3: `a:rPr/@u="words"` underlines only the non-whitespace characters of a
 * run, leaving inter-word spaces unmarked - distinct from `sng`'s continuous
 * line, which draws under the spaces too.
 *
 * CSS draws an ancestor's `text-decoration-line` THROUGH all of its inline
 * descendants regardless of what they themselves declare, so a single
 * `text-decoration: underline` on the run's own span (this app's normal
 * rendering) cannot leave a gap under a space no matter what a nested span
 * says. `renderParagraphRun` strips the underline from such a run's OWN span
 * for exactly this reason; this function is what puts it back, word by word:
 * each WORD piece gets its own span redeclaring the decoration, each GAP
 * piece renders through `inner` with no decoration at all (the ancestor no
 * longer has one to draw through it).
 *
 * `metric.nestedStyle` is swapped the same way for a gap piece, so a stray
 * underline cannot re-enter through the metric/script pipeline's OWN nested
 * spans either (a whitespace piece can still get one, purely for its own
 * letter-spacing tracking).
 *
 * A no-op - renders `text` through `inner` unchanged - when `isUnderlineWords`
 * is false or `text` is empty, which is the common case: zero extra spans.
 */
export function renderUnderlineWords(
	text: string,
	isUnderlineWords: boolean,
	wordDecoration: React.CSSProperties | undefined,
	metric: MetricTextContext | undefined,
	keyPrefix: string,
	inner: (text: string, key: string, metric: MetricTextContext | undefined) => React.ReactNode,
): React.ReactNode {
	if (!isUnderlineWords || !text) {
		return inner(text, keyPrefix, metric);
	}
	const pieces = splitWordsForUnderline(text);
	if (pieces.length === 0) {
		return inner(text, keyPrefix, metric);
	}
	const gapMetric: MetricTextContext | undefined = metric
		? {
				...metric,
				nestedStyle: metric.nestedStyle
					? (stripUnderlineDecoration(metric.nestedStyle as RunStyle) as React.CSSProperties)
					: undefined,
			}
		: undefined;
	return pieces.map((piece, i) => {
		const key = `${keyPrefix}-u${i}`;
		if (!piece.underline) {
			return <React.Fragment key={key}>{inner(piece.text, key, gapMetric)}</React.Fragment>;
		}
		return (
			<span key={key} style={wordDecoration}>
				{inner(piece.text, key, metric)}
			</span>
		);
	});
}

/**
 * Build the per-piece leaf renderer `renderSegmentContent` uses for both its
 * fast path and its find-highlight path: underline-words split, wrapping the
 * existing metric-tracking + per-script-font pipeline unchanged. Factored out
 * so those two call sites stay one line each instead of repeating the same
 * three-deep closure nest.
 */
export function makeSegmentPieceRenderer(
	needsScriptFonts: boolean,
	scriptFonts: ScriptFonts,
	baseFontFamily: string,
	isUnderlineWords: boolean,
	wordDecoration: React.CSSProperties | undefined,
	metric: MetricTextContext | undefined,
): (text: string, key: string) => React.ReactNode {
	return (text: string, key: string) =>
		renderUnderlineWords(
			text,
			isUnderlineWords,
			wordDecoration,
			metric,
			key,
			(subText, subKey, subMetric) =>
				renderMetricPieces(subText, subMetric, subKey, (pieceText, pieceKey) =>
					renderScriptAwareText(
						pieceText,
						needsScriptFonts,
						scriptFonts,
						baseFontFamily,
						pieceKey,
						subMetric?.nestedStyle,
					),
				),
		);
}
