/**
 * Data tables for the real SVG lighting bevel filter (framework-agnostic).
 *
 * Split out of `visual-3d-bevel-lighting.ts` to keep that module under the
 * repo's ~300 LOC guideline. Three independent axes feed the filter this
 * module's data drives: bevel PROFILE shape (`a:bevelT/@prst`, ECMA-376
 * 20.1.10.9 `ST_BevelPresetType`), light rig ELEVATION/specular character
 * (`a:lightRig/@rig`, ECMA-376 20.1.10.36 `ST_LightRigType`), and MATERIAL
 * response (`a:sp3d/@prstMaterial`, ECMA-376 20.1.10.50 `ST_PresetMaterialType`).
 * The highlight/shadow DIRECTION (azimuth) itself is mostly resolved
 * elsewhere: `visual-3d-bevel-light`'s already COM-measured cardinal-snap
 * vector supplies the base azimuth from `a:lightRig/@dir`, and this module's
 * `LIGHT_RIG_LIGHTING.invertedDirection` (COM-measured, see that export's own
 * doc comment) supplies the one further correction that vector doesn't
 * cover: 10 of the 27 rigs flip which cardinal edge lights up.
 *
 * An early COM check (2026-09, PowerPoint `Slide.Export`, mid-grey 1.4in
 * square, `circle`/matte, `dir="t"`, sampled 0.15in from the top and bottom
 * edges) did NOT confirm the then-assumed "harsh has higher contrast than
 * threePt" ordering at that sample distance: measured contrast (highlight
 * brightness minus shadow brightness, 0-255) was `threePt` 47, `soft` 38,
 * `flat` 0 (exactly, matching `flat`'s intentional no-op design), and `harsh`
 * only -4. A full 27-rig, two-direction (`dir="t"` and the perpendicular
 * `dir="r"`) follow-up campaign (see `LIGHT_RIG_LIGHTING`'s doc comment)
 * resolved this: `harsh`'s -4 was not noise or a narrower falloff band, it
 * was `harsh` being one of the 10 `invertedDirection` rigs (highlight on the
 * edge OPPOSITE `dir`, so its small measured value is a near-flat rig with
 * the "wrong" sign, not a sharp rig sampled past its falloff). See
 * `visual-3d-bevel-lighting.ts`'s module doc for the (separately real)
 * profile x material x direction COM comparison table.
 *
 * @module render/visual-3d-bevel-lighting-tables
 */

/** How wide/sharp a bevel profile's SVG height-map ramp is, and how strongly it carries a directional signal. */
export interface BevelProfileHeightMap {
	/** `feGaussianBlur` `stdDeviation` factor, multiplied by the bevel's own (width+height)/2 in px. */
	blurFactor: number;
	/** `feMorphology` `radius` factor (erode), or `undefined` for a pure-blur (smooth, curved) profile. */
	morphologyFactor?: number;
	/** Relief height (`surfaceScale`) factor: 1 = full, less for a shallow/steep-walled profile. */
	surfaceScaleFactor: number;
	/**
	 * `true` for the two profiles (`slope`, `hardEdge`) COM-measured (see
	 * `visual-3d-bevel-light`) to show NO clean directional brightness signal
	 * at any sampled depth, only a crisp, near-uniform self-shadowed seam. This
	 * module's narrow-blur + high-erode + reduced-surfaceScale combination is
	 * chosen SPECIFICALLY because it reproduces that same low-direction-
	 * dependence physically (a steep, narrow facet has a near-vertical normal,
	 * so `feDiffuseLighting`/`feSpecularLighting`'s `N.L` term barely changes
	 * with azimuth) rather than encoding a guessed direction the way the
	 * pre-existing box-shadow approach had to. Kept as a flag so callers/tests
	 * can assert on it rather than re-deriving it from the two factors above.
	 */
	measuredUniform: boolean;
}

/**
 * `a:bevelT/@prst` (and `bevelB`, which shares the same profile vocabulary)
 * -> height-map shape. ECMA-376 20.1.10.9 describes each profile's silhouette
 * (a "circular", "flat sloped", "crossed", "art-deco stepped" etc. cross-
 * section); this table groups the 12 values by that description into 3
 * physically-motivated buckets rather than 12 independent hand-tuned entries:
 *
 * - **Curved** (`circle`, `convex`, `softRound`, `relaxedInset`, `divot`):
 *   a smooth, rounded cross-section -> wide Gaussian-only ramp, full relief.
 * - **Faceted** (`angle`, `cross`, `coolSlant`, `riblet`, `artDeco`): a flat
 *   angled facet with a visible crease -> a medium blur PLUS a light erode so
 *   the ramp gets a crisper inner edge (the crease), full relief.
 * - **Steep/narrow** (`slope`, `hardEdge`): COM-measured to show no clean
 *   directional signal (see {@link BevelProfileHeightMap.measuredUniform});
 *   a narrow, heavily-eroded ramp with reduced relief reproduces that
 *   physically instead of guessing a highlight side.
 */
export const BEVEL_PROFILE_HEIGHT_MAP: Record<string, BevelProfileHeightMap> = {
	circle: { blurFactor: 0.55, surfaceScaleFactor: 1, measuredUniform: false },
	convex: { blurFactor: 0.6, surfaceScaleFactor: 1.05, measuredUniform: false },
	softRound: { blurFactor: 0.5, surfaceScaleFactor: 0.9, measuredUniform: false },
	relaxedInset: { blurFactor: 0.45, surfaceScaleFactor: 0.85, measuredUniform: false },
	divot: { blurFactor: 0.4, surfaceScaleFactor: 0.8, measuredUniform: false },
	angle: {
		blurFactor: 0.32,
		morphologyFactor: 0.12,
		surfaceScaleFactor: 1,
		measuredUniform: false,
	},
	cross: {
		blurFactor: 0.3,
		morphologyFactor: 0.15,
		surfaceScaleFactor: 0.95,
		measuredUniform: false,
	},
	coolSlant: {
		blurFactor: 0.28,
		morphologyFactor: 0.14,
		surfaceScaleFactor: 0.95,
		measuredUniform: false,
	},
	riblet: {
		blurFactor: 0.26,
		morphologyFactor: 0.18,
		surfaceScaleFactor: 0.9,
		measuredUniform: false,
	},
	artDeco: {
		blurFactor: 0.24,
		morphologyFactor: 0.2,
		surfaceScaleFactor: 1,
		measuredUniform: false,
	},
	slope: {
		blurFactor: 0.12,
		morphologyFactor: 0.35,
		surfaceScaleFactor: 0.4,
		measuredUniform: true,
	},
	hardEdge: {
		blurFactor: 0.1,
		morphologyFactor: 0.4,
		surfaceScaleFactor: 0.35,
		measuredUniform: true,
	},
};

const DEFAULT_HEIGHT_MAP: BevelProfileHeightMap = {
	blurFactor: 0.4,
	surfaceScaleFactor: 0.8,
	measuredUniform: false,
};

export function getBevelProfileHeightMap(bevelType: string): BevelProfileHeightMap {
	return BEVEL_PROFILE_HEIGHT_MAP[bevelType] ?? DEFAULT_HEIGHT_MAP;
}

/** Light elevation (degrees, 0 = grazing, 90 = straight-on) and specular sharpness bucket for a light rig. */
export interface LightRigLighting {
	elevationDeg: number;
	/** `feSpecularLighting`'s `specularExponent` multiplier (1 = neutral). */
	specularSharpness: number;
	/**
	 * `true` when this rig's measured highlight sits on the edge OPPOSITE
	 * `a:lightRig/@dir` rather than the edge `dir` points at (see this
	 * module's doc comment). Combines with (multiplies) the bevel-profile
	 * inversion `isBevelProfileInverted` already applies, the same way that
	 * flag and the top/bottom-bevel inversion already combine.
	 */
	invertedDirection?: boolean;
}

/**
 * `a:lightRig/@rig` -> elevation/sharpness/direction. COM-CALIBRATED
 * (2026-09, real PowerPoint `Slide.Export`, mid-grey #808080 1.4in square,
 * `matte`/`circle`, 24pt bevel, `orthographicFront`, all 27 `ST_LightRigType`
 * tokens, sampled 0.15in from edge, Rec.709 luminance): a `dir="t"` campaign
 * (sampling the top/bottom edges) and an independent `dir="r"` campaign
 * (sampling left/right) were run for every rig; the two agreed on both sign
 * and magnitude for all 27 rigs (mean absolute difference under 1 brightness
 * unit), confirming `a:lightRig/@dir` genuinely rotates each rig's effective
 * azimuth (not a fixed, `dir`-independent offset) and that the per-rig
 * finding below is repeatable, not sampling noise. Scripts (scratch, not
 * committed, same convention as `com-acceptance.mjs`):
 * `scripts/_scratch-make-lightrig-fixture.mjs` (dir="t" fixture, all 27
 * rigs), `scripts/_scratch-make-lightrig-fixture-dirR.mjs` (dir="r"
 * counterpart), `scripts/_scratch-measure-sample.ps1` (generic COM
 * `Slide.Export` + pixel sampler). Raw per-rig table (brightness 0-255,
 * `contrast` = highlight edge minus opposite edge, averaged between the two
 * campaigns):
 *
 * ```
 * rig             contrast  elevationDeg  invertedDirection
 * legacyHarsh2      49.0        73        false
 * threePt           47.5        74        false
 * legacyNormal2      43.0        75        false
 * soft               38.5        77        false
 * legacyFlat2        37.0        77        false
 * flood              15.5        85        false
 * legacyHarsh1        0.0        90        false
 * legacyFlat1        -0.5        90        false
 * legacyFlat3         0.0        90        false
 * legacyNormal1       0.0        90        false
 * legacyNormal3       0.0        90        false
 * legacyHarsh3        0.0        90        false
 * contrasting         0.0        90        false
 * flat                0.0        90        false
 * glow                0.0        90        false
 * brightRoom          0.0        90        false
 * harsh               -4.0       89        true
 * balanced            -6.0       88        true
 * twoPt              -30.5       79        true
 * legacyFlat4        -37.0       77        true
 * legacyNormal4      -43.0       75        true
 * legacyHarsh4       -49.0       73        true
 * sunset             -74.0       64        true
 * freezing           -79.1       62        true
 * chilly             -80.2       62        true
 * sunrise            -88.6       59        true
 * morning           -101.1       54        true
 * ```
 *
 * `elevationDeg` was fit (not guessed) by rendering the ACTUAL production SVG
 * filter primitive chain (`visual-3d-bevel-lighting.ts`'s
 * `resolveLayer`/`renderLayerPrimitives`, reusing the SAME `getBevelProfile
 * HeightMap('circle')`/`getMaterialLighting('matte')` table lookups this
 * module already exports) for `elevationDeg` swept 5..90 in 5deg steps at the
 * identical geometry, taking a pure-SVG (no `foreignObject`, so the canvas
 * read-back isn't tainted) screenshot-equivalent raster via a headless
 * Chromium `<canvas>` draw, and sampling the SAME 0.15in-from-edge points.
 * That render-side sweep is monotonically decreasing in contrast across
 * `elevationDeg` 45..90 (117 down to 0 brightness units), which covers every
 * measured `|contrast|` above (max 101.1); each rig's `elevationDeg` is the
 * piecewise-linear inverse of its measured `|contrast|` against that curve
 * (`scripts/_scratch-lightrig-calibration-gen.mjs` + a canvas sampler
 * embedded in `scripts/_scratch-sample-host.html`, both scratch/uncommitted).
 * `specularSharpness` was NOT part of this campaign (only `elevationDeg`/
 * `invertedDirection` were COM-fit) and keeps its pre-existing REASONED
 * per-family value.
 *
 * The most consequential finding is `invertedDirection`: 10 of the 27 rigs
 * (`harsh`, `balanced`, `twoPt`, the `*4` legacy variant of each `legacy{Flat,
 * Normal,Harsh}` family, and all 5 weather rigs `morning`/`sunrise`/`sunset`/
 * `chilly`/`freezing`) measure their highlight on the edge OPPOSITE
 * `a:lightRig/@dir`, not the edge `dir` points at - the previous reasoned
 * table had no way to represent this (a single `elevationDeg` cannot flip
 * azimuth) and silently got the highlight side backwards for all 10.
 * `legacyFlat2`/`legacyNormal2`/`legacyHarsh2` and their `*4` mirror twins
 * are NOT interchangeable within a "legacy family" the way the old table
 * assumed (both grouped to one shared value): `*1`/`*3` measure a clean
 * `elevationDeg=90` (no directional signal at that sample offset) while `*2`
 * is normal-direction and `*4` is its exact `invertedDirection` mirror
 * (matching magnitude, opposite sign) - each of the 4 numbered variants in a
 * legacy family is now its own table entry rather than 4 copies of one value.
 */
export const LIGHT_RIG_LIGHTING: Record<string, LightRigLighting> = {
	flat: { elevationDeg: 90, specularSharpness: 0.3 },
	legacyFlat1: { elevationDeg: 90, specularSharpness: 0.3 },
	legacyFlat2: { elevationDeg: 77, specularSharpness: 0.3 },
	legacyFlat3: { elevationDeg: 90, specularSharpness: 0.3 },
	legacyFlat4: { elevationDeg: 77, specularSharpness: 0.3, invertedDirection: true },
	harsh: { elevationDeg: 89, specularSharpness: 1.6, invertedDirection: true },
	contrasting: { elevationDeg: 90, specularSharpness: 1.5 },
	legacyHarsh1: { elevationDeg: 90, specularSharpness: 1.5 },
	legacyHarsh2: { elevationDeg: 73, specularSharpness: 1.4 },
	legacyHarsh3: { elevationDeg: 90, specularSharpness: 1.5 },
	legacyHarsh4: { elevationDeg: 73, specularSharpness: 1.4, invertedDirection: true },
	soft: { elevationDeg: 77, specularSharpness: 0.6 },
	flood: { elevationDeg: 85, specularSharpness: 0.7 },
	glow: { elevationDeg: 90, specularSharpness: 0.5 },
	brightRoom: { elevationDeg: 90, specularSharpness: 0.65 },
	morning: { elevationDeg: 54, specularSharpness: 0.75, invertedDirection: true },
	sunrise: { elevationDeg: 59, specularSharpness: 0.8, invertedDirection: true },
	sunset: { elevationDeg: 64, specularSharpness: 0.8, invertedDirection: true },
	chilly: { elevationDeg: 62, specularSharpness: 0.6, invertedDirection: true },
	freezing: { elevationDeg: 62, specularSharpness: 0.6, invertedDirection: true },
	threePt: { elevationDeg: 74, specularSharpness: 1 },
	balanced: { elevationDeg: 88, specularSharpness: 0.95, invertedDirection: true },
	twoPt: { elevationDeg: 79, specularSharpness: 1, invertedDirection: true },
	legacyNormal1: { elevationDeg: 90, specularSharpness: 1 },
	legacyNormal2: { elevationDeg: 75, specularSharpness: 1 },
	legacyNormal3: { elevationDeg: 90, specularSharpness: 1 },
	legacyNormal4: { elevationDeg: 75, specularSharpness: 1, invertedDirection: true },
};

const DEFAULT_LIGHT_RIG: LightRigLighting = { elevationDeg: 45, specularSharpness: 1 };

export function getLightRigLighting(rigType: string | undefined): LightRigLighting {
	if (!rigType) {
		return DEFAULT_LIGHT_RIG;
	}
	return LIGHT_RIG_LIGHTING[rigType] ?? DEFAULT_LIGHT_RIG;
}

export { getMaterialLighting, MATERIAL_LIGHTING } from './visual-3d-bevel-lighting-material';
export type { MaterialLighting } from './visual-3d-bevel-lighting-material';
