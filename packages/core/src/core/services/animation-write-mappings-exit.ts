/**
 * EXIT half of the OOXML animation preset mappings. Split out of
 * `animation-write-mappings.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for how `PRESET_TO_OOXML` /
 * `OOXML_TO_PRESET_EXIT` are composed from this.
 *
 * COM ground truth (`AddEffect` + `Effect.Exit = True`, saved XML read
 * back): every exit form reuses the SAME presetID as its entrance form, so
 * this table mirrors `animation-write-mappings-entrance.ts` id for id. Names
 * follow PowerPoint's exit gallery where the exit form has its own name
 * (Disappear, Collapse, Sink Down, Contract, Shrink & Turn, Stretchy).
 *
 * @module services/animation-write-mappings-exit
 */
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

function exit(presetId: number, defaultSubtype: number = 0): OoxmlPresetMapping {
	return { presetClass: 'exit', presetId, defaultSubtype };
}

/** Forward lookup: exit preset name -> OOXML mapping. */
export const EXIT_PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	// ---- Typed `PptxAnimationPreset` names ----
	disappear: exit(1),
	flyOut: exit(2, 4),
	dissolveOut: exit(9),
	fadeOut: exit(10),
	wipeOut: exit(22, 4),
	zoomOut: exit(23, 16),
	bounceOut: exit(26),
	// "Shrink" has no preset of its own; Contract (exit.55) is PowerPoint's
	// scale-down-to-nothing exit, which is what the editor's Shrink means.
	shrinkOut: exit(55),

	// ---- Extended catalogue names ----
	blindsOut: exit(3, 10),
	boxOut: exit(4, 16),
	checkerboardOut: exit(5, 10),
	circleOut: exit(6, 16),
	crawlOut: exit(7, 4),
	diamondOut: exit(8, 16),
	flashOnceOut: exit(11),
	flashBulbOut: exit(11),
	peekOut: exit(12, 4),
	peekOutDown: exit(12, 4),
	plusOut: exit(13, 16),
	randomBarsOut: exit(14, 10),
	spiralOut: exit(15),
	splitOut: exit(16, 21),
	collapseOut: exit(17, 10),
	stripsOut: exit(18, 12),
	swivelOut: exit(19, 10),
	basicSwivelOut: exit(19, 10),
	wedgeOut: exit(20),
	wheelOut: exit(21, 1),
	randomEffectsOut: exit(24),
	boomerangOut: exit(25),
	colorTypewriterOut: exit(27),
	creditsOut: exit(28),
	easeOut: exit(29),
	floatOut: exit(30),
	shrinkTurn: exit(31),
	growTurnOut: exit(31),
	lightSpeedOut: exit(34),
	pinwheelOut: exit(35),
	sinkDown: exit(37),
	swishOut: exit(38),
	thinLineOut: exit(39),
	unfoldOut: exit(40),
	whipOut: exit(41),
	ascendOut: exit(42),
	centerRevolveOut: exit(43),
	fadedSwivelOut: exit(45),
	descendOut: exit(47),
	// "Float Down" is PowerPoint's gallery name for Descend.
	floatDown: exit(47),
	slingOut: exit(48),
	spinnerOut: exit(49),
	stretchyOut: exit(50),
	zipOut: exit(51),
	arcUpOut: exit(52),
	curveDownOut: exit(52),
	fadedZoomOut: exit(53, 32),
	glideOut: exit(54),
	contractOut: exit(55),
	flipOut: exit(56),
	foldOut: exit(58),
};

/**
 * Canonical typed name per exit presetID, for the reverse lookup. Ids with
 * more than one forward-map alias are seeded here explicitly.
 */
export const EXIT_CANONICAL: ReadonlyArray<[number, string]> = [
	[11, 'flashOnceOut'],
	[12, 'peekOut'],
	[19, 'swivelOut'],
	[31, 'shrinkTurn'],
	[47, 'descendOut'],
	[52, 'arcUpOut'],
	[55, 'contractOut'],
];
