/**
 * `animation-presets` - OOXML preset-id -> effect-name lookup tables for the
 * native-animation timeline. Pure data, framework-free.
 *
 * The entrance/exit/emphasis tables and the presetSubtype direction/variant
 * tables each live in their own module (kept under the repo's file-size
 * guideline); this module composes them into the single
 * {@link PRESET_ID_TO_EFFECT} map and re-exports everything else, so every
 * existing import of `./animation-presets` keeps working unchanged.
 *
 * @module render/animation-presets
 */

import { EMPH_PRESETS } from './animation-presets-emphasis';
import { ENTR_PRESETS } from './animation-presets-entrance';
import { EXIT_PRESETS } from './animation-presets-exit';
import type { EffectName } from './animation-timeline-types';

export { EMPH_FILTER_PRESETS, emphasisFilterKeyframeCss } from './animation-presets-emphasis';
export {
	BARN_FILTER_TOKEN_TO_SUBTYPE,
	FLY_SUBTYPE_TO_EDGE,
	SPLIT_SUBTYPE_TO_VARIANT,
	WIPE_FILTER_TOKEN_TO_SUBTYPE,
	WIPE_SUBTYPE_TO_EDGE,
} from './animation-presets-subtypes';
export type { FlyEdge, SplitVariant } from './animation-presets-subtypes';

// ==========================================================================
// OOXML presetId -> effect name mapping
// ==========================================================================

interface PresetIdMap {
	entr: Record<number, EffectName>;
	exit: Record<number, EffectName>;
	emph: Record<number, EffectName>;
}

export const PRESET_ID_TO_EFFECT: PresetIdMap = {
	entr: ENTR_PRESETS,
	exit: EXIT_PRESETS,
	emph: EMPH_PRESETS,
};
