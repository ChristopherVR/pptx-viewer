import React from 'react';

/**
 * Real tab-stop layout for text runs containing `\t` characters.
 *
 * OOXML `a:tab` stops carry a position, an alignment (`l`/`ctr`/`r`/`dec`) and
 * an optional leader glyph (`dot`/`hyphen`/`underscore`). A plain CSS
 * `tab-size` can only advance by a fixed width and ignores both alignment and
 * leaders, so TOC-style rows (label ....... 12) render wrong.
 *
 * This module computes a measured inline layout: each text piece (the run of
 * characters between two tabs) gets a resolved left offset honouring the
 * applicable tab stop's alignment, and the gap before it is filled with the
 * leader glyph. The positioning maths lives in {@link computeTabbedLayout},
 * which is pure and unit-tested; rendering is a thin wrapper on top.
 */

export type TabAlign = 'l' | 'ctr' | 'r' | 'dec';
export type TabLeader = 'none' | 'dot' | 'hyphen' | 'underscore';

export interface TabStopSpec {
	/** Stop position in px from the text-body left edge. */
	position: number;
	align: TabAlign;
	leader?: TabLeader;
}

/** A single laid-out piece of a tabbed line. */
export interface TabbedPiece {
	/** The run of characters between this tab and the next (or line end). */
	text: string;
	/** Resolved left offset in px where the text starts. */
	left: number;
	/** Width in px of the leader gap preceding this piece (0 for the first). */
	leaderWidth: number;
	/** Leader glyph to repeat across the gap, or `''` for none. */
	leaderChar: string;
}

/** Context needed to render a tabbed line (measurement font + parsed stops). */
export interface TabRenderContext {
	tabStops: TabStopSpec[];
	/** Default tab interval in px (from `a:pPr/@defTabSz`). */
	defaultTabSize: number;
	/** Canvas `font` shorthand used to measure piece widths. */
	font: string;
}

const EPS = 0.01;
const FALLBACK_STEP_PX = 48;

/**
 * Build a {@link TabRenderContext} for a run, or `undefined` when the run has
 * no explicit tab stops (in which case a plain CSS `tab-size` already handles
 * left tabs and no measured layout is needed).
 */
export function buildTabContext(
	tabStops: TabStopSpec[] | undefined,
	defaultTabSize: number | undefined,
	fontSizePx: number,
	fontFamily: string,
	bold: boolean,
	italic: boolean,
): TabRenderContext | undefined {
	if (!tabStops || tabStops.length === 0) {
		return undefined;
	}
	const font = `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontSizePx}px ${fontFamily}`;
	return {
		tabStops,
		defaultTabSize: typeof defaultTabSize === 'number' && defaultTabSize > 0 ? defaultTabSize : 0,
		font,
	};
}

/** Map an OOXML leader token to the glyph used to fill the leader gap. */
export function leaderGlyph(leader: TabLeader | undefined): string {
	switch (leader) {
		case 'dot':
			return '.';
		case 'hyphen':
			return '-';
		case 'underscore':
			return '_';
		default:
			return '';
	}
}

/**
 * Index of the decimal separator used for decimal-tab alignment, or `-1` when
 * the piece has no decimal point (in which case decimal tabs behave like a
 * right tab, aligning the trailing edge to the stop).
 */
function decimalIndex(text: string): number {
	return text.indexOf('.');
}

/**
 * Compute the laid-out pieces for a single line split on `\t`.
 *
 * `segments` is the result of `line.split('\t')`; `segments[0]` is the text
 * before the first tab and is always placed at `left = 0`. `measure` returns
 * the rendered width in px of a given string in the run's font.
 */
export function computeTabbedLayout(
	segments: string[],
	tabStops: TabStopSpec[],
	measure: (text: string) => number,
	defaultTabSize: number,
): TabbedPiece[] {
	const stops = tabStops
		.filter((s) => Number.isFinite(s.position) && s.position > 0)
		.sort((a, b) => a.position - b.position);
	const step =
		Number.isFinite(defaultTabSize) && defaultTabSize > 0 ? defaultTabSize : FALLBACK_STEP_PX;

	const pieces: TabbedPiece[] = [];
	let cursor = 0;
	segments.forEach((text, i) => {
		if (i === 0) {
			pieces.push({ text, left: 0, leaderWidth: 0, leaderChar: '' });
			cursor = measure(text);
			return;
		}

		const stop = stops.find((s) => s.position > cursor + EPS);
		const width = measure(text);
		let tabX: number;
		let align: TabAlign;
		let leader: TabLeader | undefined;
		if (stop) {
			tabX = stop.position;
			align = stop.align;
			leader = stop.leader;
		} else {
			tabX = Math.floor(cursor / step + 1 + EPS) * step;
			align = 'l';
			leader = undefined;
		}

		let left: number;
		if (align === 'ctr') {
			left = tabX - width / 2;
		} else if (align === 'r') {
			left = tabX - width;
		} else if (align === 'dec') {
			const decIdx = decimalIndex(text);
			const beforeWidth = decIdx >= 0 ? measure(text.slice(0, decIdx)) : width;
			left = tabX - beforeWidth;
		} else {
			left = tabX;
		}
		if (left < cursor) {
			left = cursor;
		}

		const leaderWidth = left - cursor;
		const leaderChar = leaderWidth > 0.5 ? leaderGlyph(leader) : '';
		pieces.push({ text, left, leaderWidth, leaderChar });
		cursor = left + width;
	});
	return pieces;
}

// ── Measurement ────────────────────────────────────────────────────────────

let cachedCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
	if (cachedCtx !== undefined) {
		return cachedCtx;
	}
	if (typeof document === 'undefined') {
		cachedCtx = null;
		return null;
	}
	cachedCtx = document.createElement('canvas').getContext('2d');
	return cachedCtx;
}

/** Rough non-DOM fallback width so SSR renders don't collapse tab gaps. */
function estimateWidth(text: string): number {
	return text.length * 8;
}

/** Measure the rendered px width of `text` in the given canvas `font`. */
export function measureTextWidth(text: string, font: string): number {
	const ctx = getMeasureCtx();
	if (!ctx) {
		return estimateWidth(text);
	}
	ctx.font = font;
	return ctx.measureText(text).width;
}

/** Build a leader string long enough to fill `width` px, then clip via CSS. */
function fillLeader(glyph: string, width: number, font: string): string {
	const glyphWidth = Math.max(1, measureTextWidth(glyph, font));
	const count = Math.ceil(width / glyphWidth) + 1;
	return glyph.repeat(count);
}

/**
 * Render a single tab-containing line as inline-block pieces with leader-filled
 * gaps. `renderPiece` renders the text of one piece (used to keep script-aware
 * font handling in the caller and avoid a circular import).
 */
export function renderTabbedLine(
	line: string,
	ctx: TabRenderContext,
	keyPrefix: string,
	renderPiece: (text: string, key: string) => React.ReactNode,
): React.ReactNode {
	const segments = line.split('\t');
	const pieces = computeTabbedLayout(
		segments,
		ctx.tabStops,
		(t) => measureTextWidth(t, ctx.font),
		ctx.defaultTabSize,
	);
	return (
		<span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
			{pieces.map((piece, i) => {
				const key = `${keyPrefix}-tab-${i}`;
				return (
					<React.Fragment key={key}>
						{piece.leaderWidth > 0 ? (
							<span
								aria-hidden='true'
								style={{
									display: 'inline-block',
									width: piece.leaderWidth,
									overflow: 'hidden',
									whiteSpace: 'nowrap',
									textAlign: 'right',
									verticalAlign: 'baseline',
								}}
							>
								{piece.leaderChar ? fillLeader(piece.leaderChar, piece.leaderWidth, ctx.font) : ''}
							</span>
						) : null}
						<span style={{ display: 'inline-block', whiteSpace: 'pre' }}>
							{renderPiece(piece.text, key)}
						</span>
					</React.Fragment>
				);
			})}
		</span>
	);
}
