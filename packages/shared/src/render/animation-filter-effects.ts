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
 *  - `slide` / `cover` / `uncover` / `push` / `pull` all map onto the same
 *    per-edge Fly keyframes (`flyInLeft`/`flyOutRight`/etc.): each is a
 *    directional translate-and-displace transition in the SMIL sense, and
 *    this single-element playback engine has no separate "the OTHER element
 *    also moves" concept, so all five collapse onto the one Fly mapping (see
 *    {@link resolveSlideEffect}). `cover`/`uncover` additionally carry
 *    diagonal subtype tokens (`fromTopLeft`, etc.) that
 *    {@link SLIDE_TOKEN_TO_SUFFIX} does not enumerate; those fall through to
 *    the same default bottom edge as an unrecognised `slide` subtype.
 *  - `strips` (diagonal corner reveal) has no dedicated element-level mask
 *    shape; it is approximated by reusing the Wipe engine off the nearest
 *    cardinal edge (documented on {@link STRIPS_TOKEN_TO_WIPE_TOKEN}).
 *  - `diamond` / `plus` / `wedge` reuse the box/circle mask-SIZE technique
 *    (`diamondOut` / `plusOut` / `wedgeOut` in `animation-mask-reveal`): a
 *    fixed mask shape whose `mask-size` animates 0 -> full, so `diamond`
 *    grows a rotated square from centre, `plus` unions a horizontal and a
 *    vertical bar growing from centre into a cross, and `wedge` grows a
 *    convex hexagon standing in for PowerPoint's two-wedge bowtie sweep
 *    (an animated sweep ANGLE is not expressible with this position/size-only
 *    technique, see `animation-mask-reveal`'s module doc).
 *  - `comb` reuses `randomBarsIn`: both are an alternating-strip reveal of
 *    the same shape family as `randombar`/`checkerboard`, and PowerPoint's
 *    only structural difference (ordered teeth vs. random bars) is not worth
 *    a second bespoke keyframe.
 *  - `cut` is a new, genuinely distinct pair of keyframes (`cutIn`/`cutOut`)
 *    that jump the element to its end state almost immediately rather than
 *    animating gradually over the effect's duration, matching a SMIL `cut`
 *    filter's "instant swap" semantics.
 *  - `stretch` carries the same `fromLeft`/`fromRight`/`fromTop`/`fromBottom`
 *    direction tokens as `slide` (SMIL 2.0 Transition Effects), so it reuses
 *    {@link SLIDE_TOKEN_TO_SUFFIX} for the edge lookup (see
 *    {@link resolveStretchEffect}), but resolves to a NEW pair of static
 *    keyframes (`stretchIn*`/`stretchOut*`) rather than Fly's translate: a
 *    directional non-uniform `scaleX`/`scaleY` pinned to the named edge via
 *    `transform-origin`, standing in for SMIL's "elastic bar" stretch.
 *  - `newsflash` has no subtype and is a new, genuinely distinct pair of
 *    keyframes (`newsflashIn`/`newsflashOut`): a spin-and-zoom from/to a
 *    near-zero point, approximating PowerPoint's own Newsflash effect.
 *  - `random` per SMIL 2.0 literally means "pick one of the other known
 *    transition types"; {@link resolveRandomEffect} (in the sibling
 *    `animation-filter-random` module, split out to keep this file under the
 *    repo's file-size guideline) does exactly that, deterministically, from
 *    the animation's `targetId` rather than `Math.random()`.
 *
 * Families with NO cheap CSS equivalent given this engine's one-element
 * mask/keyframe architecture (`image`, `pixelate`) are intentionally left out
 * of {@link FILTER_FAMILY_EFFECT}: `resolveEffect` returning `undefined` for
 * them lets the timeline builder's existing unmapped-preset safety net
 * (`fallbackEffectForClass`) substitute the neutral `fadeIn`/`fadeOut`, so the
 * effect is never silently dropped. See {@link GENERIC_FALLBACK_FILTER_FAMILIES}
 * for why: `image` substitutes a second AUTHORED image mid-transition that the
 * OOXML `p:animEffect` filter payload never carries, so there is nothing to
 * substitute; `pixelate`'s blocky mosaic needs to rasterise the element's
 * actual painted content at progressively coarser resolution, which is a
 * canvas/WebGL operation, not a `mask-image`/`clip-path`/`transform` one, so
 * it does not fit this architecture's "one CSS `@keyframes` block per effect"
 * shape the way every other family above does.
 *
 * @module render/animation-filter-effects
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { resolveRandomEffect } from './animation-filter-random';
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
	// Comb is an ordered alternating-strip reveal; close enough to the
	// randombar shape family that it reuses the same keyframe rather than a
	// bespoke ordered-strip mask.
	comb: { entr: 'randomBarsIn', exit: 'fadeOut' },
	diamond: { entr: 'diamondIn', exit: 'fadeOut' },
	plus: { entr: 'plusIn', exit: 'fadeOut' },
	wedge: { entr: 'wedgeIn', exit: 'fadeOut' },
	cut: { entr: 'cutIn', exit: 'cutOut' },
	newsflash: { entr: 'newsflashIn', exit: 'newsflashOut' },
};

/**
 * Recognised ECMA-376 filter families with no bespoke mapping here. Each one
 * falls through `resolveEffect` (returns `undefined`) to the timeline
 * builder's generic entrance/exit fade safety net rather than being dropped.
 * Exported so the shared test suite can assert every one of them actually
 * reaches that fallback, and so this list is the single place documenting
 * "known but approximated as fade". See the module doc for why each of these
 * two specifically has no cheap CSS equivalent in this architecture.
 */
export const GENERIC_FALLBACK_FILTER_FAMILIES: readonly string[] = ['image', 'pixelate'];

// ==========================================================================
// Slide / cover / uncover / push / pull (direct Fly mapping)
// ==========================================================================

/**
 * Families whose subtype is a `fromLeft`/`fromRight`/`fromTop`/`fromBottom`
 * direction token that maps directly onto a Fly keyframe. `cover` and
 * `uncover` also allow four diagonal tokens (`fromTopLeft`, etc.) that this
 * table does not enumerate; those fall through to the same default bottom
 * edge as an unrecognised `slide` subtype (see {@link resolveSlideEffect}).
 */
const DIRECTIONAL_SLIDE_FAMILIES: ReadonlySet<string> = new Set([
	'slide',
	'cover',
	'uncover',
	'push',
	'pull',
]);

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
// Stretch (directional scale, reuses the slide direction tokens)
// ==========================================================================

/**
 * `stretch` carries the same `fromLeft`/`fromRight`/`fromTop`/`fromBottom`
 * direction tokens as `slide` (SMIL 2.0 Transition Effects), so this reuses
 * {@link SLIDE_TOKEN_TO_SUFFIX} for the edge lookup, defaulting to the same
 * bottom edge as an unrecognised/absent `slide` subtype. Resolves to the
 * `stretchIn*`/`stretchOut*` keyframes (directional scale pinned to the named
 * edge via `transform-origin`), never to Fly.
 */
function resolveStretchEffect(subtype: string | undefined, isExit: boolean): EffectName {
	const suffix = subtype ? (SLIDE_TOKEN_TO_SUFFIX[subtype] ?? 'Bottom') : 'Bottom';
	return isExit ? (`stretchOut${suffix}` as EffectName) : (`stretchIn${suffix}` as EffectName);
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
	if (filter.family === 'random') {
		return resolveRandomEffect(anim, isExit);
	}
	if (filter.family === 'stretch') {
		return resolveStretchEffect(filter.subtype, isExit);
	}
	if (DIRECTIONAL_SLIDE_FAMILIES.has(filter.family)) {
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
