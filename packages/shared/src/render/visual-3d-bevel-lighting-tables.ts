/**
 * Data tables for the real SVG lighting bevel filter (framework-agnostic).
 *
 * Split out of `visual-3d-bevel-lighting.ts` to keep that module under the
 * repo's ~300 LOC guideline. Three independent axes feed the filter this
 * module's data drives: bevel PROFILE shape (`a:bevelT/@prst`, ECMA-376
 * 20.1.10.9 `ST_BevelPresetType`), light rig ELEVATION/specular character
 * (`a:lightRig/@rig`, ECMA-376 20.1.10.36 `ST_LightRigType`), and MATERIAL
 * response (`a:sp3d/@prstMaterial`, ECMA-376 20.1.10.50 `ST_PresetMaterialType`).
 * The highlight/shadow DIRECTION (azimuth) itself is NOT re-derived here: it
 * reuses `visual-3d-bevel-light`'s already COM-measured cardinal-snap vector,
 * so this module only supplies the parts that vector doesn't cover.
 *
 * A real COM check (2026-09, PowerPoint `Slide.Export`, mid-grey 1.4in
 * square, `circle`/matte, `dir="t"`, sampled 0.15in from the top and bottom
 * edges) DOES NOT confirm the assumed "harsh has higher contrast than
 * threePt" ordering at that sample distance: measured contrast (highlight
 * brightness minus shadow brightness, 0-255) was `threePt` 47, `soft` 38,
 * `flat` 0 (exactly, matching `flat`'s intentional no-op design), and `harsh`
 * only -4 - the OPPOSITE sign of what a "sharper/more dramatic" reading would
 * predict. The likely explanation is that `harsh`'s band is real but
 * genuinely narrower (concentrated within well under 0.15in of the edge), so
 * by that sample distance its differential has already faded past the
 * broader, gentler `threePt`/`soft` falloff - but that is inference, not a
 * second confirmed measurement, and this single check does not by itself
 * justify a specific elevation/sharpness value for `harsh` or any other rig.
 * The elevation/specular-sharpness table below is therefore a REASONED
 * mapping, unverified by COM beyond this one inconclusive check: it groups
 * rigs by the SAME qualitative families `visual-3d.ts`'s pre-existing
 * `LIGHT_RIG_MAP` already encoded (which rigs got a `contrast()` filter
 * bump), not a COM-calibrated one. A real per-rig campaign (elevation as a
 * function of sample distance, ideally fitting the whole falloff curve
 * rather than one fixed offset) is the right way to calibrate this and was
 * not completed here. See `visual-3d-bevel-lighting.ts`'s module doc for the
 * (separately real) profile x material x direction COM comparison table.
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
}

/**
 * `a:lightRig/@rig` -> elevation/sharpness. Grouped by the SAME qualitative
 * families `visual-3d.ts`'s pre-existing `LIGHT_RIG_MAP` already encoded
 * (which rigs got a `contrast()` bump, which got none): `harsh`/`contrasting`/
 * `legacyHarsh*` are modelled low-elevation + sharp, `flat`/`legacyFlat*` are
 * straight-on (no directional signal, matching `LIGHT_RIG_MAP.flat`'s empty
 * `{}`), the diffuse/ambient family (`soft`, `flood`, `glow`, `brightRoom`,
 * the weather rigs, `legacyFlat*`) sit at a high, soft elevation, and
 * everything else (`threePt`, `balanced`, `twoPt`, `legacyNormal*`) is the
 * standard mid elevation. This is a REASONED mapping, not COM-calibrated: a
 * real `threePt`-vs-`harsh` COM check (see this module's doc comment) did
 * NOT confirm `harsh` has higher contrast than `threePt` at a fixed 0.15in
 * sample offset (measured the opposite sign); the elevation NUMBERS below
 * are not independently COM-verified.
 */
export const LIGHT_RIG_LIGHTING: Record<string, LightRigLighting> = {
	flat: { elevationDeg: 90, specularSharpness: 0.3 },
	legacyFlat1: { elevationDeg: 88, specularSharpness: 0.3 },
	legacyFlat2: { elevationDeg: 88, specularSharpness: 0.3 },
	legacyFlat3: { elevationDeg: 88, specularSharpness: 0.3 },
	legacyFlat4: { elevationDeg: 88, specularSharpness: 0.3 },
	harsh: { elevationDeg: 22, specularSharpness: 1.6 },
	contrasting: { elevationDeg: 25, specularSharpness: 1.5 },
	legacyHarsh1: { elevationDeg: 24, specularSharpness: 1.5 },
	legacyHarsh2: { elevationDeg: 26, specularSharpness: 1.4 },
	legacyHarsh3: { elevationDeg: 24, specularSharpness: 1.5 },
	legacyHarsh4: { elevationDeg: 26, specularSharpness: 1.4 },
	soft: { elevationDeg: 68, specularSharpness: 0.6 },
	flood: { elevationDeg: 62, specularSharpness: 0.7 },
	glow: { elevationDeg: 70, specularSharpness: 0.5 },
	brightRoom: { elevationDeg: 65, specularSharpness: 0.65 },
	morning: { elevationDeg: 58, specularSharpness: 0.75 },
	sunrise: { elevationDeg: 50, specularSharpness: 0.8 },
	sunset: { elevationDeg: 50, specularSharpness: 0.8 },
	chilly: { elevationDeg: 66, specularSharpness: 0.6 },
	freezing: { elevationDeg: 66, specularSharpness: 0.6 },
	threePt: { elevationDeg: 45, specularSharpness: 1 },
	balanced: { elevationDeg: 45, specularSharpness: 0.95 },
	twoPt: { elevationDeg: 45, specularSharpness: 1 },
	legacyNormal1: { elevationDeg: 45, specularSharpness: 1 },
	legacyNormal2: { elevationDeg: 45, specularSharpness: 1 },
	legacyNormal3: { elevationDeg: 45, specularSharpness: 1 },
	legacyNormal4: { elevationDeg: 45, specularSharpness: 1 },
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
