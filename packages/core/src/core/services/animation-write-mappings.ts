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
	flashIn: { presetClass: 'entr', presetId: 12, defaultSubtype: 0 },
	peekIn: { presetClass: 'entr', presetId: 16, defaultSubtype: 0 },
	randomBarsIn: { presetClass: 'entr', presetId: 14, defaultSubtype: 0 },
	wipeIn: { presetClass: 'entr', presetId: 22, defaultSubtype: 0 },
	riseUp: { presetClass: 'entr', presetId: 26, defaultSubtype: 0 },
	bounceIn: { presetClass: 'entr', presetId: 37, defaultSubtype: 0 },
	floatIn: { presetClass: 'entr', presetId: 42, defaultSubtype: 0 },
	swivel: { presetClass: 'entr', presetId: 47, defaultSubtype: 0 },
	spinnerIn: { presetClass: 'entr', presetId: 49, defaultSubtype: 0 },
	growTurnIn: { presetClass: 'entr', presetId: 53, defaultSubtype: 0 },
	splitIn: { presetClass: 'entr', presetId: 17, defaultSubtype: 0 },
	wheelIn: { presetClass: 'entr', presetId: 21, defaultSubtype: 1 },

	// ---- Entrance effects (extended catalog) ----
	circleIn: { presetClass: 'entr', presetId: 6, defaultSubtype: 0 },
	diamondIn: { presetClass: 'entr', presetId: 8, defaultSubtype: 0 },
	flashBulbIn: { presetClass: 'entr', presetId: 11, defaultSubtype: 0 },
	plusIn: { presetClass: 'entr', presetId: 13, defaultSubtype: 0 },
	spiralIn: { presetClass: 'entr', presetId: 15, defaultSubtype: 0 },
	stretchIn: { presetClass: 'entr', presetId: 18, defaultSubtype: 0 },
	stripsIn: { presetClass: 'entr', presetId: 19, defaultSubtype: 0 },
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
	flashBulbOut: { presetClass: 'exit', presetId: 11, defaultSubtype: 0 },
	flashOnceOut: { presetClass: 'exit', presetId: 12, defaultSubtype: 0 },
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
	boldFlash: { presetClass: 'emph', presetId: 1, defaultSubtype: 0 },
	wave: { presetClass: 'emph', presetId: 2, defaultSubtype: 0 },
	colorWave: { presetClass: 'emph', presetId: 2, defaultSubtype: 0 },
	growShrink: { presetClass: 'emph', presetId: 6, defaultSubtype: 0 },
	spin: { presetClass: 'emph', presetId: 8, defaultSubtype: 0 },
	transparency: { presetClass: 'emph', presetId: 9, defaultSubtype: 0 },
	teeter: { presetClass: 'emph', presetId: 14, defaultSubtype: 0 },
	pulse: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	bounce: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	flash: { presetClass: 'emph', presetId: 1, defaultSubtype: 0 },

	// ---- Emphasis effects (extended catalog) ----
	brushOnColor: { presetClass: 'emph', presetId: 3, defaultSubtype: 0 },
	brushOnUnderline: { presetClass: 'emph', presetId: 4, defaultSubtype: 0 },
	changeFont: { presetClass: 'emph', presetId: 5, defaultSubtype: 0 },
	changeFontColor: { presetClass: 'emph', presetId: 7, defaultSubtype: 0 },
	changeFontSize: { presetClass: 'emph', presetId: 10, defaultSubtype: 0 },
	changeFontStyle: { presetClass: 'emph', presetId: 11, defaultSubtype: 0 },
	growWithColor: { presetClass: 'emph', presetId: 12, defaultSubtype: 0 },
	desaturate: { presetClass: 'emph', presetId: 13, defaultSubtype: 0 },
	verticalHighlight: { presetClass: 'emph', presetId: 15, defaultSubtype: 0 },
	wave2: { presetClass: 'emph', presetId: 16, defaultSubtype: 0 },
	blast: { presetClass: 'emph', presetId: 17, defaultSubtype: 0 },
	boldReveal: { presetClass: 'emph', presetId: 18, defaultSubtype: 0 },
	washOut: { presetClass: 'emph', presetId: 19, defaultSubtype: 0 },
	shimmer: { presetClass: 'emph', presetId: 20, defaultSubtype: 0 },
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
 * emph 1 = boldFlash | flash, entr 6 = expandIn | circleIn), the table
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
	[11, 'flashBulbIn'],
	[12, 'flashIn'],
	[13, 'plusIn'],
	// entr.14 = Random Bars, entr.17 = Split per MS-OI29500 / the catalog. Both
	// the forward map (PRESET_TO_OOXML) and this reverse lookup agree so the
	// renderer, writer, and catalog are spec-consistent.
	[14, 'randomBarsIn'],
	[15, 'spiralIn'],
	[16, 'peekIn'],
	[17, 'splitIn'],
	[18, 'stretchIn'],
	[19, 'stripsIn'],
	[20, 'wedgeIn'],
	[21, 'wheelIn'],
	[22, 'wipeIn'],
	[23, 'zoomIn'],
	[26, 'riseUp'],
	// entr.31 = Expand -> `expandIn`; the auto-fill resolves id 31 without an
	// override since only `expandIn` maps to it.
	[37, 'bounceIn'],
	[42, 'floatIn'],
	[47, 'swivel'],
	[49, 'spinnerIn'],
	[53, 'growTurnIn'],
];

const EXIT_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'disappear'],
	[2, 'flyOut'],
	[6, 'shrinkOut'],
	[9, 'dissolveOut'],
	[10, 'fadeOut'],
	[22, 'wipeOut'],
	[23, 'zoomOut'],
	[37, 'bounceOut'],
];

const EMPH_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'boldFlash'], // alias of flash — `boldFlash` is canonical
	[2, 'colorWave'], // alias of wave — `colorWave` is canonical
	[6, 'growShrink'],
	[8, 'spin'],
	[9, 'transparency'],
	[14, 'teeter'],
	[26, 'pulse'], // alias of bounce — `pulse` is canonical
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
