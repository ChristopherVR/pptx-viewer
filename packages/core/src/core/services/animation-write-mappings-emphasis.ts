/**
 * EMPHASIS half of the OOXML animation preset mappings. Split out of
 * `animation-write-mappings.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for how `PRESET_TO_OOXML` /
 * `OOXML_TO_PRESET_EMPH` are composed from this.
 *
 * @module services/animation-write-mappings-emphasis
 */
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

/**
 * Forward lookup: emphasis preset name -> OOXML mapping.
 *
 * FULL GROUND TRUTH (2026-09-05): every id below was directly observed via
 * TWO independent COM/UI-Automation methods (see `pptx-viewer-shared`'s
 * `animation-emphasis-ground-truth.ts` for the raw per-id XML this table
 * summarises): (1) `MainSequence.AddEffect` with a named `MsoAnimEffect`
 * constant (Change Fill Color..Wave, the 54-82 range), and (2) UI Automation
 * invoking the literal ribbon / "Add Emphasis Effect" dialog item by its
 * displayed name, which was required for the five ribbon-only names (Pulse,
 * Color Pulse, Object Color, Blink, Shimmer) that have no `MsoAnimEffect`
 * constant at all. All 26 items in the "Add Emphasis Effect" dialog's
 * Basic/3D/Subtle/Moderate/Exciting groups were enumerated and every one
 * resolves to a row here; ids 11/12/13/17/29/37/38/39 correspond to NO named
 * effect anywhere in PowerPoint's UI or object model and are correctly
 * absent, not guessed.
 *
 * The previous version of this table filled ids 11-64 by sequentially
 * guessing a name per id with NO verification at all (the file's own history
 * called this out as unverified); every one of those guesses disagreed with
 * the ground truth above and has been removed rather than perpetuated. The
 * real catalogue tops out at id 41 (two unnamed "3D" dialog items with no
 * representable 2D animation); there is no id 42-64.
 *
 * THE KNOWN "emph.26: Pulse or Flash Bulb?" QUESTION IS RESOLVED: emph.26 IS
 * Pulse, and there is no separate "Pulse id" to find, because Pulse and
 * Flash Bulb are the SAME preset under two different PowerPoint-history
 * names. `msoAnimEffectFlashBulb` (method 1) and clicking the ribbon's
 * literal "Pulse" gallery item (method 2) produced byte-identical timing XML
 * (`presetID="26" presetClass="emph"`, a `filter="fade"` flash curve plus a
 * 105%/105% `autoRev` `animScale`). `pulse` below was already correct;
 * nothing was swapped. `flashBulb` is added as an explicit alias so a
 * round-tripped deck that happens to carry that name resolves to the same
 * id. (The pre-existing `bounce` alias at emph.26 is a DIFFERENT, unverified
 * claim: PowerPoint's Emphasis gallery has no "Bounce" entry at all - Bounce
 * only exists as an Entrance/Exit effect, confirmed by the same UI-Automation
 * gallery enumeration - so choosing "Bounce" as an emphasis and saving
 * produces XML indistinguishable from Pulse. Left in place rather than
 * removed, to avoid changing what the ribbon's existing "Bounce" emphasis
 * choice serializes to without also fixing the ribbon (out of this file's
 * scope); flagged as a "needs:" item for whichever pass owns the ribbon's
 * emphasis preset list.) Similarly `flicker` and `colorPulse` below are the
 * SAME preset (emph.27, Flicker/Color Pulse), the same one-preset-two-names
 * pattern as id 26.
 */
export const EMPH_PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	changeFillColor: { presetClass: 'emph', presetId: 1, defaultSubtype: 0 },
	fillColor: { presetClass: 'emph', presetId: 1, defaultSubtype: 0 },
	changeFont: { presetClass: 'emph', presetId: 2, defaultSubtype: 0 },
	changeFontColor: { presetClass: 'emph', presetId: 3, defaultSubtype: 0 },
	fontColor: { presetClass: 'emph', presetId: 3, defaultSubtype: 0 },
	changeFontSize: { presetClass: 'emph', presetId: 4, defaultSubtype: 0 },
	changeFontStyle: { presetClass: 'emph', presetId: 5, defaultSubtype: 0 },
	growShrink: { presetClass: 'emph', presetId: 6, defaultSubtype: 0 },
	changeLineColor: { presetClass: 'emph', presetId: 7, defaultSubtype: 0 },
	lineColor: { presetClass: 'emph', presetId: 7, defaultSubtype: 0 },
	spin: { presetClass: 'emph', presetId: 8, defaultSubtype: 0 },
	transparency: { presetClass: 'emph', presetId: 9, defaultSubtype: 0 },
	boldFlash: { presetClass: 'emph', presetId: 10, defaultSubtype: 0 },
	flash: { presetClass: 'emph', presetId: 10, defaultSubtype: 0 },
	blast: { presetClass: 'emph', presetId: 14, defaultSubtype: 0 },
	boldReveal: { presetClass: 'emph', presetId: 15, defaultSubtype: 0 },
	brushOnColor: { presetClass: 'emph', presetId: 16, defaultSubtype: 0 },
	brushColor: { presetClass: 'emph', presetId: 16, defaultSubtype: 0 },
	brushOnUnderline: { presetClass: 'emph', presetId: 18, defaultSubtype: 0 },
	underline: { presetClass: 'emph', presetId: 18, defaultSubtype: 0 },
	colorBlend: { presetClass: 'emph', presetId: 19, defaultSubtype: 0 },
	objectColor: { presetClass: 'emph', presetId: 19, defaultSubtype: 0 },
	colorWave: { presetClass: 'emph', presetId: 20, defaultSubtype: 0 },
	complementaryColor: { presetClass: 'emph', presetId: 21, defaultSubtype: 0 },
	complementaryColor2: { presetClass: 'emph', presetId: 22, defaultSubtype: 0 },
	contrastingColor: { presetClass: 'emph', presetId: 23, defaultSubtype: 0 },
	darken: { presetClass: 'emph', presetId: 24, defaultSubtype: 0 },
	desaturate: { presetClass: 'emph', presetId: 25, defaultSubtype: 0 },
	pulse: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	flashBulb: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	// See the module doc above: PowerPoint has no real "Bounce" emphasis
	// effect; kept as a pre-existing, unverified alias of Pulse rather than
	// removed.
	bounce: { presetClass: 'emph', presetId: 26, defaultSubtype: 0 },
	flicker: { presetClass: 'emph', presetId: 27, defaultSubtype: 0 },
	colorPulse: { presetClass: 'emph', presetId: 27, defaultSubtype: 0 },
	growWithColor: { presetClass: 'emph', presetId: 28, defaultSubtype: 0 },
	lighten: { presetClass: 'emph', presetId: 30, defaultSubtype: 0 },
	styleEmphasis: { presetClass: 'emph', presetId: 31, defaultSubtype: 0 },
	teeter: { presetClass: 'emph', presetId: 32, defaultSubtype: 0 },
	verticalGrow: { presetClass: 'emph', presetId: 33, defaultSubtype: 0 },
	wave: { presetClass: 'emph', presetId: 34, defaultSubtype: 0 },
	// blink/shimmer (35/36) and the two unnamed 3D-only ids (40/41) have no
	// dedicated playback keyframe wired up yet (see
	// `animation-emphasis-blink-shimmer.ts`); typed names are still added here
	// so authoring/round-trip and the UI catalog can name them correctly.
	blink: { presetClass: 'emph', presetId: 35, defaultSubtype: 0 },
	shimmer: { presetClass: 'emph', presetId: 36, defaultSubtype: 0 },
	threeDCustomEmphasis1: { presetClass: 'emph', presetId: 40, defaultSubtype: 0 },
	threeDCustomEmphasis2: { presetClass: 'emph', presetId: 41, defaultSubtype: 0 },
};

/**
 * Canonical typed name per emphasis presetID, for the reverse lookup. Every
 * id with more than one forward-map alias is seeded explicitly here so the
 * reverse lookup is deterministic rather than relying on object-key
 * iteration order to pick the "first" alias.
 */
export const EMPH_CANONICAL: ReadonlyArray<[number, string]> = [
	[1, 'changeFillColor'], // alias: fillColor
	[2, 'changeFont'],
	[3, 'changeFontColor'], // alias: fontColor
	[4, 'changeFontSize'],
	[5, 'changeFontStyle'],
	[6, 'growShrink'],
	[7, 'changeLineColor'], // alias: lineColor
	[8, 'spin'],
	[9, 'transparency'],
	[10, 'boldFlash'], // alias: flash
	[14, 'blast'],
	[15, 'boldReveal'],
	[16, 'brushOnColor'], // alias: brushColor
	[18, 'brushOnUnderline'], // alias: underline
	[19, 'objectColor'], // alias: colorBlend
	[20, 'colorWave'],
	[21, 'complementaryColor'],
	[22, 'complementaryColor2'],
	[23, 'contrastingColor'],
	[24, 'darken'],
	[25, 'desaturate'],
	// emph.26 is Pulse AND Flash Bulb - the SAME preset under two
	// PowerPoint-history names, confirmed by byte-identical COM/UI-Automation
	// XML (see the module doc above). `pulse` is canonical because it is the
	// modern ribbon name and the pre-existing typed value; `flashBulb` and
	// the unverified `bounce` (PowerPoint has no real "Bounce" emphasis, see
	// the module doc) both alias it.
	[26, 'pulse'],
	// emph.27 is Flicker AND Color Pulse - same one-preset-two-names pattern.
	// `colorPulse` is canonical (the modern ribbon name, matching the catalog
	// label); `flicker` (the older `MsoAnimEffect` name) aliases it.
	[27, 'colorPulse'],
	[28, 'growWithColor'],
	[30, 'lighten'],
	[31, 'styleEmphasis'],
	[32, 'teeter'],
	[33, 'verticalGrow'],
	[34, 'wave'],
	[35, 'blink'],
	[36, 'shimmer'],
	[40, 'threeDCustomEmphasis1'],
	[41, 'threeDCustomEmphasis2'],
];
