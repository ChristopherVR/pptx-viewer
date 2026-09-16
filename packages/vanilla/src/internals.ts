/**
 * `pptx-vanilla-viewer/internals` - internal building blocks not covered by
 * semver; prefer the stable `pptx-vanilla-viewer` root export where it covers
 * what you need.
 *
 * This entry exists to close a gap reported in issue #290: `pptx-viewer-shared`
 * is a private, unpublished workspace package (see
 * `packages/shared/README.md`), so a host embedding its own presentation
 * surface had no supported way to reach the framework-neutral slide-transition
 * resolver/keyframes it bundles, or the DOM-level transition overlay driver.
 *
 * Currently scoped to that surface: the slide-transition resolver/keyframes
 * (mirrors the same re-export from `pptx-react-viewer/internals`,
 * `pptx-vue-viewer/internals`, `pptx-angular-viewer/internals` and
 * `pptx-svelte-viewer/internals`) and `playTransitionOverlay`, the Vanilla
 * binding's DOM-driven equivalent of the other bindings' transition overlay
 * component (Vanilla has no component model to render one against). Unlike
 * the other bindings' `internals` entries (which re-export a much larger set
 * of internal building blocks), this one did not exist before this change; it
 * is intentionally started small and can grow the same way the others did.
 */

// ── Slide-transition helpers (issue #290) ──────────────────────────────
export {
	getSlideTransitionAnimations,
	resolveSlideTransition,
	resolveTransitionDurationMs,
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	resolveWheelSpokeCount,
	getCinematicTransitionAnimations,
	getP14TransitionAnimations,
	SLIDE_TRANSITION_KEYFRAMES,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
	DEFAULT_TRANSITION_DURATION_MS,
	DEFAULT_MORPH_DURATION_MS,
	TRANSITION_SPEED_DURATION_MS,
	EASE,
	WHEEL_SPOKE_COUNTS,
	CINEMATIC_TRANSITION_KEYFRAMES,
	P14_TRANSITION_KEYFRAMES,
	P14_TRANSITION_KEYFRAMES_2,
	P14_TRANSITION_KEYFRAMES_ALL,
} from 'pptx-viewer-shared';
export type {
	SlideTransitionAnimations,
	ResolvedDirection,
	ResolvedDirection8,
} from 'pptx-viewer-shared';

// The DOM-level transition overlay driver itself (not just the resolver it
// calls), for a host embedding its own presentation surface.
export { playTransitionOverlay } from './viewer/animation/transition-overlay';
export type { TransitionOverlayParams } from './viewer/animation/transition-overlay';
