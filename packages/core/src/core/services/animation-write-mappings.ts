/**
 * OOXML animation preset mappings and helper functions for the animation
 * write service.
 *
 * `PRESET_TO_OOXML` is the forward lookup used when serialising an editor
 * animation back to OOXML — it maps a typed preset name (e.g. `flyIn`) to
 * the `(presetClass, presetID, defaultSubtype)` tuple PowerPoint expects.
 *
 * `OOXML_TO_PRESET_*` are reverse lookups used when parsing native OOXML
 * timing back to a typed name. They are keyed by `presetID` integer per
 * `presetClass`. The reverse table holds the canonical typed name for each
 * presetID; aliases (e.g. `bounce` and `pulse` both mapping to emph 26)
 * are intentionally excluded from the reverse direction so parsing produces
 * a stable, single-valued result.
 *
 * Round-trip is preserved by `PptxNativeAnimation.presetId` (the raw integer)
 * even when no typed name exists; this module is the bridge for the typed
 * names PowerPoint emits across its built-in preset library.
 */
import type { PptxAnimationTrigger, PptxElementAnimation, XmlObject } from '../types';

/**
 * Maps editor animation presets to OOXML preset class + presetID pairs.
 */
export interface OoxmlPresetMapping {
	presetClass: 'entr' | 'exit' | 'emph' | 'path';
	presetId: number;
	/** Default OOXML preset subtype (direction variant). */
	defaultSubtype: number;
}

/**
 * Forward lookup: editor preset name -> OOXML mapping.
 *
 * Existing typed names (e.g. `flyIn`, `fadeIn`, `pulse`) are preserved for
 * compatibility with `PptxAnimationPreset` and existing serialisation
 * tests. Additional canonical PowerPoint preset names are appended so the
 * round-trip can name and re-emit the full library.
 */
export const PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	// ---- Entrance effects (typed `PptxAnimationPreset` names) ----
	appear: { presetClass: 'entr', presetId: 1, defaultSubtype: 0 },
	fadeIn: { presetClass: 'entr', presetId: 10, defaultSubtype: 0 },
	flyIn: { presetClass: 'entr', presetId: 2, defaultSubtype: 4 },
	zoomIn: { presetClass: 'entr', presetId: 23, defaultSubtype: 0 },
	blindsIn: { presetClass: 'entr', presetId: 3, defaultSubtype: 0 },
	boxIn: { presetClass: 'entr', presetId: 4, defaultSubtype: 0 },
	checkerboardIn: { presetClass: 'entr', presetId: 5, defaultSubtype: 0 },
	// entr.6 = Circle, entr.31 = Expand per MS-OI29500 / the catalog. Random Bars
	// is entr.14 and Split is entr.17 (see the entr.17/entr.14 catalog labels).
	expandIn: { presetClass: 'entr', presetId: 31, defaultSubtype: 0 },
	dissolveIn: { presetClass: 'entr', presetId: 9, defaultSubtype: 0 },
	// entr.11/12/16 verified via COM (AddEffect + raw OOXML inspection): Flash
	// Once is entr.11, Peek In is entr.12, Split is entr.16. `flashIn` was a
	// stale pre-existing alias still pointing at the OLD (wrong) IDs; moved to
	// match the corrected `flashOnceIn`/`peekIn`/`splitIn` reverse lookup below.
	flashIn: { presetClass: 'entr', presetId: 11, defaultSubtype: 0 },
	peekIn: { presetClass: 'entr', presetId: 12, defaultSubtype: 0 },
	randomBarsIn: { presetClass: 'entr', presetId: 14, defaultSubtype: 0 },
	wipeIn: { presetClass: 'entr', presetId: 22, defaultSubtype: 0 },
	// entr.26/37 verified via COM: `msoAnimEffectBounce` (PowerPoint's own
	// internal effect id 26) serializes as `presetID="26"`, and
	// `msoAnimEffectRiseUp` (internal id 34) serializes as `presetID="37"`.
	// The two were previously swapped (this table had riseUp on entr.26 and
	// bounceIn on entr.37); the internal MsoAnimEffect id and the OOXML
	// presetID are different numbering spaces and only coincide for some ids.
	riseUp: { presetClass: 'entr', presetId: 37, defaultSubtype: 0 },
	bounceIn: { presetClass: 'entr', presetId: 26, defaultSubtype: 0 },
	floatIn: { presetClass: 'entr', presetId: 42, defaultSubtype: 0 },
	// entr.19 verified via COM: `msoAnimEffectSwivel` serializes as
	// `presetID="19"`, not 47 (the OLD value here). entr.47 is really
	// "Descend" (`msoAnimEffectDescend` -> presetID 47), which collides with
	// the pre-existing `descendIn` (entr.61) below; left unresolved pending a
	// dedicated verification pass, but `swivel` no longer wrongly claims it.
	swivel: { presetClass: 'entr', presetId: 19, defaultSubtype: 0 },
	spinnerIn: { presetClass: 'entr', presetId: 49, defaultSubtype: 0 },
	growTurnIn: { presetClass: 'entr', presetId: 53, defaultSubtype: 0 },
	splitIn: { presetClass: 'entr', presetId: 16, defaultSubtype: 0 },
	wheelIn: { presetClass: 'entr', presetId: 21, defaultSubtype: 1 },

	// ---- Entrance effects (extended catalog) ----
	circleIn: { presetClass: 'entr', presetId: 6, defaultSubtype: 0 },
	diamondIn: { presetClass: 'entr', presetId: 8, defaultSubtype: 0 },
	// entr.11 is Flash Once (verified via COM: a plain visibility flash, no
	// filter). `flashBulbIn` is left in place as a pre-existing alias so
	// nothing that already depends on it breaks, but Flash Bulb is really an
	// EMPHASIS effect (emph.26) and does not belong in the entrance class at
	// all; `flashOnceIn` is the correct typed name for this id.
	flashOnceIn: { presetClass: 'entr', presetId: 11, defaultSubtype: 0 },
	flashBulbIn: { presetClass: 'entr', presetId: 11, defaultSubtype: 0 },
	plusIn: { presetClass: 'entr', presetId: 13, defaultSubtype: 0 },
	spiralIn: { presetClass: 'entr', presetId: 15, defaultSubtype: 0 },
	// entr.17/18 verified via COM: Stretch is entr.17 (a plain grow with no
	// filter) and Strips is entr.18 (`filter="strips(...)"`). `stretchIn` and
	// `stripsIn` previously pointed at 18 and 19 respectively; entr.19 is
	// really Swivel (see `swivel` above), not Strips.
	stretchIn: { presetClass: 'entr', presetId: 17, defaultSubtype: 0 },
	stripsIn: { presetClass: 'entr', presetId: 18, defaultSubtype: 0 },
	wedgeIn: { presetClass: 'entr', presetId: 20, defaultSubtype: 0 },
	randomEffectsIn: { presetClass: 'entr', presetId: 24, defaultSubtype: 0 },
	boomerangIn: { presetClass: 'entr', presetId: 25, defaultSubtype: 0 },
	creditsIn: { presetClass: 'entr', presetId: 27, defaultSubtype: 0 },
	floatUp: { presetClass: 'entr', presetId: 28, defaultSubtype: 0 },
	pinwheelIn: { presetClass: 'entr', presetId: 29, defaultSubtype: 0 },
	spinner2In: { presetClass: 'entr', presetId: 30, defaultSubtype: 0 },
	whipIn: { presetClass: 'entr', presetId: 32, defaultSubtype: 0 },
	arriveIn: { presetClass: 'entr', presetId: 33, defaultSubtype: 0 },
	basicSwivelIn: { presetClass: 'entr', presetId: 34, defaultSubtype: 0 },
	beveledArrivalIn: { presetClass: 'entr', presetId: 35, defaultSubtype: 0 },
	curveUpIn: { presetClass: 'entr', presetId: 36, defaultSubtype: 0 },
	foldIn: { presetClass: 'entr', presetId: 38, defaultSubtype: 0 },
	fadedSwivelIn: { presetClass: 'entr', presetId: 39, defaultSubtype: 0 },
	fadedZoomIn: { presetClass: 'entr', presetId: 40, defaultSubtype: 0 },
	lightSpeedIn: { presetClass: 'entr', presetId: 41, defaultSubtype: 0 },
	flipIn: { presetClass: 'entr', presetId: 43, defaultSubtype: 0 },
	glideIn: { presetClass: 'entr', presetId: 44, defaultSubtype: 0 },
	growRotateIn: { presetClass: 'entr', presetId: 45, defaultSubtype: 0 },
	growWithColorIn: { presetClass: 'entr', presetId: 46, defaultSubtype: 0 },
	magnifyIn: { presetClass: 'entr', presetId: 48, defaultSubtype: 0 },
	slingIn: { presetClass: 'entr', presetId: 50, defaultSubtype: 0 },
	compressIn: { presetClass: 'entr', presetId: 51, defaultSubtype: 0 },
	unfoldIn: { presetClass: 'entr', presetId: 52, defaultSubtype: 0 },
	zoomRotateIn: { presetClass: 'entr', presetId: 54, defaultSubtype: 0 },
	curvyStarIn: { presetClass: 'entr', presetId: 55, defaultSubtype: 0 },
	rotateIn: { presetClass: 'entr', presetId: 56, defaultSubtype: 0 },
	centerRevolveIn: { presetClass: 'entr', presetId: 57, defaultSubtype: 0 },
	threadIn: { presetClass: 'entr', presetId: 58, defaultSubtype: 0 },
	dropIn: { presetClass: 'entr', presetId: 59, defaultSubtype: 0 },
	ascendIn: { presetClass: 'entr', presetId: 60, defaultSubtype: 0 },
	descendIn: { presetClass: 'entr', presetId: 61, defaultSubtype: 0 },
	centerStageIn: { presetClass: 'entr', presetId: 62, defaultSubtype: 0 },
	easeIn: { presetClass: 'entr', presetId: 63, defaultSubtype: 0 },
	stretchyIn: { presetClass: 'entr', presetId: 64, defaultSubtype: 0 },
	zipIn: { presetClass: 'entr', presetId: 65, defaultSubtype: 0 },
	barsIn: { presetClass: 'entr', presetId: 66, defaultSubtype: 0 },
	coverIn: { presetClass: 'entr', presetId: 67, defaultSubtype: 0 },
	revealIn: { presetClass: 'entr', presetId: 68, defaultSubtype: 0 },
	crawlIn: { presetClass: 'entr', presetId: 7, defaultSubtype: 4 },

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
	bounceOut: { presetClass: 'exit', presetId: 37, defaultSubtype: 0 },

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
	plusOut: { presetClass: 'exit', presetId: 13, defaultSubtype: 0 },
	randomBarsOut: { presetClass: 'exit', presetId: 14, defaultSubtype: 0 },
	spiralOut: { presetClass: 'exit', presetId: 15, defaultSubtype: 0 },
	peekOut: { presetClass: 'exit', presetId: 16, defaultSubtype: 0 },
	splitOut: { presetClass: 'exit', presetId: 17, defaultSubtype: 0 },
	collapseOut: { presetClass: 'exit', presetId: 18, defaultSubtype: 0 },
	stripsOut: { presetClass: 'exit', presetId: 19, defaultSubtype: 0 },
	wedgeOut: { presetClass: 'exit', presetId: 20, defaultSubtype: 0 },
	wheelOut: { presetClass: 'exit', presetId: 21, defaultSubtype: 1 },
	randomEffectsOut: { presetClass: 'exit', presetId: 24, defaultSubtype: 0 },
	boomerangOut: { presetClass: 'exit', presetId: 25, defaultSubtype: 0 },
	sinkDown: { presetClass: 'exit', presetId: 26, defaultSubtype: 0 },
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

	// ---- Emphasis effects (typed `PptxAnimationPreset` names) ----
	// emph.1/2/10/16 verified via COM. `msoAnimEffectBoldFlash` (PowerPoint's
	// internal effect) serializes as presetID 10 (targets `style.fontWeight`),
	// not 1; `msoAnimEffectChangeFillColor` is the real emph.1 (a `p:animClr`
	// targeting fill, see `changeFillColor` below). `msoAnimEffectChangeFont`
	// (a font-family swap, `style.fontFamily`, no color animation) is the real
	// emph.2, not Color Wave; `msoAnimEffectColorWave` is really emph.20 and
	// `msoAnimEffectWave` is really emph.34 - `wave` and `colorWave` were
	// previously aliased to the same (wrong) id 2, but are two distinct real
	// effects and are now split accordingly. `msoAnimEffectBrushOnColor` is
	// the real emph.16 (see `brushOnColor` below), not Wave.
	boldFlash: { presetClass: 'emph', presetId: 10, defaultSubtype: 0 },
	wave: { presetClass: 'emph', presetId: 34, defaultSubtype: 0 },
	colorWave: { presetClass: 'emph', presetId: 20, defaultSubtype: 0 },
	changeFillColor: { presetClass: 'emph', presetId: 1, defaultSubtype: 0 },
	growShrink: { presetClass: 'emph', presetId: 6, defaultSubtype: 0 },
	spin: { presetClass: 'emph', presetId: 8, defaultSubtype: 0 },
	transparency: { presetClass: 'emph', presetId: 9, defaultSubtype: 0 },
	teeter: { presetClass: 'emph', presetId: 14, defaultSubtype: 0 },
	pulse: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	bounce: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	flash: { presetClass: 'emph', presetId: 10, defaultSubtype: 0 },

	// ---- Emphasis effects (extended catalog) ----
	// emph.3/4/5/7 are verified via COM to really be Change Font Color, Change
	// Font Size, Change Font Style and Change Line Color respectively (see the
	// matching catalog labels), not Brush on Color, Brush on Underline, Change
	// Font, and Change Font Color. `changeFont` (real emph.2) and
	// `changeFontColor` (real emph.3) have been corrected below; `changeFont`
	// no longer collides with `changeFontColor`/`changeLineColor` at 7.
	// `brushOnColor` (real emph.16) and `brushOnUnderline` (real emph.18) are
	// corrected to match `getNativeAnimationPresetMetadata`'s corrected labels.
	brushOnColor: { presetClass: 'emph', presetId: 16, defaultSubtype: 0 },
	brushOnUnderline: { presetClass: 'emph', presetId: 18, defaultSubtype: 0 },
	changeFont: { presetClass: 'emph', presetId: 2, defaultSubtype: 0 },
	changeFontColor: { presetClass: 'emph', presetId: 3, defaultSubtype: 0 },
	changeLineColor: { presetClass: 'emph', presetId: 7, defaultSubtype: 0 },
	changeFontSize: { presetClass: 'emph', presetId: 4, defaultSubtype: 0 },
	changeFontStyle: { presetClass: 'emph', presetId: 11, defaultSubtype: 0 },
	growWithColor: { presetClass: 'emph', presetId: 12, defaultSubtype: 0 },
	desaturate: { presetClass: 'emph', presetId: 13, defaultSubtype: 0 },
	verticalHighlight: { presetClass: 'emph', presetId: 15, defaultSubtype: 0 },
	// `wave2` had no real basis (there is no distinct "Wave 2" MsoAnimEffect)
	// and collided with the now-corrected `brushOnColor` at emph.16; removed
	// rather than guessed at an unverified id. It was never referenced outside
	// this file (not a wired-up editor feature), so removal is safe.
	blast: { presetClass: 'emph', presetId: 17, defaultSubtype: 0 },
	// `boldReveal` (real emph.15, see COM note above) and `shimmer` (real
	// emph.36) previously collided with the now-corrected `brushOnUnderline`
	// (18) and `colorWave` (20). Like `wave2`, neither is referenced outside
	// this file, so both are removed here rather than relocated onto ids
	// (15, 36) already claimed by `verticalHighlight`/`waveVariant`, which
	// would only cascade the collision further without new COM verification.
	washOut: { presetClass: 'emph', presetId: 19, defaultSubtype: 0 },
	flicker: { presetClass: 'emph', presetId: 21, defaultSubtype: 0 },
	growWithColorSustain: { presetClass: 'emph', presetId: 22, defaultSubtype: 0 },
	lighten: { presetClass: 'emph', presetId: 23, defaultSubtype: 0 },
	darken: { presetClass: 'emph', presetId: 24, defaultSubtype: 0 },
	styleEmphasis: { presetClass: 'emph', presetId: 25, defaultSubtype: 0 },
	colorPulse: { presetClass: 'emph', presetId: 27, defaultSubtype: 0 },
	colorBlend: { presetClass: 'emph', presetId: 28, defaultSubtype: 0 },
	complementaryColor: { presetClass: 'emph', presetId: 29, defaultSubtype: 0 },
	complementaryColor2: { presetClass: 'emph', presetId: 30, defaultSubtype: 0 },
	contrastingColor: { presetClass: 'emph', presetId: 31, defaultSubtype: 0 },
	pulseOnce: { presetClass: 'emph', presetId: 32, defaultSubtype: 0 },
	underlineEmph: { presetClass: 'emph', presetId: 33, defaultSubtype: 0 },
	boldFlashVariant: { presetClass: 'emph', presetId: 34, defaultSubtype: 0 },
	teeterVariant: { presetClass: 'emph', presetId: 35, defaultSubtype: 0 },
	waveVariant: { presetClass: 'emph', presetId: 36, defaultSubtype: 0 },
	objectColor: { presetClass: 'emph', presetId: 37, defaultSubtype: 0 },
	fillColor: { presetClass: 'emph', presetId: 38, defaultSubtype: 0 },
	lineColor: { presetClass: 'emph', presetId: 39, defaultSubtype: 0 },
	brushOnColorSustain: { presetClass: 'emph', presetId: 40, defaultSubtype: 0 },
	colorWaveSustain: { presetClass: 'emph', presetId: 41, defaultSubtype: 0 },
	flashEmph: { presetClass: 'emph', presetId: 42, defaultSubtype: 0 },
	flickerSlow: { presetClass: 'emph', presetId: 43, defaultSubtype: 0 },
	growBig: { presetClass: 'emph', presetId: 44, defaultSubtype: 0 },
	shrinkSmall: { presetClass: 'emph', presetId: 45, defaultSubtype: 0 },
	colorLighten: { presetClass: 'emph', presetId: 46, defaultSubtype: 0 },
	colorDarken: { presetClass: 'emph', presetId: 47, defaultSubtype: 0 },
	boldItalics: { presetClass: 'emph', presetId: 48, defaultSubtype: 0 },
	spinSlow: { presetClass: 'emph', presetId: 49, defaultSubtype: 0 },
	spinFast: { presetClass: 'emph', presetId: 50, defaultSubtype: 0 },
	wobble: { presetClass: 'emph', presetId: 51, defaultSubtype: 0 },
	jiggle: { presetClass: 'emph', presetId: 52, defaultSubtype: 0 },
	bounceInPlace: { presetClass: 'emph', presetId: 53, defaultSubtype: 0 },
	heartbeat: { presetClass: 'emph', presetId: 54, defaultSubtype: 0 },
	glow: { presetClass: 'emph', presetId: 55, defaultSubtype: 0 },
	brighten: { presetClass: 'emph', presetId: 56, defaultSubtype: 0 },
	dim: { presetClass: 'emph', presetId: 57, defaultSubtype: 0 },
	saturate: { presetClass: 'emph', presetId: 58, defaultSubtype: 0 },
	colorCycle: { presetClass: 'emph', presetId: 59, defaultSubtype: 0 },
	rainbow: { presetClass: 'emph', presetId: 60, defaultSubtype: 0 },
	shake: { presetClass: 'emph', presetId: 61, defaultSubtype: 0 },
	vibrate: { presetClass: 'emph', presetId: 62, defaultSubtype: 0 },
	sway: { presetClass: 'emph', presetId: 63, defaultSubtype: 0 },
	bob: { presetClass: 'emph', presetId: 64, defaultSubtype: 0 },
};

/**
 * Reverse lookup helpers — for a parsed `(presetClass, presetID)` pair,
 * resolve back to the canonical preset name (the value in
 * `PRESET_TO_OOXML`). For aliased ids (e.g. emph 26 = pulse | bounce, and
 * emph 10 = boldFlash | flash, entr 6 = expandIn | circleIn), the table
 * below records the canonical typed name so parsing is deterministic.
 */
function buildReverseLookup(
	presetClass: 'entr' | 'exit' | 'emph',
	canonical: ReadonlyArray<[number, string]>,
): Record<number, string> {
	const out: Record<number, string> = {};
	// Seed canonical aliases.
	for (const [id, name] of canonical) {
		out[id] = name;
	}
	// Fill in remaining IDs from PRESET_TO_OOXML for entries this class owns
	// that the canonical override didn't already place.
	for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
		if (mapping.presetClass !== presetClass) {
			continue;
		}
		if (out[mapping.presetId] === undefined) {
			out[mapping.presetId] = name;
		}
	}
	return out;
}

const ENTR_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'appear'],
	[2, 'flyIn'],
	[3, 'blindsIn'],
	[4, 'boxIn'],
	[5, 'checkerboardIn'],
	[6, 'circleIn'], // entr.6 = Circle (MS-OI29500 / catalog)
	[7, 'crawlIn'], // entr.7 = Crawl In
	[8, 'diamondIn'],
	[9, 'dissolveIn'],
	[10, 'fadeIn'],
	// entr.11/12/16/17 verified directly against retail PowerPoint via COM
	// automation (AddEffect + raw OOXML inspection): entr.11 is Flash Once (a
	// plain visibility flash, no filter), entr.12 is Peek In
	// (`filter="wipe(up)"`), entr.16 is Split (`filter="barn(inVertical)"`)
	// and entr.17 is Stretch (a plain `ppt_w`/`ppt_h` grow, no filter). The
	// forward map (`PRESET_TO_OOXML`) now also resolves `flashBulbIn`/
	// `flashIn`/`peekIn`/`splitIn`/`stretchIn` to these corrected preset IDs,
	// matching the shared playback table in
	// `pptx-viewer-shared/render/animation-presets.ts`.
	[11, 'flashOnceIn'],
	[12, 'peekIn'],
	[13, 'plusIn'],
	[14, 'randomBarsIn'],
	[15, 'spiralIn'],
	[16, 'splitIn'],
	[17, 'stretchIn'],
	// entr.18/19 verified via COM: Strips is entr.18 (`filter="strips(...)"`)
	// and Swivel is entr.19, not the other way around as this table
	// previously had it.
	[18, 'stripsIn'],
	[19, 'swivel'],
	[20, 'wedgeIn'],
	[21, 'wheelIn'],
	[22, 'wipeIn'],
	[23, 'zoomIn'],
	// entr.26/37 verified via COM: Bounce is entr.26 and Rise Up is entr.37
	// (previously swapped in this table). See the matching note on
	// `PRESET_TO_OOXML.riseUp`/`bounceIn` above.
	[26, 'bounceIn'],
	// entr.31 = Expand -> `expandIn`; the auto-fill resolves id 31 without an
	// override since only `expandIn` maps to it.
	[37, 'riseUp'],
	[42, 'floatIn'],
	// entr.47's old override here ('swivel') was wrong; Swivel is really
	// entr.19 (see above). entr.47 is really "Descend" per COM, which
	// collides with the pre-existing `descendIn` (entr.61); left as an
	// unresolved, flagged finding rather than guessed, so no override is
	// given for 47 here (falls through to unmapped/undefined, preserving
	// round-trip via the raw presetId).
	[49, 'spinnerIn'],
	[53, 'growTurnIn'],
];

const EXIT_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'disappear'],
	[2, 'flyOut'],
	// exit.6 verified via COM: `msoAnimEffectCircle` with `Effect.Exit = True`
	// serializes as presetID 6 with `filter="circle(in)"`, i.e. exit.6 is
	// Circle, not Shrink. `circleOut` is the canonical typed name; `shrinkOut`
	// remains a known, unresolved collision on the same forward-map id (see
	// the note on `PRESET_TO_OOXML.shrinkOut` above).
	[6, 'circleOut'],
	[9, 'dissolveOut'],
	[10, 'fadeOut'],
	// exit.11 verified via COM: Flash Once (not Flash Bulb, which cannot be
	// an exit effect at all). `flashOnceOut` is preferred as canonical over
	// the pre-existing `flashBulbOut` alias, mirroring `flashOnceIn` on the
	// entrance side.
	[11, 'flashOnceOut'],
	[22, 'wipeOut'],
	[23, 'zoomOut'],
	[37, 'bounceOut'],
];

const EMPH_CANONICAL: ReadonlyArray<[number, string]> = [
	// emph.1/2/10/16 verified via COM (see the matching note on
	// `PRESET_TO_OOXML` above): emph.1 is Change Fill Color (not Bold Flash),
	// emph.2 is Change Font (not Color Wave), emph.10 is Bold Flash (alias of
	// `flash`, not Change Font Size), and emph.16 is Brush on Color (not
	// Wave).
	[1, 'changeFillColor'],
	[2, 'changeFont'],
	// emph.3/4/5/7 verified via COM: emph.3 targets `style.color` (Change Font
	// Color), emph.4 targets `style.fontSize` (Change Font Size), emph.5
	// targets `style.fontStyle`/`style.fontWeight` (Change Font Style), and
	// emph.7 targets `stroke.color` (Change Line Color). The forward map
	// (`PRESET_TO_OOXML`) now also resolves `brushOnColor`/`brushOnUnderline`/
	// `changeFont`/`changeFontColor` to these corrected preset IDs.
	[3, 'changeFontColor'],
	[4, 'changeFontSize'],
	[5, 'changeFontStyle'],
	[6, 'growShrink'],
	[7, 'changeLineColor'],
	[8, 'spin'],
	[9, 'transparency'],
	[10, 'boldFlash'], // alias of flash; `boldFlash` is canonical
	[14, 'teeter'],
	[16, 'brushOnColor'],
	[26, 'pulse'], // alias of bounce; `pulse` is canonical
];

export const OOXML_TO_PRESET_ENTR: Record<number, string> = buildReverseLookup(
	'entr',
	ENTR_CANONICAL,
);
export const OOXML_TO_PRESET_EXIT: Record<number, string> = buildReverseLookup(
	'exit',
	EXIT_CANONICAL,
);
export const OOXML_TO_PRESET_EMPH: Record<number, string> = buildReverseLookup(
	'emph',
	EMPH_CANONICAL,
);

/**
 * Reverse lookup: resolve a parsed `(presetClass, presetID)` pair to the
 * canonical typed preset name (the key of `PRESET_TO_OOXML`).
 *
 * @returns the typed preset name, or `undefined` if the combination is
 *   unknown. Path-class presets always return `undefined` because their
 *   integer IDs are not standardised; round-trip is preserved via the
 *   raw `presetID` and `motionPath` SVG string instead.
 */
export function ooxmlToPresetName(args: {
	presetClass: 'entr' | 'exit' | 'emph' | 'path';
	presetId: number;
}): string | undefined {
	switch (args.presetClass) {
		case 'entr':
			return OOXML_TO_PRESET_ENTR[args.presetId];
		case 'exit':
			return OOXML_TO_PRESET_EXIT[args.presetId];
		case 'emph':
			return OOXML_TO_PRESET_EMPH[args.presetId];
		case 'path':
			return undefined;
	}
}

/**
 * Maps editor direction values to OOXML presetSubtype values for fly effects.
 */
export const DIRECTION_TO_SUBTYPE: Record<string, number> = {
	fromBottom: 4,
	fromLeft: 8,
	fromRight: 2,
	fromTop: 1,
	fromTopLeft: 9,
	fromTopRight: 3,
	fromBottomLeft: 12,
	fromBottomRight: 6,
};

/**
 * Maps editor trigger names to OOXML nodeType attribute values.
 */
export function triggerToNodeType(trigger: PptxAnimationTrigger): string {
	switch (trigger) {
		case 'afterPrevious':
			return 'afterEffect';
		case 'withPrevious':
			return 'withEffect';
		case 'afterDelay':
			return 'afterEffect';
		case 'onHover':
			return 'mouseOver';
		case 'onShapeClick':
			return 'clickEffect';
		case 'onClick':
		default:
			return 'clickEffect';
	}
}

/**
 * Maps editor timing curve to OOXML animation formula filter values.
 */
export function timingCurveToAccelDecel(curve: string | undefined): {
	accel: number;
	decel: number;
} {
	switch (curve) {
		case 'ease-in':
			return { accel: 100000, decel: 0 };
		case 'ease-out':
			return { accel: 0, decel: 100000 };
		case 'ease':
			return { accel: 50000, decel: 50000 };
		case 'linear':
		default:
			return { accel: 0, decel: 0 };
	}
}

export interface IPptxAnimationWriteService {
	buildTimingXml(
		animations: PptxElementAnimation[],
		existingRawTiming: XmlObject | undefined,
	): XmlObject | undefined;
}
