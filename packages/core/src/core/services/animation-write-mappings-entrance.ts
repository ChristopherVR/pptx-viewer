/**
 * ENTRANCE half of the OOXML animation preset mappings. Split out of
 * `animation-write-mappings.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for how `PRESET_TO_OOXML` /
 * `OOXML_TO_PRESET_ENTR` are composed from this.
 *
 * @module services/animation-write-mappings-entrance
 */
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

/** Forward lookup: entrance preset name -> OOXML mapping. */
export const ENTR_PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
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
};

/**
 * Canonical typed name per entrance presetID, for the reverse lookup. Ids
 * with more than one forward-map alias are seeded here explicitly.
 */
export const ENTR_CANONICAL: ReadonlyArray<[number, string]> = [
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
	// forward map (`ENTR_PRESET_TO_OOXML`) now also resolves `flashBulbIn`/
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
	// `ENTR_PRESET_TO_OOXML.riseUp`/`bounceIn` above.
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
