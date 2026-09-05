/**
 * Shared type for `animation-write-mappings.ts` and its per-class preset
 * table modules (`-entrance.ts` / `-exit.ts` / `-emphasis.ts`). Split into
 * its own module so those tables can import the type without creating a
 * circular dependency on the orchestrating `animation-write-mappings.ts`.
 *
 * @module services/animation-write-mappings-types
 */

/** Maps editor animation presets to OOXML preset class + presetID pairs. */
export interface OoxmlPresetMapping {
	presetClass: 'entr' | 'exit' | 'emph' | 'path';
	presetId: number;
	/** Default OOXML preset subtype (direction variant). */
	defaultSubtype: number;
}
