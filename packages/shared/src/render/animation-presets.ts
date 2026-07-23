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
		7: 'flash', // Blink: an opacity blink, closest existing keyframe.
		8: 'spin',
		9: 'transparency',
		14: 'teeter',
		26: 'pulse',
	},
};

// ==========================================================================
// Filter-based emphasis effects (desaturate / darken / lighten)
// ==========================================================================

/**
 * Emphasis presets whose effect is a CSS `filter` pulse rather than a transform
 * or opacity change. These are generated as dynamic `@keyframes` (see
 * {@link import('./animation-timeline-helpers').buildDynamicKeyframe}) because
 * there is no static keyframe for them.
 *
 * The `filterMid` is applied at the animation midpoint and eased back to the
 * neutral value, matching PowerPoint's "emphasise then settle" feel. The preset
 * IDs are a best-effort mapping of the ECMA-376 emphasis catalogue; any preset
 * id not covered here (or by {@link PRESET_ID_TO_EFFECT}) still animates via the
 * neutral emphasis fallback, so an unrecognised id is never dropped.
 */
export const EMPH_FILTER_PRESETS: Readonly<Record<number, { name: string; filterMid: string }>> = {
	3: { name: 'desaturate', filterMid: 'saturate(0.15)' },
	4: { name: 'darken', filterMid: 'brightness(0.55)' },
	5: { name: 'lighten', filterMid: 'brightness(1.6)' },
};

/**
 * Build a CSS `filter` emphasis `@keyframes` block (desaturate / darken /
 * lighten) for an emphasis preset id in {@link EMPH_FILTER_PRESETS}. The filter
 * is applied at the midpoint and eased back to neutral. Returns `undefined` for
 * any preset id without a filter mapping.
 */
export function emphasisFilterKeyframeCss(
	presetId: number | undefined,
	name: string,
): string | undefined {
	if (presetId === undefined) {
		return undefined;
	}
	const preset = EMPH_FILTER_PRESETS[presetId];
	if (!preset) {
		return undefined;
	}
	return `@keyframes ${name} {\n\t0% { filter: none; }\n\t50% { filter: ${preset.filterMid}; }\n\t100% { filter: none; }\n}`;
}

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
