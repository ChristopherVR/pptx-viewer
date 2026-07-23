/**
 * `slide-transition-css` — pure mapping from a {@link PptxSlideTransition}
 * (type + duration + direction/orientation) to the CSS `animation` shorthand
 * pieces used by each binding's presentation-mode transition overlay during a
 * slide change.
 *
 * Consolidates the React `transition-resolver` / `transition-helpers` /
 * `transition-keyframes` trio, the Vue `slide-transition-css`, and the Angular
 * `transition-helpers` into one framework-agnostic module:
 *
 *  - {@link getSlideTransitionAnimations} resolves a transition to the
 *    `animation` shorthand strings for the outgoing (old) and incoming (new)
 *    slide layers, plus whether the outgoing layer sits on top.
 *  - the `@keyframes` referenced live in `slide-transition-keyframes`
 *    (`SLIDE_TRANSITION_KEYFRAMES`), injected once via a `<style>` element.
 *
 * Superset note: the exotic / 3-D transition family (`pan`/`gallery`/
 * `conveyor`/`reveal`/`doors`/`switch`/`flythrough`/`ferris`/`prism`/`ripple`/
 * `honeycomb`/`glitter`/`shred`/`flash`/`vortex`/`warp`/`wheelReverse`/`window`)
 * is rendered faithfully by delegating to {@link getP14TransitionAnimations}
 * (its `@keyframes` live in `p14-transition-keyframes` and are folded into
 * `SLIDE_TRANSITION_KEYFRAMES`). The newer Office 2013+ (p15) cinematic family
 * (`cube`/`flip`/`rotate`/`orbit`/`fallOver`/`drape`/`curtains`/`wind`/
 * `prestige`/`fracture`/`crush`/`peelOff`/`pageCurlSingle`/`pageCurlDouble`/
 * `airplane`/`origami`) is likewise rendered faithfully via
 * {@link getCinematicTransitionAnimations} (its `@keyframes` live in
 * `slide-transition-cinematic` as `CINEMATIC_TRANSITION_KEYFRAMES`). Only truly
 * unknown types fall back to a symmetrical cross-fade.
 *
 * Everything here is pure and unit-testable: no framework imports, no DOM.
 *
 * @module render/slide-transition-css
 */

import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import { getP14TransitionAnimations } from './p14-transition-css';
import { getCinematicTransitionAnimations } from './slide-transition-cinematic';
import {
	DEFAULT_TRANSITION_DURATION_MS,
	EASE,
	INSTANT,
	RANDOM_ELIGIBLE_TYPES,
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
} from './slide-transition-types';
import type {
	ResolvedDirection,
	ResolvedDirection8,
	SlideTransitionAnimations,
} from './slide-transition-types';

/**
 * Map a {@link PptxTransitionType} (+ duration/direction/orient/spokes) to the
 * concrete CSS `animation` descriptors for the outgoing and incoming layers.
 *
 * Unknown types fall back to a symmetrical cross-fade.
 */
export function getSlideTransitionAnimations(
	type: PptxTransitionType,
	durationMs: number,
	direction: string | undefined,
	orient?: string | undefined,
	spokes?: number | undefined,
): SlideTransitionAnimations {
	const dur = `${durationMs}ms`;
	// `spokes` is reserved for future wheel spoke-count support; forwarded only
	// through recursive calls (random / pull aliases).
	void spokes;

	// Prefer the faithful Office 2010 (p14) keyframe set for the exotic / 3-D
	// transition family (conveyor/doors/ferris/flash/flythrough/gallery/glitter/
	// honeycomb/pan/prism/reveal/ripple/shred/switch/vortex/warp/wheelReverse/
	// window). Returns `undefined` for the classic set, which falls through to
	// the 2-D CSS cases below. The p14 `@keyframes` are folded into
	// `SLIDE_TRANSITION_KEYFRAMES`, so every binding that injects that block
	// animates these faithfully with no per-binding wiring.
	const p14 = getP14TransitionAnimations(type, durationMs, direction, orient);
	if (p14) {
		return p14;
	}

	// The Office 2013+ (p15) cinematic family (cube/flip/rotate/orbit/fallOver/
	// drape/curtains/wind/prestige/fracture/crush/peelOff/pageCurlSingle/
	// pageCurlDouble/airplane/origami) is rendered with real 3-D / composite
	// keyframes. Returns `undefined` for every other type so the classic 2-D
	// cases below still run. Its `@keyframes` (`CINEMATIC_TRANSITION_KEYFRAMES`)
	// are folded into `SLIDE_TRANSITION_KEYFRAMES`.
	const cinematic = getCinematicTransitionAnimations(type, durationMs, direction, orient);
	if (cinematic) {
		return cinematic;
	}

	switch (type) {
		case 'none':
		case 'cut':
			return INSTANT;

		case 'fade':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'push': {
			const dir = resolveDirection(direction, 'left');
			const configs: Record<ResolvedDirection, SlideTransitionAnimations> = {
				left: {
					outgoing: `pptx-tr-push-out-to-left ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-right ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				right: {
					outgoing: `pptx-tr-push-out-to-right ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-left ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				up: {
					outgoing: `pptx-tr-push-out-to-top ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-bottom ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
				down: {
					outgoing: `pptx-tr-push-out-to-bottom ${dur} ${EASE} forwards`,
					incoming: `pptx-tr-push-in-from-top ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				},
			};
			return configs[dir];
		}

		case 'wipe': {
			const dir = resolveDirection(direction, 'left');
			const wipeNames: Record<ResolvedDirection, string> = {
				left: `pptx-tr-wipe-from-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-wipe-from-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-wipe-from-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-wipe-from-bottom ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: wipeNames[dir],
				outgoingOnTop: false,
			};
		}

		case 'cover': {
			const dir = resolveDirection8(direction, 'left');
			const coverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-cover-from-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-cover-from-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-cover-from-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-cover-from-bottom ${dur} ${EASE} forwards`,
				lu: `pptx-tr-cover-from-lu ${dur} ${EASE} forwards`,
				ld: `pptx-tr-cover-from-ld ${dur} ${EASE} forwards`,
				ru: `pptx-tr-cover-from-ru ${dur} ${EASE} forwards`,
				rd: `pptx-tr-cover-from-rd ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: 'none',
				incoming: coverMap[dir],
				outgoingOnTop: false,
			};
		}

		case 'uncover': {
			const dir = resolveDirection8(direction, 'left');
			const uncoverMap: Record<ResolvedDirection8, string> = {
				left: `pptx-tr-uncover-to-left ${dur} ${EASE} forwards`,
				right: `pptx-tr-uncover-to-right ${dur} ${EASE} forwards`,
				up: `pptx-tr-uncover-to-top ${dur} ${EASE} forwards`,
				down: `pptx-tr-uncover-to-bottom ${dur} ${EASE} forwards`,
				lu: `pptx-tr-uncover-to-lu ${dur} ${EASE} forwards`,
				ld: `pptx-tr-uncover-to-ld ${dur} ${EASE} forwards`,
				ru: `pptx-tr-uncover-to-ru ${dur} ${EASE} forwards`,
				rd: `pptx-tr-uncover-to-rd ${dur} ${EASE} forwards`,
			};
			return {
				outgoing: uncoverMap[dir],
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		case 'split': {
			const o = resolveOrientation(undefined, orient);
			const isOut = direction !== 'in';
			if (isOut) {
				return {
					outgoing: 'none',
					incoming:
						o === 'vert'
							? `pptx-tr-split-v-out ${dur} ${EASE} forwards`
							: `pptx-tr-split-h-out ${dur} ${EASE} forwards`,
					outgoingOnTop: false,
				};
			}
			return {
				outgoing:
					o === 'vert'
						? `pptx-tr-split-v-in ${dur} ${EASE} forwards`
						: `pptx-tr-split-h-in ${dur} ${EASE} forwards`,
				incoming: 'none',
				outgoingOnTop: true,
			};
		}

		case 'dissolve':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-dissolve-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'circle':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-circle-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'diamond':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-diamond-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'plus':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-plus-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'wedge':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wedge-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		case 'wheel':
			return {
				outgoing: 'none',
				incoming: `pptx-tr-wheel-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};

		case 'zoom':
			return {
				outgoing: `pptx-tr-zoom-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-zoom-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'blinds': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-blinds-v ${dur} ${EASE} forwards`
						: `pptx-tr-blinds-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'checker':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-checker-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'comb': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-comb-v ${dur} ${EASE} forwards`
						: `pptx-tr-comb-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'strips': {
			const stripDir =
				direction === 'lu' || direction === 'ld' || direction === 'ru' || direction === 'rd'
					? direction
					: 'lu';
			return {
				outgoing: 'none',
				incoming: `pptx-tr-strips-${stripDir} ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'randomBar': {
			const o = resolveOrientation(direction, orient);
			return {
				outgoing: 'none',
				incoming:
					o === 'vert'
						? `pptx-tr-randombar-v ${dur} ${EASE} forwards`
						: `pptx-tr-randombar-h ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};
		}

		case 'newsflash':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-newsflash-in ${dur} ${EASE} forwards`,
				outgoingOnTop: false,
			};

		// `pull` is the directional alias of `uncover`.
		case 'pull':
			return getSlideTransitionAnimations('uncover', durationMs, direction, orient, spokes);

		case 'morph':
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};

		case 'random': {
			const randomType =
				RANDOM_ELIGIBLE_TYPES[Math.floor(Math.random() * RANDOM_ELIGIBLE_TYPES.length)];
			return getSlideTransitionAnimations(randomType, durationMs, direction, orient, spokes);
		}

		// The exotic / 3-D transition family (conveyor/doors/ferris/flash/
		// flythrough/gallery/glitter/honeycomb/pan/prism/reveal/ripple/shred/
		// switch/vortex/warp/wheelReverse/window) is handled faithfully above via
		// `getP14TransitionAnimations` and never reaches this switch.

		// Fallback (genuinely unknown / not-yet-mapped type). The p14 exotic set
		// and the p15 cinematic set are handled above and never reach here.
		// Symmetrical cross-fade.
		default:
			return {
				outgoing: `pptx-tr-fade-out ${dur} ${EASE} forwards`,
				incoming: `pptx-tr-fade-in ${dur} ${EASE} forwards`,
				outgoingOnTop: true,
			};
	}
}

/**
 * Convenience wrapper that reads everything off a {@link PptxSlideTransition},
 * applying the React/Vue default duration when none is set. `none`/`cut` and a
 * transition with a non-positive duration resolve to {@link INSTANT}.
 */
export function resolveSlideTransition(
	transition: PptxSlideTransition | undefined,
): SlideTransitionAnimations {
	if (!transition || transition.type === 'none' || transition.type === 'cut') {
		return INSTANT;
	}
	const durationMs =
		typeof transition.durationMs === 'number' && transition.durationMs > 0
			? transition.durationMs
			: DEFAULT_TRANSITION_DURATION_MS;
	return getSlideTransitionAnimations(
		transition.type,
		durationMs,
		transition.direction,
		transition.orient,
		transition.spokes,
	);
}

/**
 * The effective duration (ms) for a transition under the React/Vue policy — the
 * configured `durationMs`, or {@link DEFAULT_TRANSITION_DURATION_MS} when
 * unset/invalid. `none`/`cut` resolve to `0` (instant).
 */
export function resolveTransitionDurationMs(transition: PptxSlideTransition | undefined): number {
	if (!transition || transition.type === 'none' || transition.type === 'cut') {
		return 0;
	}
	return typeof transition.durationMs === 'number' && transition.durationMs > 0
		? transition.durationMs
		: DEFAULT_TRANSITION_DURATION_MS;
}
