/**
 * `a:bevelT/@prst` profile -> SVG height-map shape.
 *
 * Split out of `visual-3d-bevel-lighting-tables.ts` to keep both files under
 * the repo's ~300 LOC guideline; see that module's doc comment for the other
 * two axes (light rig elevation, material response) and the highlight
 * DIRECTION, which is resolved separately in `visual-3d-bevel-light.ts`.
 *
 * @module render/visual-3d-bevel-lighting-profile
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
	 * is about which CARDINAL EDGE lights up (or doesn't), independent of the
	 * cross-section ramp SHAPE the factors below now target - see this
	 * module's doc comment. Kept as a flag so callers/tests can assert on it
	 * rather than re-deriving it from the two factors above.
	 */
	measuredUniform: boolean;
}

/**
 * `a:bevelT/@prst` (and `bevelB`, which shares the same profile vocabulary)
 * -> height-map shape. ECMA-376 20.1.10.9 describes each profile's silhouette
 * (a "circular", "flat sloped", "crossed", "art-deco stepped" etc.
 * cross-section); these factors were ORIGINALLY grouped into 3
 * physically-motivated buckets by that description (curved / faceted /
 * steep-narrow) rather than 12 independent hand-tuned entries, reasoned from
 * ECMA-376 alone.
 *
 * COM-MEASURED 2026-09 (real PowerPoint `Slide.Export`, mid-grey `matte`
 * square, `threePt` rig / `dir="t"`, `orthographicFront` camera, both a 6pt
 * and a 24pt `a:bevelT`, a line of 40 brightness samples from the top edge
 * inward for all 12 profiles): fitting these SAME 3 factors (grid search,
 * minimum RMSE against the measured curve, both depths jointly) against real
 * cross-section data overturned the bucket story for 3 profiles.
 * `circle`/`convex`/`softRound`/`divot` (curved) and `angle`/`cross`/
 * `coolSlant`/`riblet`/`artDeco` (faceted) fit closely (RMSE 1-7 brightness
 * units) with factors in the same rough range as the original reasoning, so
 * their bucket membership held up. `relaxedInset`, `slope` and `hardEdge`
 * did NOT: all three measured a genuine BRIGHT-BUMP-THEN-DARK-TROUGH double
 * transition partway through the ramp (e.g. `hardEdge` at 24pt: baseline 133
 * -> peaks ~139 -> drops to 67 -> recovers), which this filter's single
 * monotonic blur(+erode) height map (one bell-shaped slope lobe) cannot
 * reproduce - the fit pushes `surfaceScaleFactor` to the largest tested
 * value trying to reach the trough depth, landing the LARGEST relief factor
 * of any profile, the opposite of the pre-2026-09 "slope/hardEdge are
 * low-relief" assumption (`slope`/`hardEdge` were previously reasoned as
 * "steep/narrow" with REDUCED relief; `relaxedInset` was previously grouped
 * as "curved" with full relief and no erode at all). Their factors below are
 * therefore the closest achievable fit within this 3-parameter chain, not a
 * claim of a clean match (RMSE 12-19, versus 1-7 for the other 9); a proper
 * fix needs a genuinely non-monotonic (two-lobe) height-map primitive chain,
 * out of scope for this pass - see `docs/guide/limitations.md`. The
 * direction-independence these three still show (`measuredUniform`) is
 * unaffected: it is a separate, already-COM-confirmed finding (see
 * `visual-3d-bevel-light.ts`'s module doc comment) about which CARDINAL EDGE
 * lights up, not about the cross-section ramp shape this campaign measures.
 * Scripts (scratch, not committed, same convention as `com-acceptance.mjs`):
 * `scripts/make-bevel-profile-fixture.mjs` (fixture, all 12
 * profiles x 2 depths), `scripts/measure-bevel-profile-com.ps1`
 * (COM export + 40-point sampler), `scripts/fit-bevel-profile-com.mjs`
 * (grid-search fit; a closed-form Gaussian-CDF reimplementation of the
 * primitive chain, not a headless-browser render - Playwright's Chromium
 * launch hangs indefinitely via a plain script in this environment, though
 * `bunx playwright test` itself works fine, used to independently verify the
 * metal/circle routing conclusion in `visual-3d-bevel-lighting-routing.ts`).
 * The raw 10-point-per-profile table (24pt depth) is pinned in
 * `visual-3d-bevel-lighting-tables.test.ts`; the full 40-point x 2-depth
 * table is in the task report.
 */
export const BEVEL_PROFILE_HEIGHT_MAP: Record<string, BevelProfileHeightMap> = {
	circle: { blurFactor: 0.35, surfaceScaleFactor: 0.65, measuredUniform: false },
	convex: {
		blurFactor: 0.18,
		morphologyFactor: 0.4,
		surfaceScaleFactor: 0.2,
		measuredUniform: false,
	},
	softRound: {
		blurFactor: 0.25,
		morphologyFactor: 0.4,
		surfaceScaleFactor: 0.65,
		measuredUniform: false,
	},
	relaxedInset: {
		blurFactor: 0.35,
		morphologyFactor: 0.5,
		surfaceScaleFactor: 1.5,
		measuredUniform: false,
	},
	divot: { blurFactor: 0.18, surfaceScaleFactor: 0.5, measuredUniform: false },
	angle: {
		blurFactor: 0.35,
		morphologyFactor: 0.4,
		surfaceScaleFactor: 0.35,
		measuredUniform: false,
	},
	cross: {
		blurFactor: 0.12,
		morphologyFactor: 0.18,
		surfaceScaleFactor: 0.2,
		measuredUniform: false,
	},
	coolSlant: {
		blurFactor: 0.25,
		morphologyFactor: 0.06,
		surfaceScaleFactor: 0.5,
		measuredUniform: false,
	},
	riblet: {
		blurFactor: 0.25,
		surfaceScaleFactor: 0.5,
		measuredUniform: false,
	},
	artDeco: {
		blurFactor: 0.18,
		morphologyFactor: 0.32,
		surfaceScaleFactor: 0.35,
		measuredUniform: false,
	},
	// `relaxedInset`/`slope`/`hardEdge` (see this table's doc comment): COM
	// measured a genuine BRIGHT-BUMP-THEN-DARK-TROUGH double transition for
	// all three, which a single monotonic blur(+erode) ramp cannot reproduce
	// (its height field has one bell-shaped slope lobe, so the diffuse/
	// specular response can only rise-then-settle, never rise-then-undershoot-
	// then-settle). These factors are the closest achievable fit within the
	// existing 3-parameter primitive chain (the grid search pushed
	// `surfaceScaleFactor` to its upper bound trying to reach the measured
	// trough depth), not a claim of a clean match; see the doc comment.
	slope: {
		blurFactor: 0.55,
		morphologyFactor: 0.5,
		surfaceScaleFactor: 1.5,
		measuredUniform: true,
	},
	hardEdge: {
		blurFactor: 0.55,
		morphologyFactor: 0.5,
		surfaceScaleFactor: 1.5,
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
