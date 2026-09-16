/**
 * transition-helpers.ts
 *
 * Thin re-export shim over the framework-agnostic slide-transition CSS/keyframe
 * generator in `pptx-viewer-shared` (vendored via `../internal/shared`).
 *
 * The pure logic (direction/orientation resolution, the `pptx-tr-*` keyframe
 * block (`SLIDE_TRANSITION_KEYFRAMES`), and the type→`animation` resolver
 * (`getSlideTransitionAnimations`, including the exotic/3-D 2-D approximations
 * that originated here) now lives in shared and is consumed by every binding.
 *
 * The presentation overlay's duration comes from the shared resolver
 * (`resolveTransitionDurationMs`), exactly as in the other four bindings, so
 * an authored `p14:dur`, the legacy `spd` token and the COM-verified defaults
 * all play at PowerPoint's speed here too. The older local floor/default
 * policy (`MIN_TRANSITION_DURATION_MS` / `DEFAULT_TRANSITION_DURATION_MS` /
 * `resolveTransitionDuration`) stays exported for callers that adopted it, but
 * the overlay no longer consults it.
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';

import { resolveTransitionDurationMs } from '../internal/shared';

export type {
	SlideTransitionAnimations,
	ResolvedDirection,
	ResolvedDirection8,
} from '../internal/shared';
export {
	DEFAULT_MORPH_DURATION_MS,
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
	SLIDE_TRANSITION_KEYFRAMES,
	getSlideTransitionAnimations,
} from '../internal/shared';
// The rest of the framework-neutral slide-transition surface (issue #290):
// `resolveSlideTransition` / `resolveTransitionDurationMs` (the whole-transition
// convenience wrappers), the p14/cinematic sub-resolvers and their keyframe
// blocks, and the remaining duration/direction constants. `resolveOverlayDurationMs`
// below already calls `resolveTransitionDurationMs`; it is re-exported here too
// so `pptx-angular-viewer` (and `pptx-angular-viewer/internals`, which is the
// same compiled bundle, see `src/internals.ts`) exposes it under its own name
// like every other binding.
//
// `DEFAULT_TRANSITION_DURATION_MS` is intentionally NOT re-exported from
// `../internal/shared` here: this file already exports a same-named constant
// below with Angular's own (smaller, floored) default, and the two must not
// collide. Shared's value is exposed under `SHARED_DEFAULT_TRANSITION_DURATION_MS`
// instead.
export {
	resolveSlideTransition,
	resolveTransitionDurationMs,
	getCinematicTransitionAnimations,
	getP14TransitionAnimations,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
	CINEMATIC_TRANSITION_KEYFRAMES,
	P14_TRANSITION_KEYFRAMES,
	P14_TRANSITION_KEYFRAMES_2,
	P14_TRANSITION_KEYFRAMES_ALL,
	TRANSITION_SPEED_DURATION_MS,
	EASE,
	WHEEL_SPOKE_COUNTS,
	resolveWheelSpokeCount,
	DEFAULT_TRANSITION_DURATION_MS as SHARED_DEFAULT_TRANSITION_DURATION_MS,
} from '../internal/shared';

// ---------------------------------------------------------------------------
// Legacy local duration policy (no longer used by the overlay)
// ---------------------------------------------------------------------------

/**
 * Floor applied by {@link resolveTransitionDuration} so very short authored
 * durations still produce a visible animation.
 */
export const MIN_TRANSITION_DURATION_MS = 120;

/** Fallback used by {@link resolveTransitionDuration} when nothing is authored. */
export const DEFAULT_TRANSITION_DURATION_MS = 320;

/**
 * Resolve an effective duration (ms) from an optional authored value, applying
 * the minimum floor and the local default. Kept as a public helper; the
 * presentation overlay resolves through the shared
 * {@link resolveOverlayDurationMs} instead, which is what plays on screen.
 */
export function resolveTransitionDuration(durationMs: number | undefined): number {
	const raw =
		typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
			? durationMs
			: DEFAULT_TRANSITION_DURATION_MS;
	return Math.max(MIN_TRANSITION_DURATION_MS, raw);
}

/**
 * The presentation overlay's effective duration (ms): an explicit override
 * wins; otherwise the shared resolver decides for EVERY type, honouring an
 * authored `p14:dur`, then the legacy `spd` token (COM-measured: fast 0.5s,
 * med 0.75s, slow 1.0s), then PowerPoint's default (0.5s for a morph, 1s
 * otherwise).
 *
 * Classic transitions used to keep a local 320ms default that ignored `spd`,
 * so a `spd="slow"` wipe PowerPoint plays over a full second flashed past in
 * a third of that here while React, Vue, Svelte and Vanilla all played it at
 * 1s. Nothing about that was Angular-specific; the divergence is gone.
 */
export function resolveOverlayDurationMs(
	override: number | undefined,
	transition: PptxSlideTransition,
): number {
	if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
		return override;
	}
	return resolveTransitionDurationMs(transition);
}

// ---------------------------------------------------------------------------
// Outgoing-layer geometry
// ---------------------------------------------------------------------------

/**
 * Footprint (px) of the outgoing slide box inside the transition overlay.
 *
 * It has to be the ZOOMED slide size, because the overlay sits inside the same
 * stage container as the live `pptx-slide-canvas` and that canvas is already
 * rendering at the stage zoom. Sizing the box at the intrinsic canvas size (and
 * leaving the inner canvas at `zoom=1`) makes the leaving slide animate out at
 * 100% while the arriving slide is full-screen, which reads as the slide
 * snapping small the moment a transition starts.
 *
 * A missing or non-positive zoom degrades to 1 rather than collapsing the box.
 */
export function transitionSlideBoxSize(
	canvasSize: { width: number; height: number },
	zoom: number,
): { width: number; height: number } {
	const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return {
		width: Math.max(canvasSize.width * safeZoom, 1),
		height: Math.max(canvasSize.height * safeZoom, 1),
	};
}
