/**
 * `slide-transition-types` — pure types, direction/orientation resolution, and
 * shared constants backing the slide-transition CSS resolver.
 *
 * Split out of `slide-transition-css` to keep every source file within the
 * project's per-file LOC budget; everything here is framework-agnostic and pure.
 *
 * NOTE — distinct from element animation (`animation-css`): those drive
 * individual element entrance/emphasis/exit effects with `pptx-vue-*`
 * keyframes; slide transitions drive slide-to-slide swaps with the
 * `pptx-tr-*` keyframe family in `slide-transition-keyframes`. The two prefix
 * namespaces never collide.
 *
 * Per-binding duration policy (default duration + minimum floor) deliberately
 * differs between bindings (Vue: 1000ms default, no floor; Angular: 320ms
 * default, 120ms floor), so the duration *constants and resolvers* live in each
 * binding rather than here. The {@link DEFAULT_TRANSITION_DURATION_MS} exported
 * here is the React/Vue default consumed by `resolveSlideTransition`.
 *
 * @module render/slide-transition-types
 */

import type { PptxTransitionType } from 'pptx-viewer-core';

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

/** Resolved CSS `animation` shorthands for the two transition layers. */
export interface SlideTransitionAnimations {
	/** CSS `animation` value for the outgoing (old) slide layer, or `'none'`. */
	outgoing: string;
	/** CSS `animation` value for the incoming (new) slide layer, or `'none'`. */
	incoming: string;
	/** Whether the outgoing layer should render above the incoming layer. */
	outgoingOnTop: boolean;
}

// ---------------------------------------------------------------------------
// Direction resolution
// ---------------------------------------------------------------------------

/** The four cardinal directions a transition can resolve to. */
export type ResolvedDirection = 'left' | 'right' | 'up' | 'down';

/** Cardinal directions plus the four diagonals (for cover/uncover/strips). */
export type ResolvedDirection8 = ResolvedDirection | 'lu' | 'ld' | 'ru' | 'rd';

/** Map an OOXML `dir` token (`l`/`r`/`u`/`d`) to a cardinal direction. */
export function resolveDirection(
	direction: string | undefined,
	defaultDir: ResolvedDirection,
): ResolvedDirection {
	switch (direction) {
		case 'l':
			return 'left';
		case 'r':
			return 'right';
		case 'u':
			return 'up';
		case 'd':
			return 'down';
		default:
			return defaultDir;
	}
}

/** Map an OOXML `dir` token to a cardinal **or diagonal** direction. */
export function resolveDirection8(
	direction: string | undefined,
	defaultDir: ResolvedDirection,
): ResolvedDirection8 {
	switch (direction) {
		case 'l':
			return 'left';
		case 'r':
			return 'right';
		case 'u':
			return 'up';
		case 'd':
			return 'down';
		case 'lu':
		case 'ld':
		case 'ru':
		case 'rd':
			return direction;
		default:
			return defaultDir;
	}
}

/** Resolve an orientation from the `orient` or `direction` attribute. */
export function resolveOrientation(
	direction: string | undefined,
	orient: string | undefined,
): 'horz' | 'vert' {
	if (orient === 'horz' || orient === 'vert') {
		return orient;
	}
	if (direction === 'horz' || direction === 'vert') {
		return direction;
	}
	return 'horz';
}

/** Transition types eligible for `random` selection (kept deterministic-light). */
export const RANDOM_ELIGIBLE_TYPES: readonly PptxTransitionType[] = [
	'fade',
	'push',
	'wipe',
	'cover',
	'dissolve',
	'circle',
	'zoom',
];

/** No-animation sentinel — used for `none`/`cut` (instant slide swap). */
export const INSTANT: SlideTransitionAnimations = {
	outgoing: 'none',
	incoming: 'none',
	outgoingOnTop: true,
};

/**
 * Default transition duration (ms) when the transition omits `durationMs`. This
 * is the React/Vue default consumed by `resolveSlideTransition`. The Angular
 * binding uses its own (smaller, floored) duration policy.
 */
export const DEFAULT_TRANSITION_DURATION_MS = 1000;

/** Easing applied to every transition animation. */
export const EASE = 'ease-in-out';
