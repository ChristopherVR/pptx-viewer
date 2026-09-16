/**
 * `pptx-svelte-viewer/internals` - internal building blocks not covered by
 * semver; prefer the stable root (`pptx-svelte-viewer`) and
 * `pptx-svelte-viewer/viewer` exports where they cover what you need.
 *
 * This entry exists to close a gap reported in issue #290: `pptx-viewer-shared`
 * is a private, unpublished workspace package (see
 * `packages/shared/README.md`), so a host embedding its own presentation
 * stage (a custom `SlideStage`, outside the full `PowerPointViewer`) had no
 * supported way to reach the framework-neutral slide-transition
 * resolver/keyframes it bundles, or the transition overlay component itself.
 *
 * Currently scoped to that surface: the slide-transition resolver/keyframes
 * (mirrors the same re-export from `pptx-react-viewer/internals`,
 * `pptx-vue-viewer/internals` and `pptx-angular-viewer/internals`) and the
 * presentation-mode transition overlay component. Unlike the other bindings'
 * `internals` entries (which re-export the FULL set of internal building
 * blocks composing their main viewer component), Svelte's did not exist
 * before this change; it is intentionally started small rather than
 * attempting a full internals sweep in the same change, and can grow the same
 * way the others did.
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

// The presentation-mode transition overlay component itself (not just the
// resolver it calls), for a host embedding its own presentation surface.
// Already typed through `./viewer/presentation/transition-overlay` (a raw
// `.svelte` re-export from a barrel cannot be resolved by the declaration
// bundler; see that file's own header comment).
export { PresentationTransitionOverlay } from './viewer/presentation/transition-overlay';
export type { PresentationTransitionOverlayProps } from './viewer/presentation/transition-overlay';
