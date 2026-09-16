// ── Internal building blocks. Not covered by semver; prefer the stable root exports. ──
//
// These are the same hooks `PowerPointViewer` composes internally. They are exposed here for
// advanced integrations that need finer-grained control than the component or the curated
// `pptx-react-viewer/viewer` entry provide.

export * from './viewer/hooks';

// Hooks that exist in the source tree but aren't part of the main composition barrel.
export { useClipboardHandlers } from './viewer/hooks/useClipboardHandlers';

export { useDerivedElementState } from './viewer/hooks/useDerivedElementState';
export type {
	UseDerivedElementStateInput,
	DerivedElementState,
} from './viewer/hooks/useDerivedElementState';

export { useDialogCustomShows } from './viewer/hooks/useDialogCustomShows';
export type {
	UseDialogCustomShowsInput,
	UseDialogCustomShowsResult,
} from './viewer/hooks/useDialogCustomShows';

export { useExportSaveAs } from './viewer/hooks/useExportSaveAs';
export type { UseExportSaveAsInput, ExportSaveAsResult } from './viewer/hooks/useExportSaveAs';

export { useFontInjection } from './viewer/hooks/useFontInjection';
export type { UseFontInjectionInput } from './viewer/hooks/useFontInjection';

export { useGroupAlignLayerHandlers } from './viewer/hooks/useGroupAlignLayerHandlers';

export { useKeyboardShortcuts } from './viewer/hooks/useKeyboardShortcuts';
export type { UseKeyboardShortcutsInput } from './viewer/hooks/useKeyboardShortcuts';

export { useMergeShapesHandler } from './viewer/hooks/useMergeShapesHandler';
export type {
	MergeShapesHandlerInput,
	MergeShapesHandlers,
} from './viewer/hooks/useMergeShapesHandler';

export { useResizablePanels } from './viewer/hooks/useResizablePanels';
export type { UseResizablePanelsResult } from './viewer/hooks/useResizablePanels';

export { useSwipeNavigation } from './viewer/hooks/useSwipeNavigation';
export type {
	UseSwipeNavigationInput,
	UseSwipeNavigationResult,
} from './viewer/hooks/useSwipeNavigation';

// Additional collaboration hooks not part of the curated `pptx-react-viewer/viewer` export.
export {
	useYjsProvider,
	useYjsDocumentSync,
	useBroadcastFollower,
	useFollowMode,
} from './viewer/hooks/collaboration';
export type {
	UseYjsProviderInput,
	UseYjsProviderResult,
	UseYjsDocumentSyncInput,
	UseBroadcastFollowerInput,
	UseFollowModeInput,
	UseFollowModeResult,
} from './viewer/hooks/collaboration';

// Additional presentation-mode hooks not part of the curated `pptx-react-viewer/viewer` export.
export {
	useAnimationPlayback,
	usePresentationKeyboard,
	usePresenterWindow,
	useAudienceMode,
	useRehearsalTimings,
	useSlideNavigation,
	useZoomNavigation,
} from './viewer/hooks/presentation-mode';
export type {
	UseAnimationPlaybackInput,
	UseAnimationPlaybackResult,
	UseRehearsalTimingsInput,
	UseRehearsalTimingsResult,
	UsePresenterWindowInput,
	UsePresenterWindowResult,
	UseSlideNavigationInput,
	UseSlideNavigationResult,
	UseZoomNavigationInput,
	UseZoomNavigationResult,
} from './viewer/hooks/presentation-mode';

// ── Slide-transition helpers (issue #290) ──────────────────────────────
//
// `pptx-viewer-shared` is a private, unpublished workspace package (see
// `packages/shared/README.md`), so a host embedding its own presentation
// stage cannot reach the framework-neutral transition resolver/keyframes it
// bundles. Re-exported here, verbatim, so `pptx-react-viewer/internals` is
// the one place every binding's transition surface is reachable from.
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

// The presentation-mode transition overlay components themselves (not just the
// resolver they call), for a host embedding its own `SlideStage` / presentation
// surface instead of the full `PowerPointViewer`.
export { PresentationTransitionOverlay } from './viewer/components/PresentationTransitionOverlay';
export type { PresentationTransitionOverlayProps } from './viewer/components/PresentationTransitionOverlay';
export { MorphTransitionOverlay } from './viewer/components/MorphTransitionOverlay';
export type { MorphTransitionOverlayProps } from './viewer/components/MorphTransitionOverlay';
export { SlideLayer } from './viewer/components/SlideTransitionSlideLayer';
export type { SlideLayerProps } from './viewer/components/SlideTransitionSlideLayer';
export { FragmentedTransitionLayer } from './viewer/components/FragmentedTransitionLayer';
export type { FragmentedTransitionLayerProps } from './viewer/components/FragmentedTransitionLayer';
