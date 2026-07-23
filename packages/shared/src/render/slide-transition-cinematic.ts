/**
 * `slide-transition-cinematic`: animation resolver + `@keyframes` for the
 * Office 2013+ (`p15` namespace) "cinematic" slide-transition family: the 3-D
 * and dramatic composites that ship with modern PowerPoint but have no
 * dedicated case in the classic {@link getSlideTransitionAnimations} switch and
 * therefore used to fall back to a flat symmetrical cross-fade.
 *
 * Handled here (all with real, distinct keyframes):
 *
 *  - 3-D rotations: `cube`, `flip`, `rotate`, `orbit`
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

		case 'orbit':
			return threeDPair('pptx-tr-orbit', resolveDirection(direction, 'left'), dur, false);

		case 'flip':
			return threeDPair('pptx-tr-flip', resolveDirection(direction, 'left'), dur, true);

		case 'rotate': {
			// left/up spin counter-clockwise, right/down clockwise.
			const d = resolveDirection(direction, 'left');
			const spin = d === 'right' || d === 'down' ? 'cw' : 'ccw';
			return {
				outgoing: `pptx-tr-rotate-out-${spin} ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-rotate-in-${spin} ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};
		}

		case 'fallOver':
			// Incoming pivots down over the stationary outgoing slide.
			return {
				outgoing: `pptx-tr-fallover-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fallover-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
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
/* ── Cube (rotate off one edge onto the next face) ──────────────────── */
@keyframes pptx-tr-cube-out-left { from { transform: perspective(1400px) translateX(0) rotateY(0deg); } to { transform: perspective(1400px) translateX(-50%) rotateY(-90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-left { from { transform: perspective(1400px) translateX(50%) rotateY(90deg); opacity: .5; } to { transform: perspective(1400px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-right { from { transform: perspective(1400px) translateX(0) rotateY(0deg); } to { transform: perspective(1400px) translateX(50%) rotateY(90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-right { from { transform: perspective(1400px) translateX(-50%) rotateY(-90deg); opacity: .5; } to { transform: perspective(1400px) translateX(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-up { from { transform: perspective(1400px) translateY(0) rotateX(0deg); } to { transform: perspective(1400px) translateY(-50%) rotateX(90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-up { from { transform: perspective(1400px) translateY(50%) rotateX(-90deg); opacity: .5; } to { transform: perspective(1400px) translateY(0) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-cube-out-down { from { transform: perspective(1400px) translateY(0) rotateX(0deg); } to { transform: perspective(1400px) translateY(50%) rotateX(-90deg); opacity: .5; } }
@keyframes pptx-tr-cube-in-down { from { transform: perspective(1400px) translateY(-50%) rotateX(90deg); opacity: .5; } to { transform: perspective(1400px) translateY(0) rotateX(0deg); opacity: 1; } }

/* ── Orbit (swing the faces through depth) ──────────────────────────── */
@keyframes pptx-tr-orbit-out-left { from { transform: perspective(1600px) translateZ(0) rotateY(0deg); opacity: 1; } to { transform: perspective(1600px) translateZ(-700px) rotateY(-105deg); opacity: 0; } }
@keyframes pptx-tr-orbit-in-left { from { transform: perspective(1600px) translateZ(-700px) rotateY(105deg); opacity: 0; } to { transform: perspective(1600px) translateZ(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-orbit-out-right { from { transform: perspective(1600px) translateZ(0) rotateY(0deg); opacity: 1; } to { transform: perspective(1600px) translateZ(-700px) rotateY(105deg); opacity: 0; } }
@keyframes pptx-tr-orbit-in-right { from { transform: perspective(1600px) translateZ(-700px) rotateY(-105deg); opacity: 0; } to { transform: perspective(1600px) translateZ(0) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-orbit-out-up { from { transform: perspective(1600px) translateZ(0) rotateX(0deg); opacity: 1; } to { transform: perspective(1600px) translateZ(-700px) rotateX(105deg); opacity: 0; } }
@keyframes pptx-tr-orbit-in-up { from { transform: perspective(1600px) translateZ(-700px) rotateX(-105deg); opacity: 0; } to { transform: perspective(1600px) translateZ(0) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-orbit-out-down { from { transform: perspective(1600px) translateZ(0) rotateX(0deg); opacity: 1; } to { transform: perspective(1600px) translateZ(-700px) rotateX(-105deg); opacity: 0; } }
@keyframes pptx-tr-orbit-in-down { from { transform: perspective(1600px) translateZ(-700px) rotateX(105deg); opacity: 0; } to { transform: perspective(1600px) translateZ(0) rotateX(0deg); opacity: 1; } }

/* ── Flip (card flip; opacity hides the back face) ──────────────────── */
@keyframes pptx-tr-flip-out-left { from { transform: perspective(1400px) rotateY(0deg); opacity: 1; } to { transform: perspective(1400px) rotateY(90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-left { from { transform: perspective(1400px) rotateY(-90deg); opacity: 0; } to { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-right { from { transform: perspective(1400px) rotateY(0deg); opacity: 1; } to { transform: perspective(1400px) rotateY(-90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-right { from { transform: perspective(1400px) rotateY(90deg); opacity: 0; } to { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-up { from { transform: perspective(1400px) rotateX(0deg); opacity: 1; } to { transform: perspective(1400px) rotateX(-90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-up { from { transform: perspective(1400px) rotateX(90deg); opacity: 0; } to { transform: perspective(1400px) rotateX(0deg); opacity: 1; } }
@keyframes pptx-tr-flip-out-down { from { transform: perspective(1400px) rotateX(0deg); opacity: 1; } to { transform: perspective(1400px) rotateX(90deg); opacity: 0; } }
@keyframes pptx-tr-flip-in-down { from { transform: perspective(1400px) rotateX(-90deg); opacity: 0; } to { transform: perspective(1400px) rotateX(0deg); opacity: 1; } }

/* ── Rotate (in-plane spin + zoom) ──────────────────────────────────── */
@keyframes pptx-tr-rotate-out-cw { from { transform: rotate(0deg) scale(1); opacity: 1; } to { transform: rotate(90deg) scale(.4); opacity: 0; } }
@keyframes pptx-tr-rotate-in-cw { from { transform: rotate(-90deg) scale(.4); opacity: 0; } to { transform: rotate(0deg) scale(1); opacity: 1; } }
@keyframes pptx-tr-rotate-out-ccw { from { transform: rotate(0deg) scale(1); opacity: 1; } to { transform: rotate(-90deg) scale(.4); opacity: 0; } }
@keyframes pptx-tr-rotate-in-ccw { from { transform: rotate(90deg) scale(.4); opacity: 0; } to { transform: rotate(0deg) scale(1); opacity: 1; } }

/* ── Fall Over (incoming board topples down over outgoing) ──────────── */
@keyframes pptx-tr-fallover-out { from { transform: translateZ(0); opacity: 1; } to { transform: perspective(1400px) rotateX(5deg) scale(.94); opacity: .25; } }
@keyframes pptx-tr-fallover-in { 0% { transform: perspective(1400px) rotateX(-100deg); transform-origin: top center; opacity: .4; } 70% { transform: perspective(1400px) rotateX(8deg); transform-origin: top center; opacity: 1; } 100% { transform: perspective(1400px) rotateX(0deg); transform-origin: top center; opacity: 1; } }

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

/* ── Crush (squash flat, then new slide expands) ────────────────────── */
@keyframes pptx-tr-crush-out { from { transform: scaleY(1); transform-origin: bottom; opacity: 1; } to { transform: scaleY(0); transform-origin: bottom; opacity: .2; } }
@keyframes pptx-tr-crush-in { from { transform: scaleY(0); transform-origin: bottom; opacity: .2; } to { transform: scaleY(1); transform-origin: bottom; opacity: 1; } }

/* ── Peel Off (peel away from a corner) ─────────────────────────────── */
@keyframes pptx-tr-peeloff-out { from { transform: perspective(1400px) rotate3d(1, 1, 0, 0deg); transform-origin: top right; opacity: 1; } to { transform: perspective(1400px) rotate3d(1, 1, 0, 110deg); transform-origin: top right; opacity: .15; } }

/* ── Page Curl (curl off the right edge; double curls new in) ────────── */
@keyframes pptx-tr-pagecurl-out { from { transform: perspective(1600px) rotateY(0deg); transform-origin: right center; opacity: 1; } to { transform: perspective(1600px) rotateY(-155deg); transform-origin: right center; opacity: .25; } }
@keyframes pptx-tr-pagecurl-double-in { from { transform: perspective(1600px) rotateY(155deg); transform-origin: left center; opacity: .25; } to { transform: perspective(1600px) rotateY(0deg); transform-origin: left center; opacity: 1; } }

/* ── Airplane (fly off like a paper plane) ──────────────────────────── */
@keyframes pptx-tr-airplane-out { 0% { transform: perspective(1200px) translate3d(0, 0, 0) rotate3d(1, -1, 0, 0deg) scale(1); opacity: 1; } 40% { transform: perspective(1200px) translate3d(10%, -10%, 0) rotate3d(1, -1, 0, 25deg) scale(.85); opacity: 1; } 100% { transform: perspective(1200px) translate3d(150%, -70%, 0) rotate3d(1, -1, 1, 70deg) scale(.05); opacity: 0; } }

/* ── Origami (fold out / unfold in) ─────────────────────────────────── */
@keyframes pptx-tr-origami-out { from { transform: perspective(1600px) rotateY(0deg) scaleX(1); transform-origin: left center; opacity: 1; } to { transform: perspective(1600px) rotateY(75deg) scaleX(.25); transform-origin: left center; opacity: .2; } }
@keyframes pptx-tr-origami-in { from { transform: perspective(1600px) rotateY(-75deg) scaleX(.25); transform-origin: right center; opacity: .2; } to { transform: perspective(1600px) rotateY(0deg) scaleX(1); transform-origin: right center; opacity: 1; } }
`;
