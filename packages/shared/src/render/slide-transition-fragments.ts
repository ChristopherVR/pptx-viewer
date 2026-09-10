/**
 * `slide-transition-fragments` - entry point for the seven cinematic
 * transitions COM `CreateVideo` measurement showed rendering as many
 * independent fragments/tiles/particles in real PowerPoint, not a single
 * animated layer: `vortex`, `honeycomb`, `glitter`, `shred`, `fracture`,
 * `curtains`, `airplane`.
 *
 * ## Measurement
 *
 * Measured 2026-09-10 against PowerPoint 2016 (16.0) via COM `CreateVideo`
 * (720p/30fps, `DefaultSlideDuration=2.5s`, each preset's `p:transition
 * dur="3000"`), frames extracted with ffmpeg and inspected directly. Per
 * preset:
 *
 *  - **vortex**: NOT a spiral. A dense full-frame dissolve of small
 *    rectangular particles (both the outgoing content's own colouring and
 *    the backdrop mixed together, reading as "dust"), which then clears in a
 *    directional sweep matching `@dir`. `p14:vortex` carries no `spokes`
 *    attribute in the schema (unlike `p:wheel`); {@link vortexFragments}
 *    treats an authored `spokes` as an optional density hint only.
 *  - **honeycomb**: incoming hex tiles populate in a scattered, diagonally-
 *    converging order (not a uniform radial or linear reveal) until solid.
 *  - **glitter**: a dense diamond-shaped sparkle/flicker dissolve (TV-static
 *    of small diamonds) with a directional colour wipe underneath.
 *  - **shred**: a burst of triangular wedge shards radiating outward from
 *    the slide centre in a pinwheel - many thin wedges for the default
 *    `pattern="strip"`, fewer and wider for `pattern="rectangle"`.
 *  - **fracture**: the same radial-burst structure as shred, but with far
 *    fewer (9), larger, irregularly-sized shards - an organic "crack"
 *    rather than a symmetric pinwheel.
 *  - **curtains**: several vertical slats (not one flat sheet) lift away
 *    with a rippling, slightly-folded stagger from centre outward.
 *  - **airplane**: the outgoing content visibly folds into a paper-dart
 *    silhouette (five creased triangular panels) before flying off - a
 *    literal paper-plane fold, not a fragment grid.
 *
 * Fragment counts are capped for a GPU-compositing budget (documented per
 * preset in each builder), not set to whatever PowerPoint's own particle
 * count happens to be - the goal is a faithful structural match (fragment
 * shape, count order-of-magnitude, motion direction, timing envelope), not a
 * pixel-identical particle simulation.
 *
 * ## Shape
 *
 * {@link getFragmentedTransitionDescriptor} is the pure decision function:
 * it returns a {@link FragmentedTransitionDescriptor} (or `undefined` for
 * every other transition type), and each binding's transition overlay maps
 * it onto N clipped copies of its own `SlideLayer`/`SlideCanvas` - every
 * fragment is transform/opacity(/filter)-only against a shared `@keyframes`
 * block ({@link FRAGMENT_TRANSITION_KEYFRAMES}), parameterised per fragment
 * via CSS custom properties, so the whole set is GPU-composited with no
 * per-frame JS. A layer absent from the descriptor (e.g. `honeycomb`'s
 * outgoing layer) keeps rendering as the existing single, non-fragmented
 * copy via {@link getCinematicTransitionAnimations} / p14 resolvers, which
 * remain unchanged as the fallback for previews and any consumer that has
 * not adopted fragment rendering.
 *
 * @module render/slide-transition-fragments
 */

import type { PptxTransitionType } from 'pptx-viewer-core';

import type { FragmentedTransitionDescriptor } from './slide-transition-fragment-types';
import {
	glitterFragments,
	honeycombFragments,
	vortexFragments,
} from './slide-transition-fragments-grid';
import { airplaneFragments, curtainsFragments } from './slide-transition-fragments-panels';
import { fractureFragments, shredFragments } from './slide-transition-fragments-radial';

/**
 * Resolve a cinematic transition type to its multi-fragment descriptor, or
 * `undefined` when the type is not one of the seven fragmented presets (so
 * callers fall back to the single-layer resolvers unchanged).
 */
export function getFragmentedTransitionDescriptor(
	type: PptxTransitionType,
	durationMs: number,
	direction: string | undefined,
	spokes: number | undefined,
	pattern: string | undefined,
): FragmentedTransitionDescriptor | undefined {
	switch (type) {
		case 'vortex':
			return { outgoing: vortexFragments(durationMs, direction, spokes), outgoingOnTop: true };
		case 'honeycomb':
			return { incoming: honeycombFragments(durationMs), outgoingOnTop: true };
		case 'glitter':
			return { incoming: glitterFragments(durationMs), outgoingOnTop: true };
		case 'shred':
			return { outgoing: shredFragments(durationMs, pattern), outgoingOnTop: true };
		case 'fracture':
			return { outgoing: fractureFragments(durationMs), outgoingOnTop: true };
		case 'curtains':
			return { outgoing: curtainsFragments(durationMs), outgoingOnTop: true };
		case 'airplane':
			return { outgoing: airplaneFragments(durationMs), outgoingOnTop: true };
		default:
			return undefined;
	}
}

/**
 * `@keyframes` backing every fragment produced above. One block per preset,
 * shared by every fragment in that layer; per-fragment variance comes
 * entirely from the CSS custom properties each {@link TransitionFragment}
 * carries in its `vars`. Fold into the injected aggregate
 * (`SLIDE_TRANSITION_KEYFRAMES`) so these animate wherever it is injected,
 * with no per-binding wiring.
 */
export const FRAGMENT_TRANSITION_KEYFRAMES = `
/* ── Vortex fragments (dust dissolve + directional clear) ────────────── */
@keyframes pptx-tr-frag-vortex {
	0%   { opacity: 1; transform: scale(1) translate(0, 0); filter: brightness(1); }
	40%  { opacity: .85; transform: scale(.85) translate(var(--frag-dx), var(--frag-dy)); filter: brightness(1.3); }
	100% { opacity: 0; transform: scale(var(--frag-scale-end)) translate(calc(var(--frag-dx) * 2), calc(var(--frag-dy) * 2)); filter: brightness(1.6); }
}

/* ── Honeycomb fragments (hex tile populate) ──────────────────────────── */
@keyframes pptx-tr-frag-honeycomb-in {
	0%   { opacity: 0; transform: scale(var(--frag-scale-start)); }
	60%  { opacity: .7; transform: scale(.92); }
	100% { opacity: 1; transform: scale(1); }
}

/* ── Glitter fragments (diamond sparkle flicker) ──────────────────────── */
@keyframes pptx-tr-frag-glitter-in {
	0%   { opacity: 0; transform: scale(.3) rotate(var(--frag-flicker-rot)); filter: brightness(2); }
	50%  { opacity: .8; transform: scale(1.15) rotate(calc(var(--frag-flicker-rot) * -1)); filter: brightness(1.4); }
	100% { opacity: 1; transform: scale(1) rotate(0deg); filter: brightness(1); }
}

/* ── Shred fragments (radial wedge burst) ─────────────────────────────── */
@keyframes pptx-tr-frag-shred-out {
	0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
	100% { opacity: 0; transform: translate(var(--frag-dx), var(--frag-dy)) rotate(var(--frag-rot)) scale(.4); }
}

/* ── Fracture fragments (irregular shard burst) ───────────────────────── */
@keyframes pptx-tr-frag-fracture-out {
	0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); filter: contrast(1) brightness(1); }
	40%  { opacity: 1; transform: translate(calc(var(--frag-dx) * .3), calc(var(--frag-dy) * .3)) rotate(calc(var(--frag-rot) * .4)) scale(1.05); filter: contrast(1.6) brightness(1.2); }
	100% { opacity: 0; transform: translate(var(--frag-dx), var(--frag-dy)) rotate(var(--frag-rot)) scale(.5); filter: contrast(2) brightness(1.3); }
}

/* ── Curtains fragments (rippling slat lift) ──────────────────────────── */
@keyframes pptx-tr-frag-curtains-out {
	0%   { opacity: 1; transform: scaleY(1) skewX(0deg); }
	100% { opacity: .25; transform: scaleY(0) skewX(var(--frag-skew)); }
}

/* ── Airplane fragments (paper-dart fold + shared flight path) ───────────
   Flight-phase end values match the single-layer pptx-tr-airplane-out
   keyframe (translate3d(150%, -70%, 0) rotate3d(1,-1,1,70deg) scale(.05))
   for continuity with the non-fragment fallback. */
@keyframes pptx-tr-frag-airplane-out {
	0%   { opacity: 1; transform: perspective(900px) rotateY(0deg) rotateX(0deg) translate3d(0, 0, 0) rotate3d(1, -1, 1, 0deg) scale(1); }
	30%  { opacity: 1; transform: perspective(900px) rotateY(var(--frag-fold)) rotateX(var(--frag-fold-x)) translate3d(0, 0, 0) rotate3d(1, -1, 1, 0deg) scale(1); }
	100% { opacity: 0; transform: perspective(900px) rotateY(var(--frag-fold)) rotateX(var(--frag-fold-x)) translate3d(150%, -70%, 0) rotate3d(1, -1, 1, 70deg) scale(.05); }
}
`;

export type {
	FragmentedLayer,
	FragmentedTransitionDescriptor,
	TransitionFragment,
} from './slide-transition-fragment-types';
