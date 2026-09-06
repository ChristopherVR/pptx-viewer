/**
 * `slide-transition-cinematic`: animation resolver + `@keyframes` for the
 * Office 2013+ (`p15` namespace) "cinematic" slide-transition family: the 3-D
 * and dramatic composites that ship with modern PowerPoint but have no
 * dedicated case in the classic {@link getSlideTransitionAnimations} switch and
 * therefore used to fall back to a flat symmetrical cross-fade.
 *
 * Handled here (all with real, distinct keyframes):
 *
 *  - 3-D rotations: `cube`, `flip`, `rotate`, `orbit` (kept in this module),
 *    and `box` (split into `slide-transition-box`: it shares Cube's OOXML
 *    element but is COM-measured as visually distinct, so it earns its own
 *    keyframe set rather than reusing Cube's)
 *  - page curl / peel: `pageCurlSingle`, `pageCurlDouble`, `peelOff`
 *  - directional / scale / rotate composites: `fallOver`, `drape`, `curtains`,
 *    `wind`, `prestige`, `fracture`, `crush`, `airplane`, `origami`
 *
 * This mirrors the {@link getP14TransitionAnimations} pattern: the resolver
 * returns `undefined` for any type it does not own, so the core resolver can
 * fall through to its own cases. The `@keyframes` string
 * ({@link CINEMATIC_TRANSITION_KEYFRAMES}) must be injected alongside the core
 * and p14 blocks (it is folded into `SLIDE_TRANSITION_KEYFRAMES`), so every
 * binding that injects that aggregate animates these with no per-binding wiring.
 *
 * All names share the `pptx-tr-*` prefix so they never collide with the
 * element-animation (`pptx-vue-*`) or timeline (`pptx-tl-*`) keyframes. Pure; no
 * framework or DOM imports.
 *
 * @module render/slide-transition-cinematic
 */

import type { PptxTransitionType } from 'pptx-viewer-core';

import {
	BOX_TRANSITION_KEYFRAMES,
	getBoxTransitionAnimations,
	prismDepthPair,
} from './slide-transition-box';
import { ROTATE_TRANSITION_KEYFRAMES } from './slide-transition-rotate';
import { EASE, resolveDirection } from './slide-transition-types';
import type { ResolvedDirection, SlideTransitionAnimations } from './slide-transition-types';

/** Build one directional 3-D pair (`cube` / `flip` / `orbit`) from a resolved dir. */
function threeDPair(
	prefix: string,
	dir: ResolvedDirection,
	dur: string,
	outgoingOnTop: boolean,
): SlideTransitionAnimations {
	return {
		outgoing: `${prefix}-out-${dir} ${dur} ${EASE} forwards`,
		incoming: `${prefix}-in-${dir} ${dur} ${EASE} forwards`,
		outgoingOnTop,
	};
}

/**
 * Resolve a p15 cinematic transition to its CSS `animation` descriptors, or
 * `undefined` when the type is not a cinematic transition (so the caller can
 * fall through to the classic 2-D / p14 resolvers).
 */
export function getCinematicTransitionAnimations(
	type: PptxTransitionType,
	durationMs: number,
	direction: string | undefined,
	orient?: string | undefined,
): SlideTransitionAnimations | undefined {
	const dur = `${durationMs}ms`;
	// Cinematic types key off `direction` (l/r/u/d), never `orient`.
	void orient;

	switch (type) {
		case 'cube':
			return threeDPair('pptx-tr-cube', resolveDirection(direction, 'left'), dur, false);

		// Box shares Cube's OOXML element (`<p14:prism isInverted="1"/>`) but is
		// visually distinct, per COM `CreateVideo` measurement (see
		// `slide-transition-box`): the two faces separate with a depth gap
		// instead of staying joined along one flush hinge.
		case 'box':
			return getBoxTransitionAnimations(durationMs, direction);

		case 'orbit':
			return threeDPair('pptx-tr-orbit', resolveDirection(direction, 'left'), dur, false);

		case 'flip':
			return threeDPair('pptx-tr-flip', resolveDirection(direction, 'left'), dur, true);

		// Rotate shares Cube's OOXML element (`<p14:prism isContent="1"/>`, see
		// `p14-prism-family`) and, per COM measurement, its motion too: see
		// `slide-transition-rotate` for the full writeup.
		case 'rotate':
			return threeDPair('pptx-tr-rotate', resolveDirection(direction, 'left'), dur, false);

		case 'fallOver':
			// MEASURED via COM CreateVideo: the OUTGOING slide topples forward
			// off a top hinge and recedes out of view, revealing the incoming
			// slide beneath it - the reverse of what the pre-measurement
			// keyframes did (an incoming board toppling onto a stationary
			// outgoing). The incoming slide needs no animation of its own: it is
			// simply uncovered as the falling outgoing layer fades away on top.
			return {
				outgoing: `pptx-tr-fallover-out ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};

		case 'drape':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-drape-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};

		case 'curtains':
			// Outgoing lifts like a curtain, revealing the stationary incoming.
			return {
				outgoing: `pptx-tr-curtains-out ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};

		case 'wind': {
			const d = resolveDirection(direction, 'left');
			const side = d === 'right' ? 'right' : 'left';
			return {
				outgoing: `pptx-tr-wind-out-${side} ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};
		}

		case 'prestige':
			return {
				outgoing: `pptx-tr-prestige-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-prestige-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'fracture':
			return {
				outgoing: `pptx-tr-fracture-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'crush':
			return {
				outgoing: `pptx-tr-crush-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-crush-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'peelOff':
			// Outgoing peels off a corner, revealing the stationary incoming.
			return {
				outgoing: `pptx-tr-peeloff-out ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};

		case 'pageCurlSingle':
			return {
				outgoing: `pptx-tr-pagecurl-out ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};

		case 'pageCurlDouble':
			return {
				outgoing: `pptx-tr-pagecurl-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-pagecurl-double-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'airplane':
			return {
				outgoing: `pptx-tr-airplane-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'origami':
			return {
				outgoing: `pptx-tr-origami-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-origami-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		default:
			return undefined;
	}
}

/**
 * `@keyframes` backing every cinematic transition. Fold into the injected
 * aggregate (`SLIDE_TRANSITION_KEYFRAMES`) so these animate wherever it is
 * injected. `pptx-tr-fade-in` (reused by wind/fracture/airplane incoming) is
 * already defined in the core block, so it is intentionally not redefined here.
 */
export const CINEMATIC_TRANSITION_KEYFRAMES = `
${BOX_TRANSITION_KEYFRAMES}
/* ── Cube (rotate off one edge onto the next face) ──────────────────── */
@keyframes pptx-tr-cube-out-left { from { transform: perspective(1400px) translateX(0) rotateY(0deg); } to { transform: perspective(1400px) translateX(-50%) rotateY(-90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-left { from { transform: perspective(1400px) translateX(50%) rotateY(90deg); opacity: .5; } to { transform: perspective(1400px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-right { from { transform: perspective(1400px) translateX(0) rotateY(0deg); } to { transform: perspective(1400px) translateX(50%) rotateY(90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-right { from { transform: perspective(1400px) translateX(-50%) rotateY(-90deg); opacity: .5; } to { transform: perspective(1400px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-up { from { transform: perspective(1400px) translateY(0) rotateX(0deg); } to { transform: perspective(1400px) translateY(-50%) rotateX(90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-up { from { transform: perspective(1400px) translateY(50%) rotateX(-90deg); opacity: .5; } to { transform: perspective(1400px) translateY(0) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-down { from { transform: perspective(1400px) translateY(0) rotateX(0deg); } to { transform: perspective(1400px) translateY(50%) rotateX(-90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-down { from { transform: perspective(1400px) translateY(-50%) rotateX(90deg); opacity: .5; } to { transform: perspective(1400px) translateY(0) rotateX(0deg); opacity: 1; } }

/* ── Orbit (faces separate and recede in depth, like Box, but reached via
   isContent="1" isInverted="1" instead of Box's isInverted="1" alone).
   MEASURED via COM CreateVideo: a real depth gap opens between the two faces
   and both foreshorten in width AND height as they turn, exactly like Box -
   not the flat translateZ-only recede + fade the pre-measurement keyframes
   used, which never opened a gap. Reuses Box's own depth-recede recipe
   (prismDepthPair) under the orbit prefix. ─────────────────────────────── */${prismDepthPair('orbit', 'left', 'X', -1)}${prismDepthPair('orbit', 'right', 'X', 1)}${prismDepthPair('orbit', 'up', 'Y', -1)}${prismDepthPair('orbit', 'down', 'Y', 1)}

/* ── Flip (card flip; opacity hides the back face) ──────────────────── */
@keyframes pptx-tr-flip-out-left { from { transform: perspective(1400px) rotateY(0deg); opacity: 1; } to { transform: perspective(1400px) rotateY(90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-left { from { transform: perspective(1400px) rotateY(-90deg); opacity: 0; } to { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-right { from { transform: perspective(1400px) rotateY(0deg); opacity: 1; } to { transform: perspective(1400px) rotateY(-90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-right { from { transform: perspective(1400px) rotateY(90deg); opacity: 0; } to { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-up { from { transform: perspective(1400px) rotateX(0deg); opacity: 1; } to { transform: perspective(1400px) rotateX(-90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-up { from { transform: perspective(1400px) rotateX(90deg); opacity: 0; } to { transform: perspective(1400px) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-down { from { transform: perspective(1400px) rotateX(0deg); opacity: 1; } to { transform: perspective(1400px) rotateX(90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-down { from { transform: perspective(1400px) rotateX(-90deg); opacity: 0; } to { transform: perspective(1400px) rotateX(0deg); opacity: 1; } }

${ROTATE_TRANSITION_KEYFRAMES}
/* ── Fall Over (the OUTGOING slide topples off a top hinge, revealing the
   incoming slide beneath - MEASURED, the opposite of the old "incoming board
   topples onto outgoing" guess) ──────────────────────────────────────── */
@keyframes pptx-tr-fallover-out { 0% { transform: perspective(1400px) rotateX(0deg) translateY(0) scale(1); transform-origin: top center; opacity: 1; } 55% { transform: perspective(1400px) rotateX(60deg) translateY(6%) scale(.92); transform-origin: top center; opacity: .85; } 100% { transform: perspective(1400px) rotateX(105deg) translateY(22%) scale(.7); transform-origin: top center; opacity: 0; } }

/* ── Drape (fabric draping down into place) ─────────────────────────── */
@keyframes pptx-tr-drape-in { from { transform: perspective(1600px) rotateX(-55deg) scale(1.15); transform-origin: top center; opacity: 0; } to { transform: perspective(1600px) rotateX(0deg) scale(1); transform-origin: top center; opacity: 1; } }

/* ── Curtains (outgoing lifts to reveal incoming) ───────────────────── */
@keyframes pptx-tr-curtains-out { from { transform: scaleY(1); transform-origin: top center; opacity: 1; } to { transform: scaleY(0); transform-origin: top center; opacity: .3; } }

/* ── Wind (outgoing blows away with skew + blur) ────────────────────── */
@keyframes pptx-tr-wind-out-left { from { transform: translateX(0) skewX(0deg); opacity: 1; filter: blur(0); } to { transform: translateX(-120%) skewX(25deg); opacity: 0; filter: blur(6px); } }
@keyframes pptx-tr-wind-out-right { from { transform: translateX(0) skewX(0deg); opacity: 1; filter: blur(0); } to { transform: translateX(120%) skewX(-25deg); opacity: 0; filter: blur(6px); } }

/* ── Prestige (magic vanish then reappear) ──────────────────────────── */
@keyframes pptx-tr-prestige-out { from { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); } to { transform: scale(1.4) rotate(6deg); opacity: 0; filter: blur(8px); } }
@keyframes pptx-tr-prestige-in { from { transform: scale(.6) rotate(-6deg); opacity: 0; filter: blur(8px); } to { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); } }

/* ── Fracture (shatter into contrast + blur) ────────────────────────── */
@keyframes pptx-tr-fracture-out { 0% { transform: scale(1); opacity: 1; filter: contrast(1) blur(0); } 55% { transform: scale(1.04) rotate(1deg); opacity: 1; filter: contrast(1.7) brightness(1.15); } 100% { transform: scale(1.15) rotate(-2deg); opacity: 0; filter: contrast(2.2) blur(4px); } }

/* ── Crush (crumple toward the centre into a small wad, then the new slide
   unfurls the same way in reverse) - MEASURED via COM CreateVideo: the
   outgoing content balls up into an irregular small shape near the centre,
   not the flat bottom-hinged vertical squash the pre-measurement keyframes
   used. A single CSS layer cannot fold into an irregular wad, but scaling
   BOTH axes down unevenly plus a rotation reads far closer to "crumpled"
   than a pure scaleY flattening does. ──────────────────────────────────── */
@keyframes pptx-tr-crush-out { 0% { transform: scale(1, 1) rotate(0deg); opacity: 1; } 60% { transform: scale(.55, .4) rotate(-6deg); opacity: .8; } 100% { transform: scale(.15, .12) rotate(-14deg); opacity: 0; } }
@keyframes pptx-tr-crush-in { 0% { transform: scale(.15, .12) rotate(14deg); opacity: 0; } 40% { transform: scale(.55, .4) rotate(6deg); opacity: .8; } 100% { transform: scale(1, 1) rotate(0deg); opacity: 1; } }

/* ── Peel Off (peel away from a corner) ─────────────────────────────── */
@keyframes pptx-tr-peeloff-out { from { transform: perspective(1400px) rotate3d(1, 1, 0, 0deg); transform-origin: top right; opacity: 1; } to { transform: perspective(1400px) rotate3d(1, 1, 0, 110deg); transform-origin: top right; opacity: .15; } }

/* ── Page Curl (curl off the right edge; double curls new in) ────────── */
@keyframes pptx-tr-pagecurl-out { from { transform: perspective(1600px) rotateY(0deg); transform-origin: right center; opacity: 1; } to { transform: perspective(1600px) rotateY(-155deg); transform-origin: right center; opacity: .25; } }
@keyframes pptx-tr-pagecurl-double-in { from { transform: perspective(1600px) rotateY(155deg); transform-origin: left center; opacity: .25; } to { transform: perspective(1600px) rotateY(0deg); transform-origin: left center; opacity: 1; } }

/* ── Airplane (fly off like a paper plane) ──────────────────────────── */
@keyframes pptx-tr-airplane-out { 0% { transform: perspective(1200px) translate3d(0, 0, 0) rotate3d(1, -1, 0, 0deg) scale(1); opacity: 1; } 40% { transform: perspective(1200px) translate3d(10%, -10%, 0) rotate3d(1, -1, 0, 25deg) scale(.85); opacity: 1; } 100% { transform: perspective(1200px) translate3d(150%, -70%, 0) rotate3d(1, -1, 1, 70deg) scale(.05); opacity: 0; } }

/* ── Origami (fold the sheet over its top edge; the next unfolds up) ──
   The old single-phase rotateY + scaleX compressed the outgoing slide into a
   narrow vertical sliver for most of the (3+ second) duration, which read as
   "just a grey line" instead of paper folding (issue #132). The fold is now
   hinged like a real sheet: the outgoing slide creases over its TOP edge,
   dims as it tips through edge-on, and tumbles away shrinking; the incoming
   slide lies folded at its BOTTOM edge and rises into place. The edge-on
   moment is brief and already mid-fade, so no line artifact survives. */
@keyframes pptx-tr-origami-out { 0% { transform: perspective(1400px) rotateX(0deg) translateY(0) scale(1); transform-origin: top center; opacity: 1; filter: brightness(1); } 45% { transform: perspective(1400px) rotateX(-52deg) translateY(2%) scale(.96); transform-origin: top center; opacity: 1; filter: brightness(.82); } 70% { transform: perspective(1400px) rotateX(-84deg) translateY(8%) scale(.88); transform-origin: top center; opacity: .8; filter: brightness(.68); } 100% { transform: perspective(1400px) rotateX(-125deg) translateY(30%) scale(.68); transform-origin: top center; opacity: 0; filter: brightness(.55); } }
@keyframes pptx-tr-origami-in { 0% { transform: perspective(1400px) rotateX(62deg) scale(.94); transform-origin: bottom center; opacity: 0; filter: brightness(.7); } 30% { transform: perspective(1400px) rotateX(62deg) scale(.94); transform-origin: bottom center; opacity: .65; filter: brightness(.75); } 100% { transform: perspective(1400px) rotateX(0deg) scale(1); transform-origin: bottom center; opacity: 1; filter: brightness(1); } }
`;
