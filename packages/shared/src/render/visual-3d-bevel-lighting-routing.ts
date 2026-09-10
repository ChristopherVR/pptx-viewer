/**
 * Legacy `box-shadow` routing for a `material`/profile combination the SVG
 * lighting filter cannot yet beat.
 *
 * Split out of `visual-3d-bevel-lighting.ts` to keep that file under the
 * repo's ~300 LOC guideline.
 *
 * @module render/visual-3d-bevel-lighting-routing
 */

/**
 * `material|profile` pairs that measured WORSE than the legacy `box-shadow`
 * approach even after calibration (see `visual-3d-bevel-lighting-material
 * .ts`'s module doc comment for the numbers) and therefore route to the
 * legacy model instead of shipping a regression. Currently just
 * `metal|circle`: a grid search over `diffuseConstant`/`specularConstant`/
 * `specularExponent`/`surfaceScaleMultiplier` (2026-09, the same real
 * render-vs-COM pipeline used throughout this module) could not find ANY
 * combination bringing `metal`/`circle`'s mean error at or below the
 * box-shadow baseline in any of the 4 `a:lightRig/@dir` values tested:
 * `feDiffuseLighting`'s `N.L<=0` clamp-to-black on the shadow side is
 * structural to this primitive chain (independent of `diffuseConstant`'s
 * magnitude, which only scales the LIT side), and reducing `surfaceScale`
 * enough to lift the clamped shadow side toward COM's measured ~178/255
 * pulls the highlight side down away from its own accurate ~221/255 reading
 * faster than it helps - the two targets cannot both be reached with these
 * four parameters for this specific profile/material pair. A real fix needs
 * an ambient/floor term this primitive chain does not have; out of scope for
 * this pass.
 */
const LEGACY_BEVEL_ROUTING: ReadonlySet<string> = new Set(['metal|circle']);

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
