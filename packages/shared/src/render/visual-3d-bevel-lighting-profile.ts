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
	/**
	 * Non-monotonic height REMAP for the three profiles (`relaxedInset`,
	 * `slope`, `hardEdge`) whose COM cross-section is a genuine
	 * bright-bump-then-dark-trough double transition (see this module's doc
	 * comment), which the `blurFactor`/`morphologyFactor`/`surfaceScaleFactor`
	 * ramp above cannot reproduce on its own: that ramp only ever builds a
	 * single monotonic height field (alpha blurred, optionally eroded), so its
	 * diffuse/specular response can rise-then-settle but never
	 * rise-then-undershoot-then-settle.
	 *
	 * When present, `visual-3d-bevel-lighting.ts` feeds the monotonic ramp
	 * through an SVG `feComponentTransfer`/`feFuncA type="table"` BEFORE
	 * lighting it: `feFuncA` linearly interpolates between these stops across
	 * the input domain `[0, 1]`, so a table that rises then falls then rises
	 * again reshapes the height field's spatial derivative (and therefore its
	 * surface normal, and therefore its diffuse/specular brightness) into a
	 * genuine two-lobe profile, even though the INPUT ramp it remaps is still
	 * monotonic. This is the "genuinely non-monotonic (two-lobe) height-map"
	 * the pre-2026-09-16 doc comment below flagged as out of scope; it is
	 * cheap to build this way because `feComponentTransfer` remaps a value
	 * pointwise, so it needs no new geometry primitive, just a reshaping stage
	 * between the existing blur/erode step and `feDiffuseLighting`.
	 *
	 * Each profile's table is the profile's own pinned 24pt COM cross-section
	 * curve (`visual-3d-bevel-lighting-tables.test.ts`'s
	 * `MEASURED_24PT_CURVES`, 10 points from the top edge inward), normalised
	 * to `[0, 1]` via `(brightness - min) / (max - min)`. This is a deliberate
	 * choice, not a claim of a rigorously inverted lighting model: for a
	 * gently-curved, primarily-diffuse height field the rendered brightness
	 * tracks the local height fairly directly, so reusing the MEASURED
	 * brightness curve's own shape as the height-remap curve reproduces the
	 * measured peak/trough/recovery POSITIONS closely without solving the
	 * (non-invertible in closed form) diffuse/specular equations backwards.
	 * Verified structurally (`visual-3d-bevel-lighting.test.ts`): each table
	 * is non-monotonic (has an interior local max followed by an interior
	 * local min before recovering), and the generated filter markup carries
	 * the `feComponentTransfer` stage only for these three profiles. NOT
	 * independently re-verified against a fresh COM render (no new
	 * `Slide.Export` measurement was taken for this change; the existing 2026-
	 * 09 pins above are the ground truth reused here), so treat the exact
	 * on-screen brightness as an analytical/geometric fit against already-
	 * measured data, not a newly pixel-verified match.
	 */
	heightTransferTable?: readonly number[];
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
 * reproduce on its own - the original 3-parameter fit pushed
 * `surfaceScaleFactor` to the largest tested value trying to reach the
 * trough depth, landing the LARGEST relief factor of any profile, the
 * opposite of the pre-2026-09 "slope/hardEdge are low-relief" assumption
 * (`slope`/`hardEdge` were previously reasoned as "steep/narrow" with
 * REDUCED relief; `relaxedInset` was previously grouped as "curved" with
 * full relief and no erode at all), but still only reached RMSE 12-19
 * against the measured curve (versus 1-7 for the other 9).
 *
 * **2026-09-16: closed via a height-remap stage.** These three profiles now
 * also carry a `heightTransferTable` (see that field's own doc comment
 * above): an `feComponentTransfer`/`feFuncA type="table"` reshaping stage,
 * inserted between the existing blur(+erode) ramp and the lighting
 * primitives, remaps the monotonic ramp through each profile's own measured
 * bright-bump-then-dark-trough curve shape. The three factors below (blur/
 * morphology/surfaceScale) are UNCHANGED and still control the underlying
 * ramp's width and crispness; the new field supplies the genuinely
 * non-monotonic (two-lobe) height response this doc comment previously
 * flagged as needing a new primitive chain, without actually needing one.
 * This was NOT re-verified against a fresh COM render (see
 * `heightTransferTable`'s doc comment); it is an analytical/geometric fit
 * against the SAME measured curves pinned below, not a new measurement - see
 * `docs/guide/limitations.md` and `docs/guide/visual-effects.md` for the
 * current framing.
 *
 * The direction-independence these three still show (`measuredUniform`) is
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
		// Normalised (0-1) directly from the pinned 24pt COM cross-section
		// curve (`visual-3d-bevel-lighting-tables.test.ts`'s
		// `MEASURED_24PT_CURVES.relaxedInset`, brightness 113.0/135.7/139.0/
		// 137.0/60.0/85.3/126.3/133.0/133.0/133.0): peaks at stop 2, troughs at
		// stop 4, recovers to flat by stop 6. See `heightTransferTable`'s doc
		// comment.
		heightTransferTable: [0.671, 0.958, 1.0, 0.975, 0.0, 0.32, 0.839, 0.924, 0.924, 0.924],
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
	// all three, which the blur(+erode) ramp's ORIGINAL 3 factors alone cannot
	// reproduce (its height field has one bell-shaped slope lobe, so the
	// diffuse/specular response can only rise-then-settle, never
	// rise-then-undershoot-then-settle). These 3 factors are kept as the
	// closest achievable fit for the underlying ramp's width/crispness; each
	// profile's `heightTransferTable` (see that field's doc comment) supplies
	// the actual non-monotonic double transition on top of that ramp.
	slope: {
		blurFactor: 0.55,
		morphologyFactor: 0.5,
		surfaceScaleFactor: 1.5,
		measuredUniform: true,
		// Normalised from `MEASURED_24PT_CURVES.slope` (114.0/134.7/133.3/
		// 133.0/91.7/110.0/96.0/133.0/133.0/133.0): peaks at stop 1, dips at
		// stop 4, a second shallower dip at stop 6, recovers by stop 7.
		heightTransferTable: [0.519, 1.0, 0.967, 0.96, 0.0, 0.426, 0.1, 0.96, 0.96, 0.96],
	},
	hardEdge: {
		blurFactor: 0.55,
		morphologyFactor: 0.5,
		surfaceScaleFactor: 1.5,
		measuredUniform: true,
		// Normalised from `MEASURED_24PT_CURVES.hardEdge` (111.7/135.0/133.0/
		// 133.0/102.7/104.0/128.3/133.0/133.0/133.0): peaks at stop 1, troughs
		// at stop 4, recovers by stop 6.
		heightTransferTable: [0.279, 1.0, 0.938, 0.938, 0.0, 0.04, 0.793, 0.938, 0.938, 0.938],
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
