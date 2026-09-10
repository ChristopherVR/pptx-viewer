/**
 * Material -> `feDiffuseLighting`/`feSpecularLighting` response table.
 *
 * Split out of `visual-3d-bevel-lighting-tables.ts` to keep both files under
 * the repo's ~300 LOC guideline; see that module's doc comment for the other
 * two axes (bevel profile height-map shape, light rig elevation).
 *
 * @module render/visual-3d-bevel-lighting-material
 */

import type { MaterialPresetType } from 'pptx-viewer-core';

/** feDiffuseLighting/feSpecularLighting constants for a material preset. */
export interface MaterialLighting {
	diffuseConstant: number;
	specularConstant: number;
	specularExponent: number;
	/** `lighting-color` for both primitives; a hex string. */
	lightingColor: string;
	/**
	 * Multiplies the profile-derived `surfaceScale` (default 1 = unchanged).
	 * Calibrated per material against the COM highlight/shadow table (see
	 * this module's doc comment): a material whose true shadow-side
	 * reflectance sits far above a fully-shadowed (`N.L <= 0`, clamped to
	 * black) diffuse response needs a SHALLOWER effective height map (a
	 * smaller multiplier) so fewer height-map texels clamp to zero at the
	 * measurement offset, not a differently-shaped one.
	 */
	surfaceScaleMultiplier: number;
}

const white = '#ffffff';

/**
 * `a:sp3d/@prstMaterial` -> lighting response. COM-measured (2026-09, real
 * PowerPoint, `Slide.Export`, 0.15in-from-edge sample) comparing `matte`
 * against `metal` at `dir="t"`/`"r"`/`"b"`/`"l"` for `circle`/`angle`/
 * `hardEdge`/`softRound` (32 samples; mean highlight/shadow brightness,
 * 0-255, averaged over direction): `metal` measured UNIFORMLY BRIGHTER than
 * `matte` at BOTH the highlight and shadow sample points in every profile
 * (circle 221/178 vs 137/90, angle 141/86 vs 139/64, hardEdge 137/137 vs
 * 133/133, softRound 85/141 vs 63/139) - consistent with a higher overall
 * reflectivity - but did NOT measure a higher highlight-minus-shadow
 * CONTRAST at this fixed sample distance: contrast was about equal for
 * `circle` (43 vs 47) and LOWER for `metal` on `angle` (55 vs 75) and
 * `softRound` (56 vs 76 in magnitude). This does not confirm the "narrower,
 * sharper specular falloff" story this module's `specularConstant`/
 * `specularExponent` tuning assumes; a plausible explanation is that a real
 * metal specular peak sits closer than 0.15in to the edge, so a fixed-offset
 * sample already reads past it into a brighter but flatter region - but that
 * is inference from this one campaign, not a second confirmed measurement at
 * a different offset. A live render-vs-COM check (`visual-3d-bevel-lighting
 * .ts`'s module doc table) found this module's `metal` numbers give a mixed
 * result: `matte` improved clearly over the old box-shadow approach (56.3 ->
 * 34.8 mean error) while `metal` did not (61.2 -> 59.7, and `metal`/`circle`
 * specifically got WORSE, 54.9 -> 80.1) - the constants below were therefore
 * flagged UNVALIDATED for `metal`, and `metal`/`circle` was ROUTED to the
 * legacy box-shadow model (`visual-3d-bevel-lighting-routing.ts`). The other
 * materials are positioned between/around the `matte`/`metal` anchors by
 * category (glossy plastics near `metal` but softer, matte/powder variants
 * near `matte`), not independently COM-measured at all.
 *
 * RESOLVED for `metal`/`circle` (2026-09, the bevel-profile cross-section
 * campaign, `visual-3d-bevel-lighting-tables.ts`'s `BEVEL_PROFILE_HEIGHT_MAP`
 * doc comment): re-fitting `circle`'s profile-table entry against real COM
 * cross-section data (unrelated to material tuning) changed
 * `surfaceScaleFactor` from 1 to 0.65, and with these SAME `metal` constants
 * (unchanged from the paragraph above) that alone brought `metal`/`circle`'s
 * mean error to 39.5 against the SAME 54.9 baseline - confirmed against
 * fresh COM ground truth AND an actual headless-Chromium rasterisation of
 * the real filter chain (not just the closed-form model this module's own
 * campaigns otherwise used), so `metal`/`circle` no longer routes; see
 * `visual-3d-bevel-lighting-routing.ts`'s doc comment for the numbers and a
 * separate, NOT-landed attempt at fixing the flat-interior specular
 * saturation defect below.
 */
export const MATERIAL_LIGHTING: Record<MaterialPresetType, MaterialLighting> = {
	matte: {
		diffuseConstant: 0.9,
		specularConstant: 0.02,
		specularExponent: 4,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	warmMatte: {
		diffuseConstant: 0.9,
		specularConstant: 0.03,
		specularExponent: 4,
		lightingColor: '#fff4e6',
		surfaceScaleMultiplier: 1,
	},
	powder: {
		diffuseConstant: 0.85,
		specularConstant: 0.02,
		specularExponent: 4,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	translucentPowder: {
		diffuseConstant: 0.8,
		specularConstant: 0.08,
		specularExponent: 6,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	plastic: {
		diffuseConstant: 0.85,
		specularConstant: 0.35,
		specularExponent: 12,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	clear: {
		diffuseConstant: 0.7,
		specularConstant: 0.45,
		specularExponent: 16,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	softEdge: {
		diffuseConstant: 0.85,
		specularConstant: 0.15,
		specularExponent: 8,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	dkEdge: {
		diffuseConstant: 0.75,
		specularConstant: 0.2,
		specularExponent: 14,
		lightingColor: '#f0f0f0',
		surfaceScaleMultiplier: 1,
	},
	softmetal: {
		diffuseConstant: 0.65,
		specularConstant: 0.6,
		specularExponent: 16,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	// Re-calibrated (2026-09, manual coordinate search evaluated against the
	// real render-vs-COM pipeline used throughout this module, all 4
	// `a:lightRig/@dir` values): the previous (diffuseConstant 0.55,
	// specularConstant 0.9, specularExponent 28, surfaceScaleMultiplier
	// implicitly 1) combination regressed `circle` specifically (54.9 ->
	// 80.1 mean error). This combination (surfaceScaleMultiplier 0.35,
	// diffuseConstant raised to 0.75) VERIFIED to bring `angle`, `hardEdge`
	// and `softRound` at or below the box-shadow baseline in EVERY direction
	// (`angle`: baseline ~70, now ~19-27; `hardEdge`: baseline ~69.5, now 44;
	// `softRound`: baseline ~50, now 6.5-19). `circle` alone could NOT be
	// brought below baseline with any tested combination of these four
	// MATERIAL parameters (tried down to `surfaceScaleMultiplier` 0.15 and up
	// to 2.5) against the then-current (ECMA-376-reasoned) profile table, and
	// was routed to the legacy `box-shadow` model instead of shipping a
	// regression. SUPERSEDED 2026-09: re-fitting the PROFILE table's own
	// `circle` entry against real COM data (a change orthogonal to these
	// material constants) resolved it without touching the numbers below; see
	// this file's module doc comment and `visual-3d-bevel-lighting-routing
	// .ts`.
	//
	// A SEPARATE, more severe issue was found (2026-09, while attempting an
	// ambient/wrap-term fix for the `circle` routing above) that this
	// calibration was never tested against: `specularConstant: 0.9` combined
	// with `specularExponent: 24` was tuned against `threePt` at its OLD
	// (pre-COM-calibration) `elevationDeg` of 45. `LIGHT_RIG_LIGHTING`'s real
	// per-rig COM campaign now measures `threePt` at `elevationDeg: 74`, and
	// several other rigs (`contrasting`, the `flat`/`legacyFlat*` family) sit
	// at 90. `feSpecularLighting`'s hot-spot brightness at a FLAT height-map
	// region (i.e. the shape's plain, non-bevelled interior, not just the
	// bevel band: N = (0,0,1) there regardless of `a:bevelT/@prst`, so this
	// is independent of bevel PROFILE) is `specularConstant *
	// max(0, N.H)^specularExponent`; solving that formula directly (not
	// rendered, the closed form) gives 0.135 at elevation 45 (small, as the
	// original calibration assumed) but 0.71 at elevation 74 and 0.9 (the
	// full `specularConstant`, N.H=1 exactly) at elevation 90 - confirmed by
	// actually rendering the real filter chain (a pure-SVG render matching
	// `resolveLayer`'s output byte-for-byte): a `metal`/`circle` square under
	// `threePt` now samples FULLY SATURATED (255,255,255) at its edge bands
	// AND its flat center alike, not just a shadow-side clamp. This means the
	// `circle`-only routing above no longer isolates the real defect for
	// these rigs: the whole shape washes out, so an ambient/wrap term on the
	// diffuse layer (which only helps the shadow-clamp problem) would not by
	// itself bring metal back under the box-shadow baseline. This is a
	// STRUCTURAL gap (this filter drives diffuse falloff and the specular
	// hot-spot from the SAME `feDistantLight` elevation, but a coupling this
	// codebase's simplified model never validated), not specific to `circle`
	// or to this pass's elevation recalibration (`flat`'s elevationDeg was
	// already ~90 before this campaign, so the same saturation already
	// existed for `metal` under the `flat` rig family; the campaign only
	// widened which rigs trigger it, by correcting `threePt`/`contrasting`
	// toward their real measured values). Re-tuning `specularConstant`/
	// `specularExponent` (or decoupling a separate specular elevation from
	// the diffuse one) needs its own COM campaign and was NOT done here; see
	// `docs/guide/limitations.md`.
	metal: {
		diffuseConstant: 0.75,
		specularConstant: 0.9,
		specularExponent: 24,
		lightingColor: white,
		surfaceScaleMultiplier: 0.35,
	},
	flat: {
		diffuseConstant: 0.9,
		specularConstant: 0,
		specularExponent: 1,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	legacyMatte: {
		diffuseConstant: 0.88,
		specularConstant: 0.02,
		specularExponent: 4,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	legacyPlastic: {
		diffuseConstant: 0.82,
		specularConstant: 0.3,
		specularExponent: 10,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
	// Not independently calibrated; positioned near the calibrated `metal`
	// entry (same category) rather than the pre-calibration guess.
	legacyMetal: {
		diffuseConstant: 0.7,
		specularConstant: 0.8,
		specularExponent: 22,
		lightingColor: white,
		surfaceScaleMultiplier: 0.45,
	},
	legacyWireframe: {
		diffuseConstant: 0.9,
		specularConstant: 0.05,
		specularExponent: 6,
		lightingColor: white,
		surfaceScaleMultiplier: 1,
	},
};

/**
 * PowerPoint's documented default `prstMaterial` (ECMA-376 20.1.10.50) when
 * `a:sp3d` carries a bevel but no explicit material attribute.
 */
const DEFAULT_MATERIAL: MaterialPresetType = 'warmMatte';

export function getMaterialLighting(material: string | undefined): MaterialLighting {
	const key = (material as MaterialPresetType | undefined) ?? DEFAULT_MATERIAL;
	return MATERIAL_LIGHTING[key] ?? MATERIAL_LIGHTING[DEFAULT_MATERIAL];
}
