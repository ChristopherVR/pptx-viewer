/**
 * Adaptive piecewise-affine slicing for the WordArt two-curve envelope (see
 * `text-warp-envelope-layout.ts` / `text-warp-glyph-matrix.ts`), closing the
 * residual documented there: "for the `can` presets ... a realistic WordArt
 * caption ... now measures under ~1% almost everywhere ... an extremely short
 * caption (roughly 6-8 very wide glyphs filling the whole box) can still show
 * up to ~2-2.5%, because a single affine per glyph cannot capture how much
 * curvature exists across ONE (now very wide) glyph's own span."
 *
 * Font-outline warping (bending each glyph's actual vector outline) is not
 * available in a browser for system fonts, so instead of fitting ONE affine
 * across a glyph's whole width, this fits a SEPARATE {@link glyphEnvelopeMatrix}
 * through `N` narrower sub-bands of that same glyph, `N` chosen from how much
 * the envelope curve bends across the glyph's own width. Each sub-band is
 * rendered as the SAME glyph again, clipped to its own `[clipX0, clipX1]`
 * x-range in the glyph's own (pre-transform) SVG coordinate space, so the
 * pieces tile across the glyph exactly as authored.
 *
 * A glyph's own width, as a fraction of the LINE's width, is what actually
 * drives how much curvature falls inside it - which is also just "how many
 * glyphs share the line": a 6-letter word and "6-8 very wide glyphs" are the
 * same regime dimensionally, there is no clean boundary between "ordinary"
 * and "pathological" here. {@link SLICE_ERROR_THRESHOLD} is tuned so a normal
 * multi-word or 20+ glyph line at DEFAULT `adj` resolves every `can` glyph to
 * a single slice (confirmed against W5-M's COM ink-scan ground truth
 * re-bucketed to 20 synthetic glyphs), while a genuinely short caption (`n`
 * glyphs sharing a line, `n` in the 4-8 range this doc's residual describes)
 * crosses it and slices - in which case this module activates, INCLUDING on
 * this repo's own "Warped" / "MOM" `text-warp-fidelity.pptx` fixture shapes
 * (see the concrete counts below). That is a real, wanted improvement, not
 * test debt: `text-warp-envelope-parity.spec.ts` reads a sliced glyph's
 * `<g data-glyph-slices>` group as one logical glyph (see that spec's
 * `readGlyphBoxesFor`), so it is exercised there, not dodged.
 *
 * `inflate`/`deflate`'s cubic curve spreads its curvature more evenly across
 * the line (control points at 1/3 and 2/3 width) than `can`'s `arcTo`, whose
 * bend concentrates at the box edges - so at this threshold an unusually
 * LONG `inflate`/`deflate` WordArt line (30-40+ glyphs) can still slice a
 * portion of its glyphs (never more than 2-3 pieces each, confirmed up to
 * `n = 40`), where a `can` line of the same length slices only its outermost
 * one or two glyphs. WordArt is a short-caption/title effect in practice, so
 * this is an accepted, bounded trade-off for the fidelity gain below, not
 * something this heuristic tries to special-case per preset family.
 *
 * COM-measured (2026-09-06, W5-M's ink-scan ground truth, W5-U's re-run
 * through the REAL `chooseGlyphSliceCount`/`buildGlyphSlices`/
 * `glyphEnvelopeMatrix` rather than a hand-transcribed copy): the
 * single-affine fit's worst-case interior error for `can`/`inflate`/`deflate`
 * at default `adj` ranges ~3.2-3.9% at `n = 4` synthetic glyphs sharing a
 * line, ~1.8-2.2% at `n = 8`; at `can`'s extreme `adj` (steepest `arcTo`
 * sweep) it is ~6.7-6.9% at `n = 4`, ~4.1-4.3% at `n = 8`. Raising
 * {@link MAX_ENVELOPE_GLYPH_SLICES} to 24 and lowering
 * {@link SLICE_ERROR_THRESHOLD} to 0.005 (from 8 slices / 2%) brings default
 * `adj` down to ~1.9-2.2% at `n = 4` and ~1.5-2.3% at `n = 8`, and extreme
 * `adj` `can` down to ~4.9-5.1% at `n = 4` and ~2.9-3.1% at `n = 8` - roughly
 * halved across the board. The extreme-`adj` `can` numbers do NOT keep
 * shrinking past that with a higher cap or lower threshold: pushed to 200
 * slices / 0.005% threshold they still floor at ~2.5-2.8%, because the
 * OUTERMOST glyph's own edge (`u = 0` or `u = 1`) is where `can`'s transcribed
 * `arcTo` model itself has its largest (COM-measured ~1.1-1.2%) deviation
 * from real PowerPoint - a genuinely near-vertical tangent at the arc's
 * sweep boundary, not curvature this glyph-splitting technique can address:
 * every sub-slice's fit is anchored EXACTLY on the analytic curve's own
 * value at its edges (by construction, see {@link glyphEnvelopeMatrix}), so
 * arbitrarily many slices converge to the MODEL's edge value, not to
 * PowerPoint's true one. Away from that literal edge (interior sample
 * points, `u` in roughly `[0.03, 0.97]`) the same model matches COM to
 * within ~0.3-0.35% for every preset tested, confirming the residual is
 * this specific edge effect and not a broader curve-fidelity gap.
 */
import type { EnvelopeCurveFractions } from './text-warp-envelope-curves';
import { edgeBandAt, glyphEnvelopeMatrix } from './text-warp-glyph-matrix';

/** Never split a single glyph into more than this many rendered pieces. */
export const MAX_ENVELOPE_GLYPH_SLICES = 24;

/**
 * How far (as a fraction of box height) the single-affine fit's own
 * prediction at an INTERIOR point of a glyph may miss the curve's actual
 * value there before another slice is added. See this module's own doc
 * comment for the COM numbers this was checked against, and why "ordinary"
 * and "pathological" cannot be cleanly separated here: this only guarantees
 * a normal (15+ glyph) line never slices, not that a short one never does.
 */
const SLICE_ERROR_THRESHOLD = 0.005;

/** Interior fractions of a glyph's own span sampled when scoring the single-affine fit. */
const FIT_SAMPLE_FRACTIONS = [0.15, 0.3, 0.5, 0.7, 0.85];

/** One rendered piece of a glyph: clipped to its own x-band, its own affine fit. */
export interface EnvelopeGlyphSlice {
	/** Left edge of this slice's clip rect, in the glyph's own (pre-transform) x. */
	clipX0: number;
	/** Right edge of this slice's clip rect, in the glyph's own (pre-transform) x. */
	clipX1: number;
	/** Same `matrix(1 b 0 d 0 f)` form as {@link glyphEnvelopeMatrix}, fit to this slice's own edges. */
	transform: string;
}

/**
 * The single-affine fit's own predicted top/bottom at interior position `u`
 * (given the fit was built from the curve sampled at `[u0, u1]`'s edges),
 * using the SAME closed-form as {@link glyphEnvelopeMatrix} but worked in a
 * unit-free `y in [0, 1]` band so the caller need not scale by box height.
 */
function predictAt(
	u0: number,
	u1: number,
	edge0: EnvelopeCurveFractions,
	edge1: EnvelopeCurveFractions,
	u: number,
): EnvelopeCurveFractions {
	const span = u1 - u0;
	// nominalSpan = 1 (a unit-free `y in [0, 1]` band), so `d` here is exactly
	// `glyphEnvelopeMatrix`'s `d` with `nominalSpan` already divided out.
	const d = (edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / 2;
	const b = span > 0 ? (edge1.top - edge0.top + (edge1.bottom - edge0.bottom)) / (2 * span) : 0;
	const meanU = (u0 + u1) / 2;
	const meanY = 0.5;
	const grandMean = (edge0.top + edge1.top + edge0.bottom + edge1.bottom) / 4;
	const f = grandMean - b * meanU - d * meanY;
	return { top: b * u + f, bottom: b * u + d + f };
}

/**
 * How far off (as a fraction of box height) a single affine fit through
 * `[u0, u1]`'s own two edges lands at that same span's INTERIOR - a direct
 * measure of how much within-glyph curve bend {@link glyphEnvelopeMatrix}
 * (which only ever sees the two edges) misses, sampled at
 * {@link FIT_SAMPLE_FRACTIONS} rather than just the midpoint so a curve whose
 * worst deviation sits off-centre (the `can` presets' arc, steepest near the
 * box edge) is not missed.
 */
function singleAffineFitErrorFraction(
	preset: string,
	u0: number,
	u1: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
	lineIndex: number,
	lineCount: number,
): number {
	const edge0 = edgeBandAt(preset, u0, adj, adj2, height, lineIndex, lineCount);
	const edge1 = edgeBandAt(preset, u1, adj, adj2, height, lineIndex, lineCount);
	let maxError = 0;
	for (const frac of FIT_SAMPLE_FRACTIONS) {
		const u = u0 + frac * (u1 - u0);
		const truth = edgeBandAt(preset, u, adj, adj2, height, lineIndex, lineCount);
		const predicted = predictAt(u0, u1, edge0, edge1, u);
		maxError = Math.max(
			maxError,
			Math.abs(predicted.top - truth.top),
			Math.abs(predicted.bottom - truth.bottom),
		);
	}
	return maxError / height;
}

/**
 * How many slices glyph `[u0, u1]` (normalised horizontal extent, 0..1) needs
 * for its piecewise-affine fit to stay under {@link SLICE_ERROR_THRESHOLD}.
 *
 * Every envelope curve here is built from line/quad/cubic/arc segments (see
 * `text-warp-preset-sampler.ts`), so this interior fit error shrinks
 * quadratically as the sampled span narrows: halving `[u0, u1]` cuts it to
 * roughly a quarter, which is why `n = ceil(sqrt(error / threshold))`
 * recovers the slice count that would bring each sub-band's own error back
 * under threshold.
 *
 * Returns `1` (render exactly as before slicing existed) for a flat preset,
 * a narrow-enough glyph, or a degenerate `[u0, u1]`.
 */
export function chooseGlyphSliceCount(
	preset: string,
	u0: number,
	u1: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
	lineIndex: number,
	lineCount: number,
	maxSlices: number = MAX_ENVELOPE_GLYPH_SLICES,
): number {
	if (height <= 0 || u1 <= u0 || maxSlices <= 1) {
		return 1;
	}
	const errorFraction = singleAffineFitErrorFraction(
		preset,
		u0,
		u1,
		adj,
		adj2,
		height,
		lineIndex,
		lineCount,
	);
	if (errorFraction <= SLICE_ERROR_THRESHOLD) {
		return 1;
	}
	const needed = Math.ceil(Math.sqrt(errorFraction / SLICE_ERROR_THRESHOLD));
	return Math.max(1, Math.min(maxSlices, needed));
}

/**
 * Extend a slice's clip band slightly into its neighbour so anti-aliasing at
 * adjacent, independently-transformed `<text>` copies never leaves a hairline
 * gap at the seam. Only applied at INTERIOR boundaries (between two slices of
 * the SAME glyph); a glyph's own outer edges are left exact since there is no
 * neighbouring slice there to seam against.
 */
const SEAM_OVERLAP_PX = 0.5;

/**
 * Build `sliceCount` {@link EnvelopeGlyphSlice}s tiling glyph `[x0, x1]`
 * (absolute SVG x, matching the `x`/`y` the glyph's `<text>` is drawn at) /
 * `[u0, u1]` (the same span normalised to the line's own `0..1`).
 *
 * Each slice's transform is {@link glyphEnvelopeMatrix} fit through the curve
 * sampled at THAT slice's own two edges, exactly the same function a whole
 * (unsliced) glyph uses, just over a narrower span. Because two adjacent
 * slices sample the curve at the IDENTICAL shared boundary `u`, they agree
 * exactly (to floating-point precision) on that boundary's midline position -
 * see `text-warp-glyph-slicing.test.ts` for the proof this holds regardless
 * of curvature, not just approximately.
 */
export function buildGlyphSlices(
	preset: string,
	x0: number,
	x1: number,
	u0: number,
	u1: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
	lineIndex: number,
	lineCount: number,
	nomTop: number,
	nomBottom: number,
	sliceCount: number,
): EnvelopeGlyphSlice[] {
	const n = Math.max(1, Math.floor(sliceCount));
	const slices: EnvelopeGlyphSlice[] = [];
	const edgeAt = (u: number): EnvelopeCurveFractions =>
		edgeBandAt(preset, u, adj, adj2, height, lineIndex, lineCount);
	for (let i = 0; i < n; i++) {
		const sliceX0 = x0 + ((x1 - x0) * i) / n;
		const sliceX1 = x0 + ((x1 - x0) * (i + 1)) / n;
		const sliceU0 = u0 + ((u1 - u0) * i) / n;
		const sliceU1 = u0 + ((u1 - u0) * (i + 1)) / n;
		slices.push({
			clipX0: sliceX0 - (i === 0 ? 0 : SEAM_OVERLAP_PX),
			clipX1: sliceX1 + (i === n - 1 ? 0 : SEAM_OVERLAP_PX),
			transform: glyphEnvelopeMatrix(
				sliceX0,
				sliceX1,
				edgeAt(sliceU0),
				edgeAt(sliceU1),
				nomTop,
				nomBottom,
			),
		});
	}
	return slices;
}
