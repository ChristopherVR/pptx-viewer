/**
 * ENTRANCE half of the OOXML animation preset mappings. Split out of
 * `animation-write-mappings.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for how `PRESET_TO_OOXML` /
 * `OOXML_TO_PRESET_ENTR` are composed from this.
 *
 * Every id and default subtype here is COM ground truth: each
 * `MsoAnimEffect` was added through `MainSequence.AddEffect` and the saved
 * `p:cTn/@presetID` / `@presetSubtype` read back (see
 * `utils/animation-preset-catalog-entr-exit.ts` for the method and the full
 * id list). The object-model enum and the OOXML presetID diverge from id 32
 * up (`msoAnimEffectLightSpeed` = 32 saves presetID 34), which is why several
 * typed names used to point one or more ids too low. Ids 32, 33, 36, 44, 46,
 * 57 and 59..68 are not presets, so no typed name maps to them.
 *
 * @module services/animation-write-mappings-entrance
 */
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

function entr(presetId: number, defaultSubtype: number = 0): OoxmlPresetMapping {
	return { presetClass: 'entr', presetId, defaultSubtype };
}

/** Forward lookup: entrance preset name -> OOXML mapping. */
export const ENTR_PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	// ---- Typed `PptxAnimationPreset` names ----
	appear: entr(1),
	flyIn: entr(2, 4),
	blindsIn: entr(3, 10),
	boxIn: entr(4, 16),
	checkerboardIn: entr(5, 10),
	dissolveIn: entr(9),
	fadeIn: entr(10),
	flashIn: entr(11),
	peekIn: entr(12, 4),
	randomBarsIn: entr(14, 10),
	splitIn: entr(16, 21),
	swivel: entr(19, 10),
	wheelIn: entr(21, 1),
	wipeIn: entr(22, 4),
	zoomIn: entr(23, 16),
	bounceIn: entr(26),
	floatIn: entr(30),
	growTurnIn: entr(31),
	riseUp: entr(37),
	spinnerIn: entr(49),
	expandIn: entr(55),

	// ---- Extended catalogue names ----
	circleIn: entr(6, 16),
	crawlIn: entr(7, 4),
	diamondIn: entr(8, 16),
	flashOnceIn: entr(11),
	// Flash Bulb is an emphasis effect; kept as a compat alias of Flash Once.
	flashBulbIn: entr(11),
	plusIn: entr(13, 16),
	spiralIn: entr(15),
	stretchIn: entr(17, 10),
	stripsIn: entr(18, 12),
	basicSwivelIn: entr(19, 10),
	wedgeIn: entr(20),
	randomEffectsIn: entr(24),
	boomerangIn: entr(25),
	colorTypewriterIn: entr(27),
	creditsIn: entr(28),
	easeIn: entr(29),
	lightSpeedIn: entr(34),
	pinwheelIn: entr(35),
	swishIn: entr(38),
	thinLineIn: entr(39),
	unfoldIn: entr(40),
	whipIn: entr(41),
	ascendIn: entr(42),
	// "Float Up" is PowerPoint's gallery name for Ascend.
	floatUp: entr(42),
	centerRevolveIn: entr(43),
	fadedSwivelIn: entr(45),
	descendIn: entr(47),
	slingIn: entr(48),
	compressIn: entr(50),
	stretchyIn: entr(50),
	zipIn: entr(51),
	arcUpIn: entr(52),
	curveUpIn: entr(52),
	fadedZoomIn: entr(53, 16),
	glideIn: entr(54),
	flipIn: entr(56),
	foldIn: entr(58),
};

/**
 * Canonical typed name per entrance presetID, for the reverse lookup. Ids
 * with more than one forward-map alias are seeded here explicitly.
 */
export const ENTR_CANONICAL: ReadonlyArray<[number, string]> = [
	[11, 'flashOnceIn'],
	[19, 'swivel'],
	[42, 'ascendIn'],
	[50, 'compressIn'],
	[52, 'arcUpIn'],
];
