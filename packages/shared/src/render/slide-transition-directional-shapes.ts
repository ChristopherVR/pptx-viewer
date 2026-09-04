/**
 * `slide-transition-directional-shapes`: the `zoom`/@dir and `checker`/@dir
 * resolvers for {@link getSlideTransitionAnimations} in `slide-transition-css`.
 *
 * Split out to keep that already-large module from growing further; these two
 * cases are self-contained pure lookups with no dependency on the switch
 * they're called from.
 *
 * @module render/slide-transition-directional-shapes
 */
import { EASE, resolveOrientation } from './slide-transition-types';
import type { SlideTransitionAnimations } from './slide-transition-types';

/**
 * `p:zoom/@dir` (in/out): PowerPoint's Zoom Out swaps which layer scales up
 * vs down compared to the default Zoom (In). Not COM-verified against a real
 * PowerPoint deck; see G11 in the timing/transition audit.
 */
export function resolveZoomTransition(
	direction: string | undefined,
	dur: string,
): SlideTransitionAnimations {
	if (direction === 'out') {
		return {
			outgoing: `pptx-tr-zoom-out-rev ${dur} ${EASE} forwards`,
			incoming: `pptx-tr-zoom-in-rev ${dur} ${EASE} forwards`,
			outgoingOnTop: false,
		};
	}
	return {
		outgoing: `pptx-tr-zoom-out ${dur} ${EASE} forwards`,
		incoming: `pptx-tr-zoom-in ${dur} ${EASE} forwards`,
		outgoingOnTop: true,
	};
}

/**
 * `p:checker/@dir` (CT_OrientationTransition, horz/vert): the identical
 * construct blinds/comb/randomBar already honour via `resolveOrientation`.
 */
export function resolveCheckerTransition(
	direction: string | undefined,
	orient: string | undefined,
	dur: string,
): SlideTransitionAnimations {
	const o = resolveOrientation(direction, orient);
	return {
		outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
		incoming:
			o === 'vert'
				? `pptx-tr-checker-in-v ${dur} ${EASE} forwards`
				: `pptx-tr-checker-in-h ${dur} ${EASE} forwards`,
		outgoingOnTop: true,
	};
}
