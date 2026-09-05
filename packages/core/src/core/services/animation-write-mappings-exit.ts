/**
 * EXIT half of the OOXML animation preset mappings. Split out of
 * `animation-write-mappings.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for how `PRESET_TO_OOXML` /
 * `OOXML_TO_PRESET_EXIT` are composed from this.
 *
 * @module services/animation-write-mappings-exit
 */
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

/** Forward lookup: exit preset name -> OOXML mapping. */
export const EXIT_PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	// ---- Exit effects (typed `PptxAnimationPreset` names) ----
	disappear: { presetClass: 'exit', presetId: 1, defaultSubtype: 0 },
	flyOut: { presetClass: 'exit', presetId: 2, defaultSubtype: 4 },
	// exit.6 verified via COM: `msoAnimEffectCircle` with `Effect.Exit = True`
	// serializes as `presetClass="exit" presetID="6" filter="circle(in)"`, i.e.
	// exit.6 really is Circle (matching `circleOut` below and the catalog
	// label), not Shrink. `shrinkOut` colliding on the same id is a KNOWN,
	// UNRESOLVED bug: Shrink's real exit presetID has not been COM-verified
	// (attempting to add `msoAnimEffectGrowShrink` as an exit effect fails;
	// GrowShrink is emphasis-only). Left pointing at 6 rather than guessed at
	// an unverified id; authoring "Shrink" currently produces indistinguishable
	// XML from "Circle". The reverse lookup below prefers `circleOut` for
	// reading real decks.
	shrinkOut: { presetClass: 'exit', presetId: 6, defaultSubtype: 0 },
	dissolveOut: { presetClass: 'exit', presetId: 9, defaultSubtype: 0 },
	fadeOut: { presetClass: 'exit', presetId: 10, defaultSubtype: 0 },
	wipeOut: { presetClass: 'exit', presetId: 22, defaultSubtype: 0 },
	zoomOut: { presetClass: 'exit', presetId: 23, defaultSubtype: 0 },
	// exit.26/37 verified via a fresh COM pass (AddEffect + `Effect.Exit =
	// True` + raw OOXML inspection): `msoAnimEffectBounce` re-emits presetID
	// 26 under `Effect.Exit = True` (the SAME id as its entrance form, see
	// `bounceIn` above), and `msoAnimEffectRiseUp` re-emits presetID 37 (again
	// the same id as its entrance form, see `riseUp` above). `bounceOut` and
	// `sinkDown` (Rise Up's exit-gallery name) were previously swapped here,
	// mirroring the entr.26/37 mix-up already fixed on the entrance side.
	bounceOut: { presetClass: 'exit', presetId: 26, defaultSubtype: 0 },

	// ---- Exit effects (extended catalog) ----
	blindsOut: { presetClass: 'exit', presetId: 3, defaultSubtype: 0 },
	boxOut: { presetClass: 'exit', presetId: 4, defaultSubtype: 0 },
	checkerboardOut: { presetClass: 'exit', presetId: 5, defaultSubtype: 0 },
	circleOut: { presetClass: 'exit', presetId: 6, defaultSubtype: 1 },
	crawlOut: { presetClass: 'exit', presetId: 7, defaultSubtype: 4 },
	diamondOut: { presetClass: 'exit', presetId: 8, defaultSubtype: 0 },
	// exit.11 verified via COM: `msoAnimEffectFlashOnce` with `Effect.Exit =
	// True` serializes as presetID 11 (no filter, matching the entrance
	// Flash Once at entr.11); `msoAnimEffectFlashBulb` cannot be made an exit
	// effect at all (attempting `Effect.Exit = True` on it throws; it is
	// emphasis-only, landing on emph.26 per this same COM pass, which
	// disagrees with the existing `pulse`/`bounce` = emph.26 assumption below
	// - flagged as a new, UNRESOLVED finding, out of this fix's scope). Since
	// Flash Bulb cannot be an exit effect, `flashBulbOut` is left as a
	// pre-existing compat alias of the corrected id rather than removed,
	// mirroring `flashBulbIn`. `flashOnceOut` previously pointed at 12, which
	// is wrong.
	flashBulbOut: { presetClass: 'exit', presetId: 11, defaultSubtype: 0 },
	flashOnceOut: { presetClass: 'exit', presetId: 11, defaultSubtype: 0 },
	// exit.12 verified directly via COM (this repo's own PowerShell automation,
	// not just the pre-existing ground-truth table): `AddEffect` with the Peek
	// In `MsoAnimEffect` constant (12) then `Effect.Exit = True` re-emits
	// `presetID="12" presetClass="exit" presetSubtype="4"` with a child
	// `p:animEffect[@filter="wipe(down)"]`, i.e. exit.12 IS "Peek Out" - this
	// matches `pptx-viewer-shared`'s `animation-preset-ground-truth.ts`
	// (`row('exit', 12, { sub: 4, filter: 'wipe(down)' })`) exactly, so both
	// independent sources agree. Deliberately NOT named `peekOut`: that name
	// is already bound to exit.16 throughout the authoring table, the reverse
	// lookup below, and (more importantly) `pptx-viewer-shared`'s real
	// `EffectName`/keyframe of the same name - a pre-existing, unverified
	// guess (exit.16 is actually "Split" per ground truth) that correcting is
	// a separate, larger fix out of this item's scope (see the `splitOut`/
	// `peekOut` note below and `exit.18`'s note above for the same pattern).
	// `peekOutDown` is the distinct, non-colliding typed name for THIS
	// COM-verified id.
	peekOutDown: { presetClass: 'exit', presetId: 12, defaultSubtype: 4 },
	plusOut: { presetClass: 'exit', presetId: 13, defaultSubtype: 0 },
	randomBarsOut: { presetClass: 'exit', presetId: 14, defaultSubtype: 0 },
	spiralOut: { presetClass: 'exit', presetId: 15, defaultSubtype: 0 },
	// KNOWN, UNRESOLVED (out of scope here): ground truth
	// (`row('exit', 16, ...)` via `bothClasses(16, { sub: 21, filter:
	// 'barn(inVertical)' })`) says exit.16 is really "Split", not "Peek Out";
	// `splitOut` below is ALSO wrong (it claims 17, which is really
	// "Stretch"). Left as pre-existing entries rather than corrected, because
	// `pptx-viewer-shared` has a real `peekOut` `EffectName` + dedicated
	// keyframe already wired to id 16 (see `animation-presets-extended.ts`),
	// and correcting the numbering here without also migrating that binding
	// would just move the mismatch rather than fix it.
	peekOut: { presetClass: 'exit', presetId: 16, defaultSubtype: 0 },
	splitOut: { presetClass: 'exit', presetId: 17, defaultSubtype: 0 },
	collapseOut: { presetClass: 'exit', presetId: 18, defaultSubtype: 0 },
	stripsOut: { presetClass: 'exit', presetId: 19, defaultSubtype: 0 },
	wedgeOut: { presetClass: 'exit', presetId: 20, defaultSubtype: 0 },
	wheelOut: { presetClass: 'exit', presetId: 21, defaultSubtype: 1 },
	randomEffectsOut: { presetClass: 'exit', presetId: 24, defaultSubtype: 0 },
	boomerangOut: { presetClass: 'exit', presetId: 25, defaultSubtype: 0 },
	// sinkDown is Rise Up's exit-gallery name; see the `bounceOut` note above
	// for the fresh COM pass that swapped 26/37 back to their real ids.
	sinkDown: { presetClass: 'exit', presetId: 37, defaultSubtype: 0 },
	creditsOut: { presetClass: 'exit', presetId: 27, defaultSubtype: 0 },
	floatDown: { presetClass: 'exit', presetId: 28, defaultSubtype: 0 },
	pinwheelOut: { presetClass: 'exit', presetId: 29, defaultSubtype: 0 },
	spinner2Out: { presetClass: 'exit', presetId: 30, defaultSubtype: 0 },
	contractOut: { presetClass: 'exit', presetId: 31, defaultSubtype: 0 },
	whipOut: { presetClass: 'exit', presetId: 32, defaultSubtype: 0 },
	leaveOut: { presetClass: 'exit', presetId: 33, defaultSubtype: 0 },
	basicSwivelOut: { presetClass: 'exit', presetId: 34, defaultSubtype: 0 },
	beveledDeparture: { presetClass: 'exit', presetId: 35, defaultSubtype: 0 },
	curveDownOut: { presetClass: 'exit', presetId: 36, defaultSubtype: 0 },
	unfoldOut: { presetClass: 'exit', presetId: 38, defaultSubtype: 0 },
	fadedSwivelOut: { presetClass: 'exit', presetId: 39, defaultSubtype: 0 },
	fadedZoomOut: { presetClass: 'exit', presetId: 40, defaultSubtype: 0 },
	lightSpeedOut: { presetClass: 'exit', presetId: 41, defaultSubtype: 0 },
	floatOut: { presetClass: 'exit', presetId: 42, defaultSubtype: 0 },
	flipOut: { presetClass: 'exit', presetId: 43, defaultSubtype: 0 },
	glideOut: { presetClass: 'exit', presetId: 44, defaultSubtype: 0 },
	shrinkRotate: { presetClass: 'exit', presetId: 45, defaultSubtype: 0 },
	shrinkWithColor: { presetClass: 'exit', presetId: 46, defaultSubtype: 0 },
	swivelOut: { presetClass: 'exit', presetId: 47, defaultSubtype: 0 },
	shrinkTurn: { presetClass: 'exit', presetId: 48, defaultSubtype: 0 },
	pinwheel4Out: { presetClass: 'exit', presetId: 49, defaultSubtype: 0 },
	slingOut: { presetClass: 'exit', presetId: 50, defaultSubtype: 0 },
	stretchOut: { presetClass: 'exit', presetId: 51, defaultSubtype: 0 },
	foldOut: { presetClass: 'exit', presetId: 52, defaultSubtype: 0 },
	shrinkSpin: { presetClass: 'exit', presetId: 53, defaultSubtype: 0 },
	zoomRotateOut: { presetClass: 'exit', presetId: 54, defaultSubtype: 0 },
	curvyStarOut: { presetClass: 'exit', presetId: 55, defaultSubtype: 0 },
	rotateOut: { presetClass: 'exit', presetId: 56, defaultSubtype: 0 },
	centerRevolveOut: { presetClass: 'exit', presetId: 57, defaultSubtype: 0 },
	threadOut: { presetClass: 'exit', presetId: 58, defaultSubtype: 0 },
	dropOut: { presetClass: 'exit', presetId: 59, defaultSubtype: 0 },
	ascendOut: { presetClass: 'exit', presetId: 60, defaultSubtype: 0 },
	descendOut: { presetClass: 'exit', presetId: 61, defaultSubtype: 0 },
	exitStage: { presetClass: 'exit', presetId: 62, defaultSubtype: 0 },
	easeOut: { presetClass: 'exit', presetId: 63, defaultSubtype: 0 },
	stretchyOut: { presetClass: 'exit', presetId: 64, defaultSubtype: 0 },
	zipOut: { presetClass: 'exit', presetId: 65, defaultSubtype: 0 },
	barsOut: { presetClass: 'exit', presetId: 66, defaultSubtype: 0 },
	uncoverOut: { presetClass: 'exit', presetId: 67, defaultSubtype: 0 },
	concealOut: { presetClass: 'exit', presetId: 68, defaultSubtype: 0 },
};

/**
 * Canonical typed name per exit presetID, for the reverse lookup. Ids with
 * more than one forward-map alias are seeded here explicitly.
 */
export const EXIT_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'disappear'],
	[2, 'flyOut'],
	// exit.6 verified via COM: `msoAnimEffectCircle` with `Effect.Exit = True`
	// serializes as presetID 6 with `filter="circle(in)"`, i.e. exit.6 is
	// Circle, not Shrink. `circleOut` is the canonical typed name; `shrinkOut`
	// remains a known, unresolved collision on the same forward-map id (see
	// the note on `EXIT_PRESET_TO_OOXML.shrinkOut` above).
	[6, 'circleOut'],
	[9, 'dissolveOut'],
	[10, 'fadeOut'],
	// exit.11 verified via COM: Flash Once (not Flash Bulb, which cannot be
	// an exit effect at all). `flashOnceOut` is preferred as canonical over
	// the pre-existing `flashBulbOut` alias, mirroring `flashOnceIn` on the
	// entrance side.
	[11, 'flashOnceOut'],
	// exit.12 verified via COM (see the note on
	// `EXIT_PRESET_TO_OOXML.peekOutDown` above): Peek Out, `presetSubtype="4"`,
	// `filter="wipe(down)"`. Not named `peekOut` here for the same
	// non-collision reason.
	[12, 'peekOutDown'],
	[22, 'wipeOut'],
	[23, 'zoomOut'],
	// exit.26/37 verified via a fresh COM pass: `msoAnimEffectBounce` with
	// `Effect.Exit = True` re-emits presetID 26 (matching its entrance form,
	// see `bounceIn` above) and `msoAnimEffectRiseUp` with `Effect.Exit =
	// True` re-emits presetID 37 (matching its entrance form, see `riseUp`
	// above). The two were previously swapped in this table (26 had no
	// override and fell through to `sinkDown`; 37 pointed at `bounceOut`).
	[26, 'bounceOut'],
	[37, 'sinkDown'],
];
