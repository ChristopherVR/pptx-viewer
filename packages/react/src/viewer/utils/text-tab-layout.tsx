/**
 * Thin JSX wrapper over `pptx-viewer-shared`'s measured tab-stop layout.
 *
 * The positioning maths (`computeTabbedLayout`), leader-glyph mapping, canvas
 * measurement, and the CSS-ready piece builder (`buildRunTabLines`) all now
 * live in `pptx-viewer-shared` (`text-tab-layout` / `text-tab-run-build`),
 * extracted from what used to be this file's private implementation so all
 * five bindings render the same descriptor. This file keeps only the JSX
 * render call React needs, plus the re-exports that preserve the existing
 * import surface for `text-segment-helpers` / `text-segment-render`.
 */

import type { RunStyle, TabRenderContext } from 'pptx-viewer-shared';
import { buildRunTabLines } from 'pptx-viewer-shared';
import React from 'react';

export type {
	TabAlign,
	TabLeader,
	TabStopSpec,
	TabbedPiece,
	TabRenderContext,
} from 'pptx-viewer-shared';
export { buildTabContext, leaderGlyph, computeTabbedLayout } from 'pptx-viewer-shared';

/**
 * Render a single tab-containing line as inline-block pieces with leader-filled
 * gaps, using shared's CSS-ready layout ({@link buildRunTabLines}). `renderPiece`
 * renders the text of one piece (keeps script-aware font handling in the
 * caller and avoids a circular import).
 */
export function renderTabbedLine(
	line: string,
	ctx: TabRenderContext,
	keyPrefix: string,
	renderPiece: (text: string, key: string) => React.ReactNode,
	/**
	 * The run's decoration. Each piece is an `inline-block`, and CSS does not
	 * propagate a text decoration into an atomic inline-level box, so without
	 * repeating it here an underlined tabbed line loses its underline outright.
	 */
	nestedStyle?: React.CSSProperties,
	/**
	 * `a:rPr/@u="words"`: shared then splits each tab piece into per-word/gap
	 * sub-pieces (`TabbedRunPiece.words`), rendered here as SIBLING spans in
	 * place of the piece's single span. They cannot nest inside it: the piece
	 * span carries the run's decoration (see `nestedStyle`) and CSS draws an
	 * ancestor's underline through every inline descendant, so a nested gap
	 * could never lose it.
	 */
	underlineWords = false,
): React.ReactNode {
	// `line` never contains `\n` (the caller already split on it), so shared's
	// per-line split always yields exactly one entry here.
	const [lineLayout] = buildRunTabLines(
		line,
		ctx,
		nestedStyle as RunStyle | undefined,
		undefined,
		underlineWords,
	);
	return (
		<span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
			{lineLayout.pieces.map((piece, i) => {
				const key = `${keyPrefix}-tab-${i}`;
				return (
					<React.Fragment key={key}>
						{piece.leaderStyle ? (
							<span aria-hidden='true' style={piece.leaderStyle as React.CSSProperties}>
								{piece.leaderText}
							</span>
						) : null}
						{piece.words ? (
							piece.words.map((word, w) => (
								<span key={`${key}-w${w}`} style={word.style as React.CSSProperties}>
									{renderPiece(word.text, `${key}-w${w}`)}
								</span>
							))
						) : (
							<span style={piece.style as React.CSSProperties}>{renderPiece(piece.text, key)}</span>
						)}
					</React.Fragment>
				);
			})}
		</span>
	);
}
