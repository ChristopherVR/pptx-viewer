/**
 * `animation-presets-extended` - the "extended" (post-2007) entrance/exit
 * OOXML preset IDs that `animation-presets.ts`'s `PRESET_ID_TO_EFFECT` spreads
 * in, split out to keep that file under the repo's file-size guideline. This
 * closed a real gap: only 54 of the 200 non-path entrance/exit/emphasis
 * preset IDs had a dedicated playback effect before this pass, so an
 * unmapped id fell through to the generic entrance/exit fade safety net.
 *
 * CONFIDENCE, READ BEFORE TRUSTING AN ENTRY: ids 1-26 (mapped directly in
 * `animation-presets.ts`, not here) are COM-confirmed for both the numeric id
 * and its `p:animEffect/@filter`; see `animation-preset-ground-truth.ts`.
 * From id 27 up, a fresh COM pass (`AddEffect` + raw OOXML inspection) showed
 * PowerPoint's classic object-model automation cannot reproduce most
 * "extended" gallery effects with their authored richness: it degrades them
 * to a plain `filter="fade"` reveal with no `p:animScale`/`p:animRot` child,
 * and (per a `msoAnimEffectColorReveal`/`msoAnimEffectCredits` mismatch found
 * in this same pass) the specific `MsoAnimEffect` constant requested did not
 * reliably land on the id the UI catalog already assumes for that gallery
 * name. So ids 27+ below are matched by NAME against the pre-existing,
 * previously-reviewed authoring reverse lookup
 * (`animation-write-mappings.ts`'s `PRESET_TO_OOXML`) and UI catalog
 * (`animation-preset-catalog.ts`) instead of being re-derived from this
 * pass's raw COM output. Every id without a bespoke keyframe reuses the
 * closest existing family; the exact reuse choice for each is asserted
 * (identity match or an explicit APPROXIMATION_ALLOWLIST entry) by
 * `animation-preset-tables-consistency.test.ts`, which is the authoritative
 * source for "does this id's choice still agree with authoring/catalog" -
 * this file's comments explain the WHY, that test enforces it stays true.
 *
 * @module render/animation-presets-extended
 */

import type { EffectName } from './animation-timeline-types';

/**
 * entr.7/15/24/25/27-68 (every extended entrance id not already covered in
 * `animation-presets.ts`'s directly-verified 1-26 band):
 *  - 15/25/27/28/29/30/32/36/38/41/43/44/51/52/56/57/59 (Spiral In, Boomerang,
 *    Credits, Float Up, Pinwheel, Spinner (dup of entr.49), Whip, Curve Up,
 *    Fold, Light Speed, Flip, Glide, Compress, Unfold, Rotate, Center
 *    Revolve, Drop In) get a genuinely new keyframe in
 *    `animation-keyframes-rotation-family.ts` / `animation-keyframes-motion-family.ts`.
 *  - 7/24/33/35/45/46/48/50/54/55/58/60/61/62/63/64/65/67/68 (Crawl In,
 *    Random Effects, Arrive, Beveled Arrival, Grow & Rotate, Grow with Color,
 *    Magnify, Sling, Zoom Rotate, Curvy Star, Thread, Ascend, Descend, Center
 *    Stage, Ease In, Stretchy, Zip, Cover, Reveal) reuse the closest existing
 *    family by visual similarity (see the allowlist comments in
 *    `animation-preset-tables-consistency.test.ts` for why each doesn't
 *    auto-agree by name); 34/39/40/66 also reuse an existing family but their
 *    authoring name already shares a substring with it, so no allowlist
 *    entry is needed for those four.
 */
export const EXTENDED_ENTR_PRESETS: Partial<Record<number, EffectName>> = {
	7: 'flyInBottom', // Crawl In
	15: 'spiralIn', // Spiral In - COM-confirmed (msoAnimEffectSpiral: no filter)
	24: 'fadeIn', // Random Effects
	25: 'boomerangIn', // Boomerang
	27: 'creditsIn', // Credits
	28: 'floatUpIn', // Float Up
	29: 'pinwheelIn', // Pinwheel
	30: 'spinnerIn', // Spinner (duplicate catalog label of entr.49)
	32: 'whipIn', // Whip
	33: 'riseUp', // Arrive
	34: 'swivel', // Basic Swivel
	35: 'flipIn', // Beveled Arrival
	36: 'curveUpIn', // Curve Up
	38: 'foldIn', // Fold
	39: 'swivel', // Faded Swivel
	40: 'zoomIn', // Faded Zoom
	41: 'lightSpeedIn', // Light Speed
	43: 'flipIn', // Flip
	44: 'glideIn', // Glide
	45: 'growTurnIn', // Grow & Rotate
	46: 'expandIn', // Grow with Color
	48: 'zoomIn', // Magnify
	50: 'flyInBottom', // Sling
	51: 'compressIn', // Compress
	52: 'unfoldIn', // Unfold
	54: 'spinnerIn', // Zoom Rotate
	55: 'spinnerIn', // Curvy Star
	56: 'rotateIn', // Rotate
	57: 'centerRevolveIn', // Center Revolve
	58: 'wipeIn', // Thread
	59: 'dropIn', // Drop In
	60: 'riseUp', // Ascend
	61: 'flyInTop', // Descend
	62: 'zoomIn', // Center Stage
	63: 'riseUp', // Ease In
	64: 'stretchInBottom', // Stretchy
	65: 'flyInRight', // Zip
	66: 'randomBarsIn', // Bars
	67: 'wipeIn', // Cover
	68: 'wipeIn', // Reveal
};

/**
 * exit.7/15/16/17/19/24/25/27-68 (every extended exit id not already covered
 * in `animation-presets.ts`'s directly-verified band). exit.16/17 (Peek Out,
 * Split) had no dedicated exit keyframe at all before this pass, unlike their
 * entrance counterparts; the new `peekOut`/`splitOut` keyframes in
 * `animation-keyframes-exit-shapes.ts` reuse the same mask-reveal technique
 * in reverse. exit.11 and exit.12 are intentionally NOT in this table: both
 * now have dedicated playback keyframes (`flashOnceOut`, `peekOutDown`)
 * wired directly in `animation-presets-exit.ts` alongside this pass's other
 * directly-verified ids, rather than through this extended table.
 */
export const EXTENDED_EXIT_PRESETS: Partial<Record<number, EffectName>> = {
	7: 'flyOutBottom', // Crawl Out
	15: 'spiralOut', // Spiral Out
	16: 'peekOut', // Peek Out
	17: 'splitOut', // Split
	19: 'wipeOut', // Strips (authoring: stripsOut), matching exit.18's treatment
	24: 'fadeOut', // Random Effects
	25: 'boomerangOut', // Boomerang
	27: 'creditsOut', // Credits
	28: 'floatDownOut', // Float Down
	29: 'pinwheelOut', // Pinwheel
	30: 'spinnerOut', // Spinner (duplicate catalog label)
	31: 'shrinkOut', // Contract
	32: 'whipOut', // Whip
	33: 'flyOutBottom', // Leave
	34: 'fadeOut', // Basic Swivel
	35: 'fadeOut', // Beveled Departure
	36: 'curveDownOut', // Curve Down
	38: 'unfoldOut', // Unfold
	39: 'fadeOut', // Faded Swivel (authoring name shares "fade", no allowlist needed)
	40: 'zoomOut', // Faded Zoom (authoring name shares "zoom", no allowlist needed)
	41: 'lightSpeedOut', // Light Speed
	42: 'fadeOut', // Float Out
	43: 'flipOut', // Flip
	44: 'glideOut', // Glide
	45: 'shrinkOut', // Shrink & Rotate (shares "shrink", no allowlist needed)
	46: 'shrinkOut', // Shrink with Color (shares "shrink", no allowlist needed)
	47: 'fadeOut', // Swivel Out
	48: 'shrinkOut', // Shrink & Turn (shares "shrink", no allowlist needed)
	49: 'pinwheelOut', // Pinwheel IV (shares "pinwheel", no allowlist needed)
	50: 'flyOutBottom', // Sling Out
	51: 'stretchOutBottom', // Stretch Out (shares "stretch", no allowlist needed)
	52: 'foldOut', // Fold Out
	53: 'shrinkOut', // Shrink & Spin (shares "shrink", no allowlist needed)
	54: 'spinnerOut', // Zoom Rotate Out
	55: 'spinnerOut', // Curvy Star Out
	56: 'rotateOut', // Rotate Out
	57: 'centerRevolveOut', // Center Revolve Out
	58: 'wipeOut', // Thread Out
	59: 'dropOut', // Drop Out
	60: 'flyOutTop', // Ascend (exit)
	61: 'flyOutBottom', // Descend (exit)
	62: 'zoomOut', // Exit Stage
	63: 'fadeOut', // Ease Out
	64: 'stretchOutBottom', // Stretchy Out
	65: 'flyOutRight', // Zip Out
	66: 'randomBarsOut', // Bars Out (shares "bars", no allowlist needed)
	67: 'wipeOut', // Uncover
	68: 'wipeOut', // Conceal
};
