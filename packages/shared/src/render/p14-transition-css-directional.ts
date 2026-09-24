/**
 * `p14-transition-css-directional` — animation-descriptor resolvers for the
 * three p14 transitions whose direction/pattern previously had no effect on
 * playback (`vortex`, `ripple`, `glitter`), split out of `p14-transition-css`
 * to keep that module under the project's per-file LOC budget. See
 * `slide-transition-directional-fx` for the `@keyframes` these reference.
 *
 * @module render/p14-transition-css-directional
 */
import type { SlideTransitionAnimations } from './slide-transition-types';
import { resolveDirection, resolveDirection8 } from './slide-transition-types';

/** `p14:vortex`: rotate + scale spiral, biased toward the authored `@dir`. */
export function getVortexAnimations(
	durationMs: number,
	direction: string | undefined,
	ease: string,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	const dir = resolveDirection(direction, 'left');
	return {
		outgoing: `pptx-tr-vortex-out-${dir} ${dur} ${ease} forwards`,
		incoming: `pptx-tr-vortex-in-${dir} ${dur} ${ease} forwards`,
		outgoingOnTop: true,
	};
}

/**
 * `p14:ripple`: expanding-ring clip-path from the authored diagonal corner, or
 * the slide centre when `@dir` is absent (PowerPoint's "From Center" default,
 * COM-verified: no other cardinal/diagonal token exists for this type besides
 * the four `TRANSITION_VALID_DIRECTIONS` diagonals).
 */
export function getRippleAnimations(
	durationMs: number,
	direction: string | undefined,
	ease: string,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	const dir = resolveDirection8(direction, 'left');
	const corner = dir === 'lu' || dir === 'ld' || dir === 'ru' || dir === 'rd' ? dir : undefined;
	return {
		outgoing: 'none',
		incoming: corner
			? `pptx-tr-ripple-in-${corner} ${dur} ${ease} forwards`
			: `pptx-tr-ripple-in ${dur} ${ease} forwards`,
		outgoingOnTop: false,
	};
}

/**
 * `p14:glitter`: particle dissolve, biased by `@dir` and varied by
 * `@pattern` (`diamond` default vs `hexagon`, COM-verified two-value set).
 */
export function getGlitterAnimations(
	durationMs: number,
	direction: string | undefined,
	pattern: string | undefined,
	ease: string,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	const dir = resolveDirection(direction, 'left');
	const dirToken = dir === 'left' ? 'l' : dir === 'right' ? 'r' : dir === 'up' ? 'u' : 'd';
	const family = pattern === 'hexagon' ? 'hexagon' : 'diamond';
	return {
		outgoing: `pptx-tr-fade-out ${dur} ${ease} forwards`,
		incoming: `pptx-tr-glitter-${family}-in-${dirToken} ${dur} ${ease} forwards`,
		outgoingOnTop: true,
	};
}
