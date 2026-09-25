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
 * `p:zoom/@dir` (`ST_TransitionInOutDirectionType`, default `out`).
 *
 * COM-verified against PowerPoint's own CreateVideo frames: PowerPoint opens
 * `<p:zoom/>` and `<p:zoom dir="out"/>` as `ppEffectBoxOut` and
 * `<p:zoom dir="in"/>` as `ppEffectBoxIn`, and neither SCALES a slide. Both
 * are a centred, slide-proportioned rectangle whose half-extent moves
 * linearly between 0 and the full slide, and only for HALF the duration
 * (measured at 1s and 2s, 62.5fps):
 *  - `out` (and no `@dir`): nothing moves for the first half, then the
 *    incoming slide is revealed through a box growing out from the centre,
 *    over the untouched outgoing slide.
 *  - `in`: during the first half the outgoing slide is cut down to a box
 *    shrinking into the centre, uncovering the untouched incoming slide; the
 *    second half just holds the incoming slide.
 */
export function resolveZoomTransition(
	direction: string | undefined,
	dur: string,
): SlideTransitionAnimations {
	if (direction === 'in') {
		return {
			outgoing: `pptx-tr-zoom-box-shrink ${dur} linear forwards`,
			incoming: 'none',
			outgoingOnTop: true,
		};
	}
	return {
		outgoing: 'none',
		incoming: `pptx-tr-zoom-box-grow ${dur} linear forwards`,
		outgoingOnTop: false,
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
