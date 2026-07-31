import { BEVEL_PRESETS, MATERIAL_PRESETS, TEXT_WARP_PRESETS } from 'pptx-viewer-shared';

/**
 * text-effects-labels.ts: display labels for the three preset selects in
 * {@link TextEffectsSection} (warp, 3D material, 3D bevel).
 *
 * WHY this is a module rather than inline template code: the shared warp
 * catalogue is keyed on the OOXML `text`-prefixed wire values (`textArchUp`),
 * while `TextStyle.textWarpPreset` stores the short form the panel already
 * writes (`archUp`). The prefixing is real logic, and it belongs beside the
 * component instead of inside the markup. Vanilla's `text-effects-controls.ts`
 * and `text-3d-section.ts` drive their equivalents off the same three shared
 * tables, so the wording cannot drift between the bindings.
 *
 * These helpers are LOOKUPS only. They never decide which values a select
 * offers, so spelling a token out cannot add or drop an option (which would
 * move the control out of parity with React).
 */

/** Index a shared preset catalogue by its wire value. */
function labelIndex(
	presets: ReadonlyArray<{ value: string; label: string }>,
): ReadonlyMap<string, string> {
	return new Map(presets.map((preset) => [preset.value, preset.label]));
}

const WARP_LABELS = labelIndex(TEXT_WARP_PRESETS);
const MATERIAL_LABELS = labelIndex(MATERIAL_PRESETS);
const BEVEL_LABELS = labelIndex(BEVEL_PRESETS);

/** `archUp` -> `textArchUp`, the value the shared warp catalogue is keyed on. */
function warpSchemaValue(value: string): string {
	return `text${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * An unmapped token falls back to itself rather than to an empty string: a
 * deck may carry a preset newer than the catalogue, and blanking the option
 * would make the select look broken rather than merely untranslated.
 */
function lookup(labels: ReadonlyMap<string, string>, value: string): string {
	return labels.get(value) ?? value;
}

/**
 * Display label for a `TextStyle.textWarpPreset` short value. The fallback is
 * the caller's token, not the prefixed form this looked the label up under.
 */
export function warpPresetLabel(value: string): string {
	return WARP_LABELS.get(warpSchemaValue(value)) ?? value;
}

/** Display label for a `Text3DStyle.presetMaterial` value. */
export function materialPresetLabel(value: string): string {
	return lookup(MATERIAL_LABELS, value);
}

/** Display label for a `Text3DStyle.bevelTopType` value. */
export function bevelPresetLabel(value: string): string {
	return lookup(BEVEL_LABELS, value);
}
