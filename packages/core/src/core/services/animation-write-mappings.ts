/**
 * OOXML animation preset mappings and helper functions for the animation
 * write service.
 *
 * `PRESET_TO_OOXML` is the forward lookup used when serialising an editor
 * animation back to OOXML — it maps a typed preset name (e.g. `flyIn`) to
 * the `(presetClass, presetID, defaultSubtype)` tuple PowerPoint expects.
 * Composed from the per-class tables in `animation-write-mappings-entrance.ts`
 * / `-exit.ts` / `-emphasis.ts` (split out to keep each module under the
 * repo's file-size guideline); this module re-exports every one of their
 * exports too, so every existing import of `animation-write-mappings` keeps
 * working unchanged.
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
import type { PptxElementAnimation, XmlObject } from '../types';
import { EMPH_CANONICAL, EMPH_PRESET_TO_OOXML } from './animation-write-mappings-emphasis';
import { ENTR_CANONICAL, ENTR_PRESET_TO_OOXML } from './animation-write-mappings-entrance';
import { EXIT_CANONICAL, EXIT_PRESET_TO_OOXML } from './animation-write-mappings-exit';
import {
	DIRECTION_TO_SUBTYPE,
	triggerToNodeType,
	timingCurveToAccelDecel,
} from './animation-write-mappings-motion';
import type { OoxmlPresetMapping } from './animation-write-mappings-types';

export type { OoxmlPresetMapping } from './animation-write-mappings-types';
export { DIRECTION_TO_SUBTYPE, triggerToNodeType, timingCurveToAccelDecel };

/**
 * Forward lookup: editor preset name -> OOXML mapping.
 *
 * Existing typed names (e.g. `flyIn`, `fadeIn`, `pulse`) are preserved for
 * compatibility with `PptxAnimationPreset` and existing serialisation
 * tests. Additional canonical PowerPoint preset names are appended so the
 * round-trip can name and re-emit the full library.
 */
export const PRESET_TO_OOXML: Record<string, OoxmlPresetMapping> = {
	...ENTR_PRESET_TO_OOXML,
	...EXIT_PRESET_TO_OOXML,
	...EMPH_PRESET_TO_OOXML,
};

/**
 * Reverse lookup helpers — for a parsed `(presetClass, presetID)` pair,
 * resolve back to the canonical preset name (the value in
 * `PRESET_TO_OOXML`). For aliased ids (e.g. emph 26 = pulse | bounce, and
 * emph 10 = boldFlash | flash, entr 6 = expandIn | circleIn), the
 * per-class `*_CANONICAL` array records the canonical typed name so parsing
 * is deterministic.
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

export interface IPptxAnimationWriteService {
	buildTimingXml(
		animations: PptxElementAnimation[],
		existingRawTiming: XmlObject | undefined,
	): XmlObject | undefined;
}
