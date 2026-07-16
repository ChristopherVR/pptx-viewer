/**
 * Compatibility exports for presentation setup helpers that now live in the
 * framework-neutral shared package.
 */
export {
	applyRehearsalTimings,
	computeEntranceAnimationDelay,
	shouldLoopContinuously,
	sortEntranceAnimations,
} from 'pptx-viewer-shared';
export type {
	EntranceAnimationEntry as AnimationEntry,
	PresentationLoopInput,
} from 'pptx-viewer-shared';
