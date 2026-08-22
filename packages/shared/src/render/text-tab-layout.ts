/**
 * Real tab-stop layout for text runs containing `\t` characters (framework-agnostic).
 *
 * OOXML `a:tab` stops carry a position, an alignment (`l`/`ctr`/`r`/`dec`) and an
 * optional leader glyph (`dot`/`hyphen`/`underscore`). A plain CSS `tab-size` can
 * only advance by a fixed width and ignores both alignment and leaders (see
 * `computeTabSize` in `text-body-layout.ts`), so TOC-style rows
 * (label ....... 12) render wrong.
 *
 * This module computes a measured inline layout: each text piece (the run of
 * characters between two tabs) gets a resolved left offset honouring the
 * applicable tab stop's alignment, and the gap before it is filled with the
 * leader glyph. `computeTabbedLayout` is the pure positioning maths (unit
 * tested directly); `measureTextWidth` / `fillLeader` do the canvas
 * measurement every binding shares (a `<canvas>` 2D context works identically
 * in every browser environment, so this is not React-specific despite living
 * only in React before this extraction).
 *
 * This was React-only: the other four bindings fell back to the block-level
 * `tab-size` for every run containing a tab, so a deck's table-of-contents
 * slide lost its dot leaders and right-aligned page numbers in Vue, Angular,
 * Svelte and Vanilla.
 */

import type { TextStyle } from 'pptx-viewer-core';

import type { RunFontSpec } from './text-metric-tracking';

export type TabAlign = 'l' | 'ctr' | 'r' | 'dec';
export type TabLeader = 'none' | 'dot' | 'hyphen' | 'underscore';

/** One parsed `a:tabLst/a:tab` entry, in px from the text-body left edge. */
export type TabStopSpec = NonNullable<TextStyle['tabStops']>[number];

/** A single laid-out piece of a tabbed line (raw numeric layout). */
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

/** Context needed to lay out a tabbed line (measurement font + parsed stops). */
export interface TabRenderContext {
	tabStops: TabStopSpec[];
	/** Default tab interval in px (from `a:pPr/@defTabSz`). */
	defaultTabSize: number;
	/** Canvas `font` shorthand used to measure piece widths. */
	font: string;
	/**
	 * The same font, as a {@link RunFontSpec}, so a caller can compute PowerPoint's
	 * advance-width grid correction (`resolveTrackedTextWidth` /
	 * `resolveMetricTrackingPx` in `text-metric-tracking.ts`) for a tab piece
	 * without re-deriving bold/italic/size from the canvas font string.
	 */
	runFont: RunFontSpec;
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
		runFont: { fontFamily, fontSizePx, bold, italic },
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

/**
 * Build a leader string long enough to fill `width` px (clipped by the
 * caller's CSS `overflow: hidden`), measuring the glyph with `measure` rather
 * than a fixed canvas font so this stays testable without a real DOM.
 */
export function fillLeaderWithMeasure(
	glyph: string,
	width: number,
	measure: (text: string) => number,
): string {
	const glyphWidth = Math.max(1, measure(glyph));
	const count = Math.ceil(width / glyphWidth) + 1;
	return glyph.repeat(count);
}

/** Build a leader string long enough to fill `width` px, then clip via CSS. */
export function fillLeader(glyph: string, width: number, font: string): string {
	return fillLeaderWithMeasure(glyph, width, (text) => measureTextWidth(text, font));
}
