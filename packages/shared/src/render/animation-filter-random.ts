/**
 * `animation-filter-random`: resolves the `random` SMIL/ECMA-376
 * `p:animEffect/@filter` family (see `animation-filter-effects`'s module doc
 * for how this fits the rest of the filter fallback).
 *
 * Per SMIL 2.0, `random` literally means "pick one of the other known
 * transition types". This module does exactly that, against
 * {@link RANDOM_EFFECT_POOL} (a curated subset of the OTHER
 * already-implemented reveal/conceal pairs from `animation-filter-effects`).
 * The pick is derived deterministically from the animation's `targetId` (a
 * stable FNV-1a hash, see {@link fnv1aHash}) rather than `Math.random()`, so
 * replaying the SAME element's SAME animation always resolves to the SAME
 * effect (matching every other resolution in this module being a pure
 * function of the input), while different elements/instances land on
 * different picks.
 *
 * @module render/animation-filter-random
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type { EffectName } from './animation-timeline-types';

interface FilterEffectPair {
	entr: EffectName;
	exit: EffectName;
}

/**
 * Pool of already-implemented, non-`random` reveal/conceal effect pairs that
 * a `random` filter may resolve to. Deliberately its own literal list rather
 * than derived from `animation-filter-effects`'s own tables: the pool's
 * composition (and thus `random`'s odds) is visible in one place and does not
 * silently change when those tables gain an entry.
 */
const RANDOM_EFFECT_POOL: readonly FilterEffectPair[] = [
	{ entr: 'fadeIn', exit: 'fadeOut' },
	{ entr: 'dissolveIn', exit: 'dissolveOut' },
	{ entr: 'wipeIn', exit: 'wipeOut' },
	{ entr: 'splitIn', exit: 'fadeOut' },
	{ entr: 'checkerboardIn', exit: 'fadeOut' },
	{ entr: 'blindsIn', exit: 'fadeOut' },
	{ entr: 'boxIn', exit: 'fadeOut' },
	{ entr: 'circleIn', exit: 'shrinkOut' },
	{ entr: 'wheelIn', exit: 'fadeOut' },
	{ entr: 'zoomIn', exit: 'zoomOut' },
	{ entr: 'randomBarsIn', exit: 'fadeOut' },
	{ entr: 'diamondIn', exit: 'fadeOut' },
	{ entr: 'plusIn', exit: 'fadeOut' },
	{ entr: 'wedgeIn', exit: 'fadeOut' },
	{ entr: 'cutIn', exit: 'cutOut' },
	{ entr: 'flyInLeft', exit: 'flyOutLeft' },
	{ entr: 'flyInRight', exit: 'flyOutRight' },
	{ entr: 'flyInTop', exit: 'flyOutTop' },
	{ entr: 'flyInBottom', exit: 'flyOutBottom' },
];

/**
 * Deterministically hash a string into a non-negative 32-bit integer
 * (FNV-1a). Pure and dependency-free; used only to pick a stable index into
 * {@link RANDOM_EFFECT_POOL}, never for anything security-sensitive.
 */
function fnv1aHash(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * Resolve a `random` filter to one of {@link RANDOM_EFFECT_POOL}'s pairs. The
 * pick is a pure function of the animation's `targetId` (falling back to the
 * filter's raw token, then a constant, when a deck has no target id), so the
 * SAME element's SAME animation always resolves to the SAME effect on replay
 * (deterministic, testable) while different elements typically land on
 * different picks, matching SMIL's "pick one of the other known transition
 * types" semantics without a non-deterministic `Math.random()` call.
 */
export function resolveRandomEffect(anim: PptxNativeAnimation, isExit: boolean): EffectName {
	const seed = anim.targetId ?? anim.effectFilter?.raw ?? 'random';
	const index = fnv1aHash(seed) % RANDOM_EFFECT_POOL.length;
	const pair = RANDOM_EFFECT_POOL[index];
	return isExit ? pair.exit : pair.entr;
}
