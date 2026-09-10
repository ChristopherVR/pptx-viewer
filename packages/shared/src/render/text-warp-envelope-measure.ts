/**
 * Canvas-based text measurement for the glyph envelope layout
 * (`text-warp-envelope-layout.ts`): per-character advance widths and the
 * line's real (ink-measured) ascent, both backed by a single lazily-created
 * `CanvasRenderingContext2D` shared across calls.
 */
import { DEFAULT_FONT_FAMILY, DEFAULT_TEXT_FONT_SIZE } from '../constants';
import type { EnvelopeFontSpec, EnvelopeSegmentInput } from './text-warp-envelope-types';

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

function toCanvasFont(font: EnvelopeFontSpec): string {
	const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
	const family = font.fontFamily || DEFAULT_FONT_FAMILY;
	return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${family}`;
}

/**
 * Per-character advance widths for `text` set in `font`, measured as prefix
 * differences (never a lone character: see `text-metric-tracking.ts`'s
 * `advancesOf` for why - shaped scripts and ligatures need the context).
 *
 * Falls back to a flat `0.55em`-per-character estimate when there is no DOM
 * to measure with (SSR, or a test environment without a 2D canvas context);
 * the estimate only affects horizontal glyph spacing, never the envelope
 * curve itself, so it stays visually reasonable even when approximate.
 */
export function measureGlyphAdvances(text: string, font: EnvelopeFontSpec): number[] {
	const chars = [...text];
	const ctx = getMeasureCtx();
	if (!ctx) {
		const size = font.fontSizePx && font.fontSizePx > 0 ? font.fontSizePx : DEFAULT_TEXT_FONT_SIZE;
		return chars.map(() => size * 0.55);
	}
	ctx.font = toCanvasFont(font);
	const advances: number[] = [];
	let previous = 0;
	let prefix = '';
	for (const char of chars) {
		prefix += char;
		const width = ctx.measureText(prefix).width;
		advances.push(Math.max(0, width - previous));
		previous = width;
	}
	return advances;
}

/**
 * The real (ink-measured) ascent of `segments`' text at their own font
 * sizes, as the tallest `actualBoundingBoxAscent` across every segment on
 * the line (not a per-character average - one tall glyph anywhere on the
 * line sets the reference the whole line warps against, matching how a
 * single baseline/cap-height pair governs a real text run).
 *
 * `buildGlyphEnvelope` used to map every glyph's nominal band from a FIXED
 * `NOMINAL_ENVELOPE_BAND` fraction of the box height (0.15..0.85), assuming
 * a glyph's own cap height fills that whole span. COM-measured (2026-09-11,
 * `text-warp-glyph-outline.ts`'s doc comment): for an 8-shape WordArt
 * fixture (Arimo Bold 44pt captions in 100pt-tall boxes, the `textCanUp` /
 * `textCanDown` / `textInflate` / `textDeflate` presets at both default and
 * extreme `adj`), real cap height reaches only about `t = 0.57` of that
 * nominal span, not `t = 0`, so every glyph's mapped top undershot the
 * curve's own top edge by the same amount - an outline-vs-COM interior-
 * column ink-scan comparison measured ~30-40% of box height mean error (max
 * 58-80%) on BOTH the outline path and the affine fallback alike (both use
 * this same nominal band, so both shared the bug identically: the residual
 * lived here, not in the outline point-mapping math). Anchoring `nomTop` to
 * the line's REAL measured ascent instead - clamped to never exceed the
 * historical fixed band, so a line whose font genuinely fills (or exceeds)
 * the nominal span keeps the old, already-validated behaviour unchanged -
 * dropped the `textInflate`/`textDeflate` interior mean error to ~2.6-2.9%
 * (max ~9-10%), in the range `text-warp-glyph-slicing.ts`'s doc comment
 * already documents as the residual once this band mismatch is not also
 * present. The `textCanUp`/`textCanDown` cases still show an elevated
 * residual (their interior mean measured ~6-20% even after this fix) that
 * further investigation traced to a SEPARATE, larger issue: real PowerPoint
 * spaces envelope-warped glyphs to fill the box's own width edge-to-edge
 * (measured ink spanning ~99.9% of box width) rather than centering the
 * text at its natural (unstretched) advance width the way `startX`/
 * `measureGlyphAdvances` do today, with `textCanUp`/`textCanDown` additionally
 * showing non-uniform (cylinder-projection-like) horizontal spacing this fix
 * does not address - both are horizontal-layout gaps, out of scope for this
 * (purely vertical) band fix and left as an open, separately-scoped issue.
 *
 * Returns `undefined` with no DOM (SSR, or a test environment without a 2D
 * canvas context), so a caller falls back to the previous fixed-fraction
 * band unchanged, exactly like {@link measureGlyphAdvances}'s own fallback.
 */
export function measureLineAscent(segments: EnvelopeSegmentInput[]): number | undefined {
	const ctx = getMeasureCtx();
	if (!ctx) {
		return undefined;
	}
	let maxAscent = 0;
	for (const segment of segments) {
		if (!segment.text) {
			continue;
		}
		ctx.font = toCanvasFont(segment.font);
		const ascent = ctx.measureText(segment.text).actualBoundingBoxAscent;
		if (Number.isFinite(ascent) && ascent > maxAscent) {
			maxAscent = ascent;
		}
	}
	return maxAscent > 0 ? maxAscent : undefined;
}

/** Test hook: forget the cached measurement context. */
export function resetGlyphEnvelopeMeasureCache(): void {
	measureCtx = undefined;
}
