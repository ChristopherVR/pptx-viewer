/**
 * The per-glyph affine transform for the WordArt two-curve envelope (see
 * `text-warp-envelope-layout.ts`), split out to keep that file under the
 * repo's per-file line budget.
 */
import { envelopeCurveAt, NOMINAL_ENVELOPE_BAND } from './text-warp-envelope-curves';
import type { EnvelopeCurveFractions } from './text-warp-envelope-curves';

/** The `[start, end]` fraction of `[top, bottom]` occupied by band `index` of `count`. */
export function sliceBand(
	top: number,
	bottom: number,
	index: number,
	count: number,
): EnvelopeCurveFractions {
	const span = bottom - top;
	return {
		top: top + (index / count) * span,
		bottom: top + ((index + 1) / count) * span,
	};
}

/** A preset's deformed top/bottom band (absolute height units) at horizontal position `u`. */
function deformedBandAt(
	preset: string,
	u: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
): EnvelopeCurveFractions {
	const curve = envelopeCurveAt(preset, u, adj, adj2);
	return {
		top: (curve?.top ?? NOMINAL_ENVELOPE_BAND.top) * height,
		bottom: (curve?.bottom ?? NOMINAL_ENVELOPE_BAND.bottom) * height,
	};
}

/**
 * Horizontal position used to compute the FIXED boundary shared by two
 * adjacent paragraph rows (see {@link edgeBandAt}'s doc comment): the box's
 * own centre, matching where `NOMINAL_ENVELOPE_BAND` and every other
 * u-independent reference in this module already anchor.
 */
const ROW_BOUNDARY_REFERENCE_U = 0.5;

/**
 * The envelope band (absolute height units, already line-sliced) at one
 * horizontal position.
 *
 * For a single-line element (`lineCount <= 1`) this is exactly the deformed
 * band at `u` - unchanged from before per-paragraph slicing existed.
 *
 * For a multi-paragraph element, naively slicing the band AFTER deforming it
 * AT `u` (dividing `[bandTop(u), bandBottom(u)]` into `lineCount` equal
 * fractions) lets the boundary between row `i` and row `i+1` drift with `u`.
 * Since each row's OWN glyphs are laid out independently (see
 * `text-warp-envelope-layout.ts`'s `buildGlyphEnvelope`, called once per
 * paragraph) and can span very different horizontal ranges - a short
 * paragraph stretched hard to fill the box samples very different `u` than a
 * longer one in the SAME box - two rows can end up comparing their own
 * boundary at two DIFFERENT `u` values where the curve's amplitude differs
 * enough that row `i`'s computed bottom sits BELOW row `i+1`'s computed top:
 * an inverted, overlapping pair, even though each row's own boundary is
 * "correct" in isolation. COM review 2026-09-11 found this pre-existing (not
 * introduced by the box-fill horizontal-placement fix, though a paragraph's
 * `stretch` factor can widen how differently two rows sample the curve and
 * so widen the effect): an 8-shape fixture's two-paragraph `textInflate`
 * block (`"Top"` over `"Bottom"`) measured its `"Top"` row's own bottom edge
 * at `y=138.1` while its `"Bottom"` row's top edge measured `y=79.4` - rows
 * swapped order.
 *
 * The fix: the boundary BETWEEN two rows must be the SAME value regardless
 * of which row (or which glyph's own `u`) is asking, so it is computed from
 * the band deformed at a FIXED reference position
 * ({@link ROW_BOUNDARY_REFERENCE_U}, the box's own horizontal centre) rather
 * than each row's own actual `u`. Only a row's OUTER edge - the one facing
 * the box's own top (row 0's top) or bottom (the last row's bottom), never
 * shared with a neighbour - still bends with the curve at the glyph's real
 * `u`, preserving genuine per-glyph height variation there (the property
 * `text-warp-envelope-layout.test.ts`'s "places line 0 of 2 strictly above
 * line 1 of 2" and the scaleY-variation tests already pin). An interior row
 * (`lineCount > 2`, both edges shared with neighbours) gets a fixed band on
 * both sides; no fixture in this repo yet exercises three or more WordArt
 * paragraph rows, so this is the untested-but-consistent extension of the
 * same rule, not a separately-measured case.
 */
export function edgeBandAt(
	preset: string,
	u: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
	lineIndex: number,
	lineCount: number,
): EnvelopeCurveFractions {
	const actual = deformedBandAt(preset, u, adj, adj2, height);
	if (lineCount <= 1) {
		return sliceBand(actual.top, actual.bottom, 0, 1);
	}
	const reference = deformedBandAt(preset, ROW_BOUNDARY_REFERENCE_U, adj, adj2, height);
	const fixedSlice = sliceBand(reference.top, reference.bottom, lineIndex, lineCount);
	const isFirstRow = lineIndex <= 0;
	const isLastRow = lineIndex >= lineCount - 1;
	// An outer edge bending by its FULL deviation from the flat (undeformed)
	// band gives a row roughly `lineCount` TIMES the vertical scale its own
	// (`1/lineCount`-narrowed) nominal source band (`buildGlyphEnvelope`'s
	// `sliceBand(..., safeLineIndex, safeLineCount)` of
	// `NOMINAL_ENVELOPE_BAND`) was sized for, because the row's target band
	// still deforms by the WHOLE box's curve amplitude, not its own narrower
	// share of it (COM review 2026-09-11: a two-row `textInflate` fixture
	// measured a `d` vertical-scale term of ~3.27 for its first row at a
	// bulging u, stretching a 3-glyph "Top" caption's descender far enough to
	// invade the second row's territory even after the shared-boundary fix
	// alone; even scaled by `1/lineCount` here, a deep enough descender/
	// ascender can still extrapolate past the shared boundary - a
	// COM-unverified residual left open below). Damping the OUTER edge's OWN
	// deviation from the flat band by `1/lineCount` keeps a row's bend
	// proportional to its own narrowed share of the box, matching how its
	// nominal band was narrowed the same way - a multi-row block still
	// visibly bends (the deviation is not zeroed, just scaled), without a
	// `lineCount`-fold excess.
	const flatTop = NOMINAL_ENVELOPE_BAND.top * height;
	const flatBottom = NOMINAL_ENVELOPE_BAND.bottom * height;
	const dampedOuterTop = flatTop + (actual.top - flatTop) / lineCount;
	const dampedOuterBottom = flatBottom + (actual.bottom - flatBottom) / lineCount;
	// A first/last row's own OUTER edge bends (damped, see above); only the
	// shared INNER boundary ever comes from `fixedSlice`.
	return {
		top: isFirstRow ? dampedOuterTop : fixedSlice.top,
		bottom: isLastRow ? dampedOuterBottom : fixedSlice.bottom,
	};
}

/**
 * Affine `matrix(1 b 0 d 0 f)` mapping a glyph's nominal (undeformed) band
 * onto the envelope curve, fit across the glyph's own horizontal extent
 * `[x0, x1]` rather than sampling the curve once at the glyph's centre.
 *
 * PowerPoint warps a glyph's outline point by point, so a glyph spanning
 * `[x0, x1]` sits at a different envelope offset at its left edge than at its
 * right edge - a shear, not just a uniform vertical scale. Sampling the curve
 * only at the glyph's centre and scaling the WHOLE glyph by one factor (the
 * previous approximation here) ignores that within-glyph slope entirely. The
 * error is small for a narrow glyph on a gently-curved preset, but sizeable
 * for `textCanUp`/`textCanDown` at extreme `adj` (the `arcTo` sweep is
 * steepest right where most glyphs sit) and for any preset once a glyph is
 * wide relative to the curve's radius of curvature.
 *
 * PowerPoint's true mapping varies with both the glyph's own x AND y
 * (bilinear once the band height itself changes across the glyph), which no
 * single SVG affine `transform` can reproduce exactly. This fits the
 * closed-form least-squares affine through the four corners `(x0, nomTop)`,
 * `(x0, nomBottom)`, `(x1, nomTop)`, `(x1, nomBottom)`: for this balanced 2x2
 * design, the least-squares fit for a model with no x*y interaction term
 * reduces to averaging the two edges' slopes (`b` from the top/bottom
 * curves' horizontal slope, `d` from each edge's own vertical scale). Exact
 * at both edges when the top and bottom curves share the same slope there,
 * and a large improvement everywhere else.
 *
 * COM-measured 2026-09-06 (see `text-warp-preset-sampler.test.ts` and this
 * module's own fidelity notes): the underlying `sampleWarpPresetCurve` output
 * (the curve itself, sampled at a single point) matches PowerPoint to within
 * ~0.2% mean / ~1.2% max, for `textCanUp`/`textCanDown`/`textInflate`/
 * `textDeflate` at default AND extreme `adj` alike - the transcribed guide
 * formulas are not the source of the previously-reported error. The residual
 * lived entirely in how one glyph's OWN width was mapped onto that curve.
 * This fit closes most of it: for the `can` presets (the worst case at
 * extreme `adj`, previously 5.8-9.2%), a realistic WordArt caption (roughly
 * 8+ glyphs sharing the line) now measures under ~1% almost everywhere, with
 * the highest residual at the very first/last glyph on either end of the
 * curve. `textInflate`/`textDeflate` were already closer to the curve
 * (1.4-3.6%) and improve similarly at ordinary caption lengths; an extremely
 * short caption (roughly 6-8 very wide glyphs filling the whole box) can
 * still show up to ~2-2.5% there, because a single affine per glyph cannot
 * capture how much curvature exists across ONE (now very wide) glyph's own
 * span - closing that further needs warping each glyph's actual outline
 * (font shaping into sub-glyph pieces), not a bigger transform.
 *
 * `a=1, c=0, e=0` throughout: the glyph's `x`/`y` SVG attributes already
 * carry its absolute position, so this matrix must only ever contribute a
 * vertical scale/shear/offset, never an x-translate (a previous version's
 * `translate(x ...) scale(1 ...)` added a redundant `x` on top of the
 * `x`-attribute position, DOUBLING every glyph's horizontal offset).
 */
export function glyphEnvelopeMatrix(
	x0: number,
	x1: number,
	edge0: EnvelopeCurveFractions,
	edge1: EnvelopeCurveFractions,
	nomTop: number,
	nomBottom: number,
): string {
	const nominalSpan = nomBottom - nomTop;
	const glyphWidth = x1 - x0;
	const d =
		nominalSpan > 0
			? (edge0.bottom - edge0.top + (edge1.bottom - edge1.top)) / (2 * nominalSpan)
			: 1;
	const b =
		glyphWidth > 0 ? (edge1.top - edge0.top + (edge1.bottom - edge0.bottom)) / (2 * glyphWidth) : 0;
	const meanX = (x0 + x1) / 2;
	const meanY = (nomTop + nomBottom) / 2;
	const grandMean = (edge0.top + edge1.top + edge0.bottom + edge1.bottom) / 4;
	const f = grandMean - b * meanX - d * meanY;
	return `matrix(1 ${b} 0 ${d} 0 ${f})`;
}
