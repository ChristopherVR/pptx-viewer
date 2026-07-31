export { AnimationPlayback } from './animation-playback.svelte';
export type { AnimationPlaybackDeps } from './animation-playback.svelte';
export { applyAnimationStyles } from './apply-animation-styles';
export { ensurePresentationKeyframes } from './keyframes';
export { resolveSlideAutoAdvanceMs } from './presentation-auto-advance';
export type { SlideAutoAdvanceInput } from './presentation-auto-advance';
export { PresentationController } from './presentation-controller.svelte';
export type { PresentationControllerDeps, TransitionState } from './presentation-controller.svelte';
export { PresenterSession } from './presenter-session.svelte';
export { usePresentationEffects } from './presentation-effects.svelte';
export type { PresentationEffectsDeps } from './presentation-effects.svelte';
// .svelte modules must not be re-exported directly from a public barrel (see
// ./transition-overlay.ts).
export { PresentationTransitionOverlay } from './transition-overlay';
export type { PresentationTransitionOverlayProps } from './transition-overlay';
