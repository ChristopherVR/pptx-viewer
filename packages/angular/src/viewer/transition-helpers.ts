/**
 * transition-helpers.ts
 *
 * Thin re-export shim over the framework-agnostic slide-transition CSS/keyframe
 * generator in `pptx-viewer-shared` (vendored via `../internal/shared`).
 *
 * The pure logic — direction/orientation resolution, the `pptx-tr-*` keyframe
 * block (`SLIDE_TRANSITION_KEYFRAMES`), and the type→`animation` resolver
 * (`getSlideTransitionAnimations`, including the exotic/3-D 2-D approximations
 * that originated here) — now lives in shared and is consumed by every binding.
 *
 * Angular keeps its OWN duration policy locally: the presentation overlay floors
 * very short authored durations and uses a smaller default than React/Vue, so
 * `MIN_TRANSITION_DURATION_MS` / `DEFAULT_TRANSITION_DURATION_MS` /
 * `resolveTransitionDuration` are defined here rather than re-exported from
 * shared (whose `DEFAULT_TRANSITION_DURATION_MS` is the larger React/Vue value).
 *
 * `PresentationTransitionOverlayComponent` imports the same symbol names from
 * here unchanged.
 */
export type {
	SlideTransitionAnimations,
	ResolvedDirection,
	ResolvedDirection8,
} from '../internal/shared';
export {
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
	SLIDE_TRANSITION_KEYFRAMES,
	getSlideTransitionAnimations,
} from '../internal/shared';

// ---------------------------------------------------------------------------
// Angular-specific duration policy (deliberately diverges from React/Vue)
// ---------------------------------------------------------------------------

/**
 * Floor applied to the transition duration so very short authored durations
 * still produce a visible animation. Mirrors the React presentation hook.
 */
export const MIN_TRANSITION_DURATION_MS = 120;

/** Fallback transition duration when the slide declares none. */
export const DEFAULT_TRANSITION_DURATION_MS = 320;

/**
 * Resolve the effective transition duration (ms) from an optional authored
 * value, applying the minimum floor and a sensible default. Mirrors the React
 * `executeSlideTransition` clamping (`Math.max(120, durationMs || 320)`).
 */
export function resolveTransitionDuration(durationMs: number | undefined): number {
	const raw =
		typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
			? durationMs
			: DEFAULT_TRANSITION_DURATION_MS;
	return Math.max(MIN_TRANSITION_DURATION_MS, raw);
}
