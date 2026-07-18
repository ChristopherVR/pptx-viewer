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
