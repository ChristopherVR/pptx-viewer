/**
 * Canvas-based text measurement for the glyph envelope layout
 * (`text-warp-envelope-block.ts`): per-character advance widths and a
 * glyph's own ink box, both backed by a single lazily-created
 * `CanvasRenderingContext2D` shared across calls.
 */
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { EnvelopeFontSpec } from './text-warp-envelope-types';

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
	if (measureCtx !== undefined) {
		return measureCtx;
	}
	if (typeof document === 'undefined') {
		measureCtx = null;
		return null;
	}
	measureCtx = document.createElement('canvas').getContext('2d');
	return measureCtx;
}

/** The font size (px) `font` renders at, defaulting like every other text path. */
export function envelopeFontSizePx(font: EnvelopeFontSpec): number {
	return font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
}

/** The CSS `font` shorthand for `font`, shared by measurement and glyph tracing. */
export function toCanvasFont(font: EnvelopeFontSpec, sizePx = envelopeFontSizePx(font)): string {
	const family = font.fontFamily || DEFAULT_FONT_FAMILY;
	return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${sizePx}px ${family}`;
}

/**
 * PowerPoint kerns WordArt envelope text by its font's pair kerning even
 * with no `kern` on the run (COM-measured 2026-09-24: `To` and `Wa` pairs
 * close up exactly as kerned), so ask the canvas for kerning explicitly
 * rather than trusting its `auto` default.
 */
function enableKerning(ctx: CanvasRenderingContext2D): void {
	const kerning = ctx as CanvasRenderingContext2D & { fontKerning?: string };
	if ('fontKerning' in kerning) {
		kerning.fontKerning = 'normal';
	}
}

/**
 * Per-character advance widths for `text` set in `font`, measured in the
 * context of the whole prefix (shaped scripts and kerning need it) so that
 * each glyph's start (the sum of the advances before it) is kerned.
 *
 * Falls back to a flat `0.55em`-per-character estimate when there is no DOM
 * to measure with (SSR, or a test environment without a 2D canvas context).
 */
export function measureGlyphAdvances(text: string, font: EnvelopeFontSpec): number[] {
	const chars = [...text];
	const ctx = getMeasureCtx();
	if (!ctx) {
		return chars.map(() => envelopeFontSizePx(font) * 0.55);
	}
	ctx.font = toCanvasFont(font);
	enableKerning(ctx);
	// A glyph starts where its prefix ends minus its own lone advance, so a
	// pair-kerning adjustment moves the glyph it applies to (the `o` of `To`)
	// rather than being folded into that glyph's own advance.
	const starts: number[] = [];
	let prefix = '';
	for (const char of chars) {
		prefix += char;
		starts.push(ctx.measureText(prefix).width - ctx.measureText(char).width);
	}
	const total = ctx.measureText(text).width;
	const advances = starts.map((start, i) =>
		Math.max(0, (i + 1 < starts.length ? starts[i + 1] : total) - start),
	);
	return advances;
}

/** A glyph's ink extent relative to its own origin (baseline, left advance edge). */
export interface GlyphInkExtent {
	left: number;
	right: number;
	/** Distance above the baseline (positive = up). */
	ascent: number;
	/** Distance below the baseline (positive = down). */
	descent: number;
}

/**
 * The ink extent of one `char` in `font` via `measureText`'s
 * `actualBoundingBox*` metrics, used for a glyph with no outline. Returns
 * `undefined` without a canvas or when the environment reports no ink metrics;
 * the caller then estimates the box from the advance and font size.
 */
export function measureGlyphInk(char: string, font: EnvelopeFontSpec): GlyphInkExtent | undefined {
	const ctx = getMeasureCtx();
	if (!ctx) {
		return undefined;
	}
	ctx.font = toCanvasFont(font);
	const m = ctx.measureText(char);
	const { actualBoundingBoxLeft, actualBoundingBoxRight } = m;
	const { actualBoundingBoxAscent, actualBoundingBoxDescent } = m;
	const values = [
		actualBoundingBoxLeft,
		actualBoundingBoxRight,
		actualBoundingBoxAscent,
		actualBoundingBoxDescent,
	];
	if (!values.every((v) => typeof v === 'number' && Number.isFinite(v))) {
		return undefined;
	}
	return {
		left: -actualBoundingBoxLeft,
		right: actualBoundingBoxRight,
		ascent: actualBoundingBoxAscent,
		descent: actualBoundingBoxDescent,
	};
}

/** Test hook: forget the cached measurement context. */
export function resetGlyphEnvelopeMeasureCache(): void {
	measureCtx = undefined;
}
