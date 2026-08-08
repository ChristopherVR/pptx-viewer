/**
 * Per-run advance-width compensation, so the browser breaks lines where
 * PowerPoint breaks them.
 *
 * PowerPoint lays text out with GDI-compatible (hinted) metrics: every glyph
 * advance is snapped to a whole device pixel at 576 DPI, i.e. to 1/8 point,
 * i.e. to 1/6 of a CSS px. The browser uses unrounded fractional advances. The
 * two therefore disagree by up to 1/12 px per glyph, in EITHER direction, and
 * the accumulated disagreement over a line is what decides a knife-edge wrap.
 *
 * Ground truth (PowerPoint COM `TextRange.BoundWidth` over the issue #131 /
 * #149 deck): summing `round(advance * 6) / 6` reproduced all 78 advance-exact
 * measured lines to under 0.001 px, while the browser's own measurement of the
 * same strings ran anywhere from 1.07% narrow to 0.28% wide.
 *
 * That spread is the point. The first attempt at this (issue #131) applied a
 * flat 0.003em to every run, which is roughly the middle of the range: it
 * tipped genuinely-late wraps the right way but pushed every string the browser
 * already measured WIDER than PowerPoint over its column, so short labels that
 * PowerPoint keeps on one line ("Explore solution", "Secure Data Movement")
 * started wrapping (issue #149). No single constant can do this job; the
 * correction has to be derived from the actual characters.
 *
 * So: measure the run, compute the width PowerPoint would have measured, and
 * emit the letter-spacing that closes the gap. Two details decide whether that
 * works or does damage, and both are documented where they are made -
 * `advancesOf` (advances come from prefix differences, never from measuring a
 * character alone) and the clamp in `resolveMetricTrackingPx`.
 *
 * Measured end to end in Chromium, rendered span against COM ground truth: mean
 * error 0.026 px, worst 0.40 px, against 0.53 px / 2.05 px uncompensated. On
 * shaped scripts the correction moves the text by 0.00% (Arabic, CJK) to 0.08%
 * (Devanagari), i.e. nothing visible.
 */

import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';

/** The font a run actually renders with, after substitution and autofit. */
export interface RunFontSpec {
	/** Resolved CSS `font-family` list (already PANOSE-substituted). */
	fontFamily?: string;
	/** Resolved CSS font size in px (already scaled by `normAutofit`). */
	fontSizePx?: number;
	bold?: boolean;
	italic?: boolean;
}

/**
 * Advance-width quantisation steps per CSS px. PowerPoint snaps each glyph
 * advance to an integer pixel at 576 DPI = 8 steps per point = 6 steps per px.
 */
const ADVANCE_STEPS_PER_PX = 6;

/**
 * The most the correction can legitimately be: half a grid step. See
 * {@link resolveMetricTrackingPx} for why anything beyond this is a different
 * problem wearing a rounding error's clothes.
 */
const MAX_TRACKING_PX_PER_CHAR = 1 / (2 * ADVANCE_STEPS_PER_PX);

/** Bound the caches so a long editing session cannot grow them without limit. */
const MAX_CACHE_ENTRIES = 20000;

let measureContext: CanvasRenderingContext2D | null | undefined;
let trackingCache = new Map<string, number>();
let fontsHookInstalled = false;

/**
 * A font that finishes loading after a run was measured invalidates that
 * measurement (it described the fallback face). Drop the caches so the next
 * render recomputes against what is now actually painted.
 */
function installFontLoadHook(): void {
	if (fontsHookInstalled || typeof document === 'undefined') {
		return;
	}
	fontsHookInstalled = true;
	document.fonts?.addEventListener?.('loadingdone', () => {
		trackingCache = new Map();
	});
}

function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureContext !== undefined) {
		return measureContext;
	}
	if (typeof document === 'undefined') {
		measureContext = null;
		return null;
	}
	installFontLoadHook();
	measureContext = document.createElement('canvas').getContext('2d');
	return measureContext;
}

/** CSS shorthand for `CanvasRenderingContext2D.font`. */
function toCanvasFont(font: RunFontSpec): string {
	const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
	const family = font.fontFamily || DEFAULT_FONT_FAMILY;
	return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${family}`;
}

/**
 * Per-character advances measured as PREFIX DIFFERENCES, never by measuring a
 * character on its own.
 *
 * This is the difference between a model that works and one that mangles half
 * the world's scripts. A character's advance depends on its neighbours: Arabic
 * letters join, so an isolated glyph measures ~37% wider than the same letter
 * inside a word; Devanagari forms conjuncts (~66%); an emoji ZWJ sequence is
 * one glyph built from several code points (~33%); and even Latin kerns - the
 * isolated characters of "AVATAR Wave To Yak" add up 5.3% wider than the string
 * itself. Summing isolated advances would hand the grid model a difference that
 * is not a rounding error at all, and letter-spacing would then stretch the run
 * to "correct" it: visibly wrong text, and a worse wrap than the one this set
 * out to fix.
 *
 * Differencing prefixes cannot fail that way. The advances telescope, so they
 * sum to exactly the width the browser will paint, whatever the shaping did.
 * Only their DISTRIBUTION across a ligature or cluster is approximate, and the
 * grid correction stays bounded by half a step per character either way.
 */
function advancesOf(ctx: CanvasRenderingContext2D, canvasFont: string, chars: string[]): number[] {
	ctx.font = canvasFont;
	// PowerPoint's own advances are UNKERNED unless `a:rPr/@kern` turns kerning
	// on, and this deck's ground truth confirms it: measured with kerning the
	// grid model reproduced 66 of 78 COM-measured lines, without it all 78,
	// exactly. Chrome kerns 12 of those lines by 0.17-1.55 px.
	ctx.fontKerning = 'none';
	const advances: number[] = [];
	let previous = 0;
	let prefix = '';
	for (const char of chars) {
		prefix += char;
		const width = ctx.measureText(prefix).width;
		advances.push(width - previous);
		previous = width;
	}
	return advances;
}

/**
 * The letter-spacing (in CSS px) that makes `text` render at the width
 * PowerPoint measured it at. `0` when there is nothing to correct, no DOM to
 * measure with, or the correction came out implausible.
 *
 * The divisor is the character count, not the gap count: every engine adds the
 * spacing after the final character too, and that trailing gap is part of the
 * inline box the line breaker sees. Being wrong about that convention would
 * cost one unit of tracking (~0.04 px), well inside the tolerance here.
 *
 * The result is clamped to half a grid step per character, and that bound is
 * the model's own definition rather than a magic number: snapping an advance to
 * the grid can move it by at most half a step, so a correction larger than that
 * is not describing rounding at all. It means the browser and PowerPoint
 * disagree for some other reason - kerning the run enables and PowerPoint does
 * not, a font that never loaded - and uniform letter-spacing is the wrong tool
 * for those. Clamping keeps the correction imperceptible (at most 0.083 px per
 * glyph) instead of visibly stretching the text to chase a difference it cannot
 * legitimately close.
 */
export function resolveMetricTrackingPx(text: string, font: RunFontSpec): number {
	if (!text) {
		return 0;
	}
	const canvasFont = toCanvasFont(font);
	const key = `${canvasFont}\u0000${text}`;
	const cached = trackingCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const ctx = getMeasureContext();
	if (!ctx) {
		return 0;
	}
	const chars = [...text];
	let powerPoint = 0;
	for (const advance of advancesOf(ctx, canvasFont, chars)) {
		powerPoint += Math.round(advance * ADVANCE_STEPS_PER_PX);
	}
	// ...against the width the browser will actually PAINT, which is kerned.
	ctx.fontKerning = 'auto';
	const natural = ctx.measureText(text).width;
	if (!(natural > 0)) {
		return 0;
	}
	powerPoint /= ADVANCE_STEPS_PER_PX;
	const limit = MAX_TRACKING_PX_PER_CHAR;
	const raw = (powerPoint - natural) / chars.length;
	const tracking = Math.min(limit, Math.max(-limit, raw));
	if (trackingCache.size >= MAX_CACHE_ENTRIES) {
		trackingCache = new Map();
	}
	trackingCache.set(key, tracking);
	return tracking;
}

/** A stretch of a run that carries its own tracking. */
export interface MetricRunPiece {
	text: string;
	/** letter-spacing in CSS px that renders `text` at PowerPoint's width. */
	tracking: number;
}

/**
 * True where the browser may break a line: between whitespace and a word, and
 * after a hyphen. Deliberately conservative - a boundary we miss costs
 * accuracy, a boundary we invent costs nothing, since pieces are laid out
 * contiguously either way.
 */
function isBreakBoundary(previous: string, next: string): boolean {
	const previousSpace = /\s/u.test(previous);
	const nextSpace = /\s/u.test(next);
	if (previousSpace !== nextSpace) {
		return true;
	}
	return previous === '-' && next !== '-' && !nextSpace;
}

/**
 * Cut a run at every line-break opportunity so each piece can carry its own
 * tracking.
 *
 * One tracking for a whole run makes the RUN measure exactly, but a line is a
 * prefix of it, and the rounding error is not spread evenly through the text -
 * so a line can still come out up to ~0.95 px off, which is enough to move a
 * break (issue #149, slide 5: "operational" fitted on a line PowerPoint had
 * already closed). Give every word its own tracking and every whitespace gap
 * its own, and any line the browser assembles out of whole pieces measures
 * exactly what PowerPoint measured, because advances simply add up.
 *
 * A break INSIDE a piece (mid-word, or between CJK characters, which have no
 * spaces to cut at) falls back to that piece's average - i.e. to the run-level
 * behaviour, never worse.
 *
 * Returns a single piece when the run has no interior boundary, which keeps the
 * common case (a short label, a one-word run) at exactly one span.
 */
export function splitRunForMetrics(text: string, font: RunFontSpec): MetricRunPiece[] {
	const chars = [...text];
	if (chars.length < 2 || !getMeasureContext()) {
		return [{ text, tracking: resolveMetricTrackingPx(text, font) }];
	}
	const pieces: string[] = [];
	let current = chars[0];
	for (let i = 1; i < chars.length; i++) {
		if (isBreakBoundary(chars[i - 1], chars[i])) {
			pieces.push(current);
			current = '';
		}
		current += chars[i];
	}
	pieces.push(current);
	if (pieces.length === 1) {
		return [{ text, tracking: resolveMetricTrackingPx(text, font) }];
	}
	return pieces.map((piece) => ({ text: piece, tracking: resolveMetricTrackingPx(piece, font) }));
}

/**
 * {@link resolveMetricTrackingPx} as a CSS length, or `undefined` when the run
 * needs no correction (so callers can leave `letter-spacing` undeclared rather
 * than emitting a no-op `0px`).
 */
export function resolveMetricTracking(text: string, font: RunFontSpec): string | undefined {
	const tracking = resolveMetricTrackingPx(text, font);
	return tracking === 0 ? undefined : `${tracking}px`;
}

/** Test hook: forget every measurement (also used by the font-load listener). */
export function resetMetricTrackingCache(): void {
	trackingCache = new Map();
	measureContext = undefined;
}
