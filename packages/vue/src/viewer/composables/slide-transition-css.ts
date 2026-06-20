/**
 * `slide-transition-css`: thin re-export shim over the framework-agnostic
 * slide-transition CSS/keyframe generator in `pptx-viewer-shared`.
 *
 * The pure logic (direction/orientation resolution, the `pptx-tr-*` keyframe
 * block, the type→`animation` resolver, and the React/Vue duration policy) now
 * lives in shared and is consumed by every binding. The presentation-mode
 * overlay (`PresentationTransitionOverlay.vue`) keeps the DOM/playback driver
 * and imports the same symbol names from here unchanged.
 *
 * @module composables/slide-transition-css
 */

export type {
	SlideTransitionAnimations,
	ResolvedDirection,
	ResolvedDirection8,
} from 'pptx-viewer-shared';
export {
	resolveDirection,
	resolveDirection8,
	resolveOrientation,
	RANDOM_ELIGIBLE_TYPES,
	INSTANT,
	DEFAULT_TRANSITION_DURATION_MS,
	SLIDE_TRANSITION_KEYFRAMES_CSS,
	getSlideTransitionAnimations,
	resolveSlideTransition,
	resolveTransitionDurationMs,
} from 'pptx-viewer-shared';
