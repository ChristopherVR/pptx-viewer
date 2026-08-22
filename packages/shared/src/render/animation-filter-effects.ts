/**
 * `animation-filter-effects`: resolves a `p:animEffect/@filter` descriptor
 * (parsed onto {@link PptxNativeAnimation.effectFilter}) to an {@link EffectName}
 * and, for the directional families, a synthesised numeric `presetSubtype`.
 *
 * `presetId`/`presetClass` remain the PRIMARY effect selector (see
 * `resolveEffect` in `animation-timeline-helpers`); this module is consulted
 * only as the FALLBACK, when no preset-table entry matches (an absent or
 * unrecognised `presetId` - the situation a deck authored by a tool other
 * than PowerPoint is in, since it may emit only the filter string).
 *
 * Every mapped family reuses machinery that already exists for preset-driven
 * playback:
 *  - `wipe` / `barn` reuse the exact same directional mask-reveal engine
 *    (`buildDirectionalKeyframe`, `WIPE_SUBTYPE_TO_EDGE`,
 *    `SPLIT_SUBTYPE_TO_VARIANT`) that a preset-driven Wipe/Split effect uses,
 *    via the token->presetSubtype maps in `animation-presets`.
 *  - `checkerboard` / `blinds` / `box` / `circle` / `wheel` / `dissolve` /
 *    `fade` / `zoom` / `randombar` reuse the existing static `@keyframes`
 *    (`checkerboardIn`, `blindsIn`, `boxIn`, `circleIn`, `wheelIn`,
 *    `dissolveIn`/`Out`, `fadeIn`/`Out`, `zoomIn`/`Out`, `randomBarsIn`) built
 *    for the SAME preset families in `animation-keyframes`.
 *  - `slide` maps directly onto the existing per-edge Fly keyframes
 *    (`flyInLeft`/`flyOutRight`/etc.) - PowerPoint's `slide(fromLeft)` filter
 *    IS a fly-style translation, just spelled differently.
 *  - `strips` (diagonal corner reveal) has no dedicated element-level mask
 *    shape; it is approximated by reusing the Wipe engine off the nearest
 *    cardinal edge (documented on {@link STRIPS_TOKEN_TO_WIPE_TOKEN}).
 *
 * Families with NO cheap CSS equivalent (`diamond`, `plus`, `wedge`, `image`,
 * `stretch`, `pixelate`, `random`, `comb`, `newsflash`, `cover`, `uncover`,
 * `push`, `pull`, `cut`) are intentionally left out of
 * {@link FILTER_FAMILY_EFFECT}: `resolveEffect` returning `undefined` for them
 * lets the timeline builder's existing unmapped-preset safety net
 * (`fallbackEffectForClass`) substitute the neutral `fadeIn`/`fadeOut`, so the
 * effect is never silently dropped. See {@link GENERIC_FALLBACK_FILTER_FAMILIES}.
 *
 * @module render/animation-filter-effects
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { BARN_FILTER_TOKEN_TO_SUBTYPE, WIPE_FILTER_TOKEN_TO_SUBTYPE } from './animation-presets';
import type { EffectName } from './animation-timeline-types';

// ==========================================================================
// Family -> EffectName (non-directional / statically-mapped families)
// ==========================================================================

interface FilterEffectPair {
	entr: EffectName;
	exit: EffectName;
}

/**
 * Filter families with a direct, reused CSS treatment. Keyed by the
 * lowercased family name (matches {@link PptxAnimationEffectFilter.family},
 * which is already lowercased at parse time).
 *
 * `barn` and `checkerboard`/`blinds`/`box`/`wheel`/`randombar` have no
 * dedicated element-level EXIT mask yet (only the preset catalogue's
 * Split/Checkerboard/Blinds/Box/Wheel/Random-Bars ENTRANCE is modelled), so
 * their `exit` slot falls back to the neutral `fadeOut` rather than
 * fabricating an unverified reveal-in-reverse.
 */
const FILTER_FAMILY_EFFECT: Readonly<Record<string, FilterEffectPair>> = {
	fade: { entr: 'fadeIn', exit: 'fadeOut' },
	dissolve: { entr: 'dissolveIn', exit: 'dissolveOut' },
	wipe: { entr: 'wipeIn', exit: 'wipeOut' },
	barn: { entr: 'splitIn', exit: 'fadeOut' },
	checkerboard: { entr: 'checkerboardIn', exit: 'fadeOut' },
	blinds: { entr: 'blindsIn', exit: 'fadeOut' },
	box: { entr: 'boxIn', exit: 'fadeOut' },
	circle: { entr: 'circleIn', exit: 'shrinkOut' },
	wheel: { entr: 'wheelIn', exit: 'fadeOut' },
	zoom: { entr: 'zoomIn', exit: 'zoomOut' },
	randombar: { entr: 'randomBarsIn', exit: 'fadeOut' },
	// Strips is a diagonal corner reveal; approximated via the Wipe mask
	// engine off the nearest cardinal edge (see STRIPS_TOKEN_TO_WIPE_TOKEN).
	strips: { entr: 'wipeIn', exit: 'wipeOut' },
};

/**
 * Recognised ECMA-376 filter families with no bespoke mapping here. Each one
 * falls through `resolveEffect` (returns `undefined`) to the timeline
 * builder's generic entrance/exit fade safety net rather than being dropped.
 * Exported so the shared test suite can assert every one of them actually
 * reaches that fallback, and so this list is the single place documenting
 * "known but approximated as fade".
 */
export const GENERIC_FALLBACK_FILTER_FAMILIES: readonly string[] = [
	'diamond',
	'plus',
	'wedge',
	'image',
	'stretch',
	'pixelate',
	'random',
	'comb',
	'newsflash',
	'cover',
	'uncover',
	'push',
	'pull',
	'cut',
];

// ==========================================================================
// Slide (direct Fly mapping)
// ==========================================================================

const SLIDE_TOKEN_TO_SUFFIX: Readonly<Record<string, 'Left' | 'Right' | 'Top' | 'Bottom'>> = {
	fromLeft: 'Left',
	fromRight: 'Right',
	fromTop: 'Top',
	fromBottom: 'Bottom',
};

function resolveSlideEffect(subtype: string | undefined, isExit: boolean): EffectName {
	const suffix = subtype ? (SLIDE_TOKEN_TO_SUFFIX[subtype] ?? 'Bottom') : 'Bottom';
	return isExit ? (`flyOut${suffix}` as EffectName) : (`flyIn${suffix}` as EffectName);
}

// ==========================================================================
// Strips -> nearest cardinal Wipe edge (diagonal approximation)
// ==========================================================================

/**
 * Strips travels diagonally from a screen corner; the element-level mask
 * engine only has cardinal-edge wipes, so each corner token is approximated
 * by its vertical component (matches the direction most viewers read as
 * dominant for a corner sweep).
 */
const STRIPS_TOKEN_TO_WIPE_TOKEN: Readonly<Record<string, string>> = {
	downLeft: 'down',
	downRight: 'down',
	upLeft: 'up',
	upRight: 'up',
};

// ==========================================================================
// Public resolvers
// ==========================================================================

/**
 * Resolve the fallback {@link EffectName} for a native animation's parsed
 * `@filter`, or `undefined` when the family is unrecognised/unmapped (the
 * caller's own generic fade safety net takes over in that case).
 */
export function resolveFilterEffect(anim: PptxNativeAnimation): EffectName | undefined {
	const filter = anim.effectFilter;
	if (!filter) {
		return undefined;
	}
	const isExit = anim.presetClass === 'exit';
	if (filter.family === 'slide') {
		return resolveSlideEffect(filter.subtype, isExit);
	}
	const mapping = FILTER_FAMILY_EFFECT[filter.family];
	if (!mapping) {
		return undefined;
	}
	return isExit ? mapping.exit : mapping.entr;
}

/**
 * Resolve the numeric `presetSubtype` to feed
 * {@link import('./animation-directional').buildDirectionalKeyframe}: the
 * animation's own `presetSubtype` when present (real preset data always
 * wins), otherwise a value synthesised from the filter's subtype token for
 * the two directional families (`wipe`, `barn`) that have one. Every other
 * family (or a filter-only Strips animation, approximated non-directionally
 * via its nearest Wipe edge) returns `undefined`, matching `undefined`'s
 * existing meaning of "use the non-directional static effect".
 */
export function resolveFilterPresetSubtype(anim: PptxNativeAnimation): number | undefined {
	if (anim.presetSubtype !== undefined) {
		return anim.presetSubtype;
	}
	const filter = anim.effectFilter;
	if (!filter?.subtype) {
		return undefined;
	}
	if (filter.family === 'wipe') {
		return WIPE_FILTER_TOKEN_TO_SUBTYPE[filter.subtype];
	}
	if (filter.family === 'barn') {
		return BARN_FILTER_TOKEN_TO_SUBTYPE[filter.subtype];
	}
	if (filter.family === 'strips') {
		const wipeToken = STRIPS_TOKEN_TO_WIPE_TOKEN[filter.subtype];
		return wipeToken ? WIPE_FILTER_TOKEN_TO_SUBTYPE[wipeToken] : undefined;
	}
	return undefined;
}
