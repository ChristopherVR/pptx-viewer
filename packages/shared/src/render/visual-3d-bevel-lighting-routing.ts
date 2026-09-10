/**
 * Legacy `box-shadow` routing for a `material`/profile combination the SVG
 * lighting filter cannot beat.
 *
 * Split out of `visual-3d-bevel-lighting.ts` to keep that file under the
 * repo's ~300 LOC guideline.
 *
 * @module render/visual-3d-bevel-lighting-routing
 */

/**
 * `material|profile` pairs that measure WORSE than the legacy `box-shadow`
 * approach and therefore route to the legacy model instead of shipping a
 * regression. Empty as of the 2026-09 bevel-profile-cross-section campaign
 * (`visual-3d-bevel-lighting-tables.ts`'s `BEVEL_PROFILE_HEIGHT_MAP` doc
 * comment): `metal|circle` was the one routed pair (a grid search over
 * `diffuseConstant`/`specularConstant`/`specularExponent`/
 * `surfaceScaleMultiplier` against the OLD, ECMA-376-reasoned profile table
 * could not bring it at or below baseline in any direction - see this file's
 * git history for that campaign's numbers). Re-fitting `circle`'s
 * `BEVEL_PROFILE_HEIGHT_MAP` entry against real COM cross-section data
 * (`surfaceScaleFactor` 1 -> 0.65) changed the balance enough that the
 * UNCHANGED material constants now beat the box-shadow baseline in every
 * `a:lightRig/@dir`, confirmed two ways: fresh COM ground truth (mid-grey
 * `circle`/metal square, 24pt bevel, `threePt` rig, all 4 directions,
 * 0.15in-from-edge highlight+shadow sampling, script
 * `scripts/make-bevel-material-fixture.mjs` +
 * `measure-bevel-material-com.ps1`) and an ACTUAL headless-Chromium
 * rasterisation of the real filter primitive chain (a one-off Playwright
 * spec, not committed) sampled the same points: mean absolute error 39.5
 * (baseline was 54.9). The same real-browser check also re-confirmed
 * `angle`/`hardEdge`/`softRound` still beat their baselines (41.5/62.0/27.5
 * against baselines ~70/~69.5/~50) with the new profile table, so nothing
 * newly regressed.
 *
 * A candidate fix for the SEPARATE flat-interior specular-saturation defect
 * (masking `feSpecularLighting`'s contribution to the actual curved bevel
 * band via a `feComponentTransfer`/`feColorMatrix` triangle-of-height mask,
 * `1 - |2*height-1|`, zero at the flat cap) was measured against the same
 * real-browser pipeline for all 4 profiles and made EVERY ONE of them worse,
 * often drastically (`circle` 39.5 -> 103.5, `angle` 41.5 -> 104.0,
 * `hardEdge` 62.0 -> 94.0, `softRound` 27.5 -> 89.0): the mask's `feFuncA
 * type="table" tableValues="0 1 0"` zeroes specular well before COM's real
 * highlight has decayed at the 0.15in sample offset (the mask, tuned only to
 * the height VALUE crossing 0.5, does not track where the actual specular
 * lobe sits for a high `specularExponent`), so this attempt was measured and
 * NOT landed. See `docs/guide/limitations.md` for the still-open
 * flat-interior saturation defect this was meant to fix.
 */
const LEGACY_BEVEL_ROUTING: ReadonlySet<string> = new Set();

/**
 * Whether a `material`/`profile` combination is routed to the legacy
 * `box-shadow` bevel model instead of the SVG lighting filter.
 */
export function isRoutedToLegacyBevelShadow(
	material: string | undefined,
	profile: string,
): boolean {
	return Boolean(material) && LEGACY_BEVEL_ROUTING.has(`${material}|${profile}`);
}
