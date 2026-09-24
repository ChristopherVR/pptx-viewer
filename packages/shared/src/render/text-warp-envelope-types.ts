/**
 * Types for {@link buildGlyphEnvelope} (`text-warp-envelope-layout.ts`), split
 * out to keep that file under the repo's per-file line budget.
 */
import type { GlyphOutlineCommand } from './text-warp-glyph-outline';
import type { EnvelopeGlyphSlice } from './text-warp-glyph-slicing';

/** The subset of a run's resolved style this module needs to measure it. */
export interface EnvelopeFontSpec {
	fontFamily?: string;
	fontSizePx?: number;
	bold?: boolean;
	italic?: boolean;
}

/** One run's worth of glyphs to lay out along the envelope, in source order. */
export interface EnvelopeSegmentInput {
	text: string;
	font: EnvelopeFontSpec;
	/** Index into the caller's own segment/style array (carried through untouched). */
	segmentIndex: number;
}

/** Where and how to draw one glyph. */
export interface EnvelopeGlyphPlacement {
	char: string;
	segmentIndex: number;
	/** SVG `x` for the (otherwise flat) `<text>` element. */
	x: number;
	/** SVG `y` (nominal baseline; the vertical placement is done by `transform`). */
	y: number;
	/**
	 * An SVG `matrix(a b c d e f)` applied to a `<text x={x} y={y}>` for this
	 * glyph: the least-squares affine fit of the envelope mapping over the
	 * glyph's ink box (see `fitGlyphEnvelopeAffine` in
	 * `text-warp-glyph-slicing.ts`). It maps from the unwarped layout space
	 * `x`/`y` are in, so it carries the horizontal placement too. Only used
	 * when `outlinePath` is absent.
	 */
	transform: string;
	/**
	 * Present only when this glyph needed more than one rendered piece (see
	 * `fitGlyphEnvelopeAffine` in `text-warp-glyph-slicing.ts`): a very wide
	 * glyph on a strongly-curved envelope, where `transform` alone (fit across
	 * the glyph's WHOLE width) misses how much the curve bends within that
	 * width. When present, a binding renders `slices.length` copies of this
	 * glyph instead of one, each clipped to its own `[clipX0, clipX1]` band (in
	 * the SAME coordinate space `x`/`y` are already in) and carrying its own
	 * `transform`. Absent (the overwhelmingly common case) for an ordinary
	 * caption, in which case a binding renders exactly as it did before this
	 * field existed: one `<text transform={transform}>`, no clip-path.
	 */
	slices?: EnvelopeGlyphSlice[];
	/**
	 * A warped SVG path `d` for this glyph's ACTUAL outline, present only when
	 * `getGlyphOutline` (passed to `buildGlyphEnvelope`) returned a real
	 * outline for this glyph's font/character. When present, a binding renders
	 * `<path d={outlinePath} fill={...}/>` instead of `<text transform>` /
	 * `slices`: every outline point (on-curve and off-curve alike) is already
	 * mapped through the envelope mapping, in shape-box coordinates, so this
	 * is not an approximation of the glyph's bounding box, unlike
	 * `transform`/`slices`. Absent (`undefined`) whenever no outline was
	 * obtainable (no font file and no DOM canvas to trace the glyph with, see
	 * `createGlyphOutlineLookup`) or the glyph is whitespace
	 * (nothing to draw either way), in which case a binding renders the
	 * `<text transform>` / `slices` fallback.
	 */
	outlinePath?: string;
}

/** The minimal font-spec shape `buildGlyphEnvelopeBlock`'s `getGlyphOutline` callback receives. */
export type GlyphOutlineLookupFont = EnvelopeFontSpec;

/**
 * Resolves one glyph's outline commands (already positioned at `x`, `y` and
 * scaled to `font.fontSizePx`), or `undefined` when no outline is obtainable
 * for this `char`/`font` (the caller falls back to the affine transform).
 * See `text-warp-outline-font-cache.ts`'s `createGlyphOutlineLookup` for the
 * production implementation (a parsed font file via `opentype.js`, else a
 * glyph traced from the browser's own rendering).
 */
export type GlyphOutlineLookup = (
	char: string,
	font: GlyphOutlineLookupFont,
	x: number,
	y: number,
) => GlyphOutlineCommand[] | undefined;

/**
 * Horizontal line alignment. Matches `TextStyle['align']` exactly (including
 * the distribute/Thai variants) so callers can pass it straight through
 * without narrowing; every non-`right` non-`left`-ish value renders centred,
 * same as `envelopeCurveAt`'s callers already treat unknown alignments.
 */
export type EnvelopeAlign =
	| 'left'
	| 'center'
	| 'right'
	| 'justify'
	| 'justLow'
	| 'dist'
	| 'thaiDist'
	| undefined;
