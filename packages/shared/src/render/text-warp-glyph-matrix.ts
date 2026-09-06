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

/** The envelope band (absolute height units, already line-sliced) at one horizontal position. */
export function edgeBandAt(
	preset: string,
	u: number,
	adj: number | undefined,
	adj2: number | undefined,
	height: number,
	lineIndex: number,
	lineCount: number,
): EnvelopeCurveFractions {
	const curve = envelopeCurveAt(preset, u, adj, adj2);
	const bandTop = (curve?.top ?? NOMINAL_ENVELOPE_BAND.top) * height;
	const bandBottom = (curve?.bottom ?? NOMINAL_ENVELOPE_BAND.bottom) * height;
	return sliceBand(bandTop, bandBottom, lineIndex, lineCount);
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
