/**
 * `slide-transition-box`: the p15/p14 "Box" slide transition
 * (`<p14:prism isInverted="1"/>`, `prismFamilyTypeForFlags` in
 * `p14-prism-family`), split out of `slide-transition-cinematic` to keep that
 * module under the project's per-file LOC budget.
 *
 * Box and Cube share the same OOXML element (`p14:prism`) and used to share the
 * same CSS keyframes too, on the reasoning that Box is "Cube's inverted twin".
 * That collapsed two visually distinct PowerPoint effects into one. MEASURED via
 * COM `Presentation.CreateVideo` frame extraction (a two-slide deck authored
 * through this SDK's own `SlideBuilder.setTransition`, so the XML PowerPoint
 * reopens is exactly what `PptxSlideTransitionService` writes):
 *
 * - **Cube** (`p14:prism`, no flags): the two faces stay joined along one
 *   continuous edge throughout the rotation, exactly like a real cube seen from
 *   outside - the hinge sits AT the screen surface and sweeps across it. Neither
 *   face's near (seam) edge ever loses height; only its width foreshortens.
 * - **Box** (`p14:prism isInverted="1"`): the two faces visibly separate,
 *   opening a gap that reveals the backdrop between them, and each face's near
 *   (seam) edge foreshortens in BOTH width and height, not just width. That is
 *   the signature of a hinge that sits BEHIND the screen (the viewer is inside
 *   the box): the seam recedes in depth as the box turns, rather than staying
 *   pinned to the screen plane the way Cube's does.
 *
 * The keyframes below reproduce that: Cube (`slide-transition-cinematic`)
 * keeps its edge-hinge `translateX`/`rotateY` recipe untouched; Box adds a
 * `translateZ` recession and matching `scale` shrink so the seam genuinely
 * moves away from camera, which is what opens the gap and shrinks both axes.
 *
 * @module render/slide-transition-box
 */

import { EASE, resolveDirection } from './slide-transition-types';
import type { ResolvedDirection, SlideTransitionAnimations } from './slide-transition-types';

/** Resolve the Box transition to its CSS `animation` descriptors. */
export function getBoxTransitionAnimations(
	durationMs: number,
	direction: string | undefined,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	const dir = resolveDirection(direction, 'left');
	return {
		outgoing: `pptx-tr-box-out-${dir} ${dur} ${EASE} forwards`,
		incoming: `pptx-tr-box-in-${dir} ${dur} ${EASE} forwards`,
		outgoingOnTop: false,
	};
}

/**
 * Recede-into-depth + shrink pair for one axis/direction, keyed by `prefix` so
 * the same recipe can back more than one `p14:prism` family member.
 *
 * `translateSign` is the sign of the OUTGOING layer's final nudge (`-1` for
 * left/up, `1` for right/down) - the same sign
 * `slide-transition-cinematic`'s own `pptx-tr-cube-out-*` keyframes use for
 * their `translateX`/`translateY`, so a depth-receding member travels the same
 * way Cube does for a given `dir`. The rotation sign runs WITH `translateSign`
 * on the X axis (left/right) and AGAINST it on the Y axis (up/down) - again
 * copied from the existing Cube keyframes' own sign pattern - so only the
 * depth recession (the actual measured difference) is new.
 *
 * Exported so `slide-transition-cinematic` can reuse it for Orbit
 * (`isInverted="1" isContent="1"`): COM `CreateVideo` measurement shows Orbit
 * opening the same depth gap + both-axis foreshortening as Box, not the flat
 * `translateZ`-only recede the pre-measurement keyframes used.
 */
export function prismDepthPair(
	prefix: string,
	dir: ResolvedDirection,
	axis: 'X' | 'Y',
	translateSign: 1 | -1,
): string {
	const translate = `translate${axis}`;
	const rotate = axis === 'X' ? 'rotateY' : 'rotateX';
	const rotateSign = axis === 'X' ? translateSign : (-translateSign as 1 | -1);
	const nudge = `${translate}(${translateSign * 8}%)`;
	const nudgeBack = `${translate}(${translateSign * -8}%)`;
	return `
@keyframes pptx-tr-${prefix}-out-${dir} { from { transform: perspective(1200px) translateZ(0) ${rotate}(0deg) scale(1); opacity: 1; } to { transform: perspective(1200px) ${nudge} translateZ(-650px) ${rotate}(${rotateSign * 65}deg) scale(.55); opacity: .35; } }
@keyframes pptx-tr-${prefix}-in-${dir} { from { transform: perspective(1200px) ${nudgeBack} translateZ(-650px) ${rotate}(${rotateSign * -65}deg) scale(.55); opacity: .35; } to { transform: perspective(1200px) translateZ(0) ${rotate}(0deg) scale(1); opacity: 1; } }`;
}

/**
 * `@keyframes` for every Box direction. Folded into
 * `CINEMATIC_TRANSITION_KEYFRAMES` (and from there into the injected
 * `SLIDE_TRANSITION_KEYFRAMES` aggregate every binding shares) so no binding
 * wires this up itself.
 */
export const BOX_TRANSITION_KEYFRAMES = `
/* ── Box (faces separate and recede in depth, unlike Cube's flush hinge) ── */${prismDepthPair('box', 'left', 'X', -1)}${prismDepthPair('box', 'right', 'X', 1)}${prismDepthPair('box', 'up', 'Y', -1)}${prismDepthPair('box', 'down', 'Y', 1)}
`;
