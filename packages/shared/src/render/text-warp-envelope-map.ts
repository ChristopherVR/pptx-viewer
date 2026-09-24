/**
 * PowerPoint's point mapping for the WordArt two-curve envelope presets
 * (`textInflate`/`textDeflate`/`textCanUp`/`textCanDown` and the rest of
 * {@link GLYPH_ENVELOPE_PRESETS}), COM-remeasured (2026-09-24, see
 * `docs/guide/visual-effects.md`).
 *
 * The whole text block (every paragraph, laid out unwarped) is normalised by
 * its own bounding box `[left, right] x [top, bottom]` into `(s, v)`, both in
 * `[0, 1]`. Then:
 *
 *   P(s, v) = (1 - v) * T(s) + v * B(s)
 *
 * where `T(s)` is the point at LINEAR fraction `s` along the preset's top
 * path (`x = s * width`) and `B(s)` the point at the same linear fraction
 * along its bottom path. An earlier version of this mapping used arc-length
 * fraction instead (denser sampling where a curve is steep), reasoned from
 * first principles but never COM-checked; an 8-stem vertical-caption COM
 * measurement (`textCanUp`/`textCanDown`, 3 `adj` values each) falsified it
 * directly: the measured stem positions were BIT-IDENTICAL across `adj`
 * values that produce very different curve steepness, which a
 * curvature-sensitive arc-length law cannot produce, but a law independent of
 * curve shape (plain linear `x`) does. The measured positions matched linear,
 * evenly-spaced glyph anchors to within the font's own side bearing.
 * Per-point outline warping (`text-warp-glyph-outline.ts`) already samples
 * every glyph coordinate through this same `map`, so a glyph's width/shear
 * now falls out of the curve's local slope at its own `x` automatically; no
 * separate per-preset "widen the glyph too" / "widen only the gaps"
 * special-casing is needed here any more.
 */
import { envelopeCurveAt } from './text-warp-envelope-curves';

/** The unwarped text block's bounding box, in layout coordinates. */
export interface EnvelopeBlockBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** Maps an unwarped layout point onto the warped shape box. */
export interface EnvelopeWarp {
	map(x: number, y: number): { x: number; y: number };
}

/** Samples per curve; linear interpolation is used between them. */
const CURVE_SAMPLES = 512;

/** The curve height (box units) at linear fraction `t` (clamped to `[0, 1]`) in `ys`. */
function heightAtFraction(ys: Float64Array, t: number): number {
	const clamped = Math.max(0, Math.min(1, t));
	const pos = clamped * (ys.length - 1);
	const lo = Math.floor(pos);
	const hi = Math.min(ys.length - 1, lo + 1);
	const f = pos - lo;
	return ys[lo] + (ys[hi] - ys[lo]) * f;
}

/**
 * Build the envelope mapping for `preset` in a `width` x `height` shape box,
 * normalising layout points by `block`. Returns `undefined` for a preset
 * outside the envelope family, a degenerate box, or an empty block.
 */
export function createEnvelopeWarp(
	preset: string,
	width: number,
	height: number,
	adj: number | undefined,
	adj2: number | undefined,
	block: EnvelopeBlockBox,
): EnvelopeWarp | undefined {
	const blockW = block.right - block.left;
	const blockH = block.bottom - block.top;
	if (!(width > 0) || !(height > 0) || !(blockW > 0) || !(blockH > 0)) {
		return undefined;
	}
	const topYs = new Float64Array(CURVE_SAMPLES + 1);
	const bottomYs = new Float64Array(CURVE_SAMPLES + 1);
	for (let i = 0; i <= CURVE_SAMPLES; i++) {
		const band = envelopeCurveAt(preset, i / CURVE_SAMPLES, adj, adj2);
		if (!band) {
			return undefined;
		}
		topYs[i] = band.top * height;
		bottomYs[i] = band.bottom * height;
	}
	return {
		map(x: number, y: number) {
			const s = (x - block.left) / blockW;
			const v = (y - block.top) / blockH;
			const topY = heightAtFraction(topYs, s);
			const bottomY = heightAtFraction(bottomYs, s);
			return { x: Math.max(0, Math.min(1, s)) * width, y: topY + (bottomY - topY) * v };
		},
	};
}
