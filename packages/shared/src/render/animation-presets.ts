/**
 * `animation-presets` — OOXML preset-id → effect-name lookup tables for the
 * native-animation timeline. Pure data, framework-free.
 *
 * @module render/animation-presets
 */

import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// OOXML presetId → effect name mapping
// ==========================================================================

interface PresetIdMap {
	entr: Record<number, EffectName>;
	exit: Record<number, EffectName>;
	emph: Record<number, EffectName>;
}

export const PRESET_ID_TO_EFFECT: PresetIdMap = {
	entr: {
		1: 'appear',
		2: 'flyInBottom',
		3: 'blindsIn',
		4: 'boxIn',
		5: 'checkerboardIn',
		6: 'expandIn',
		9: 'dissolveIn',
		10: 'fadeIn',
		12: 'flashIn',
		14: 'randomBarsIn',
		16: 'peekIn',
		// entr.17 = Split per MS-OI29500 / the catalog. (Previously this id was
		// mislabelled randomBarsIn, so imported Split entrances rendered as
		// Random Bars.) entr.14 above is Random Bars.
		17: 'splitIn',
		22: 'wipeIn',
		23: 'zoomIn',
		26: 'riseUp',
		21: 'wheelIn',
		31: 'expandIn',
		37: 'bounceIn',
		42: 'floatIn',
		47: 'swivel',
		49: 'spinnerIn',
		53: 'growTurnIn',
	},
	exit: {
		1: 'disappear',
		2: 'flyOutBottom',
		6: 'shrinkOut',
		9: 'dissolveOut',
		10: 'fadeOut',
		22: 'wipeOut',
		23: 'zoomOut',
		37: 'bounceOut',
	},
	emph: {
		1: 'boldFlash',
		2: 'wave',
		6: 'growShrink',
		8: 'spin',
		9: 'transparency',
		14: 'teeter',
		26: 'pulse',
	},
};

// ==========================================================================
// Fly In / Fly Out direction (presetSubtype) mapping
// ==========================================================================

/** The four edges a Fly In/Out effect can travel from/to. */
export type FlyEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Map an OOXML `p:cTn/@presetSubtype` code to a {@link FlyEdge} for Fly In and
 * Fly Out effects. PowerPoint encodes the direction as a bitmask on the object
 * origin edge: 1=top, 2=right, 4=bottom, 8=left. Corners combine two bits
 * (e.g. 12 = 8|4 = bottom-left) and fall back to their horizontal edge, which
 * is the more visually distinct component. Unknown/absent codes are left to the
 * caller (which keeps the preset default of bottom).
 */
export const FLY_SUBTYPE_TO_EDGE: Readonly<Record<number, FlyEdge>> = {
	1: 'top',
	2: 'right',
	4: 'bottom',
	8: 'left',
	// Corners -> nearest (horizontal) edge.
	3: 'right', // top-right (1|2)
	6: 'right', // bottom-right (4|2)
	9: 'left', // top-left (8|1)
	12: 'left', // bottom-left (8|4)
};
