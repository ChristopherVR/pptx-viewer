export { PowerPointViewer, getAnimationInitialStyle } from './PowerPointViewer';
export type { PowerPointViewerProps, PowerPointViewerHandle } from './PowerPointViewer';
export * from './types';

// AI assistant config types (for hosts wiring the optional `ai` prop).
export type {
	PptxAiBridge,
	PptxAiConfig,
	PptxAiConnection,
	PptxAiContextStrategy,
	PptxAiToolName,
	PptxAiWritePolicy,
} from 'pptx-viewer-shared/ai';

// Audience window helpers (opt-in, tree-shakeable).
//
// Sourced from the leaf modules rather than the `presentation-mode` barrel on
// purpose: that barrel is imported by no other module, so when both this entry
// and `internals.ts` pull it in, esbuild has to split it into its own chunk,
// which then tree-shakes down to an empty file ("Generated an empty chunk").
export {
	loadAudienceContent,
	storeAudienceContent,
	clearAudienceContent,
} from './hooks/presentation-mode/audience-content-store';
export { isAudienceTab, parseAudienceNonce } from './hooks/presentation-mode/usePresenterWindow';

// Theme switching (opt-in, tree-shakeable)
export { useThemeSwitching } from './hooks/useThemeSwitching';
export type { UseThemeSwitchingInput, ThemeSwitchingResult } from './hooks/useThemeSwitching';

// Collaboration (opt-in, tree-shakeable)
export {
	useCollaborativeState,
	usePresenceTracking,
	useCollaborativeHistory,
	useYjsProvider,
} from './hooks/collaboration';
export { CollaborationProvider } from './components/collaboration';
export type {
	UserPresence,
	CollaborationConfig,
	CollaborationRole,
	CollaborationContextValue,
	ConnectionStatus,
	UsePresenceTrackingResult,
	UseCollaborativeHistoryResult,
	UseCollaborativeStateInput,
} from './hooks/collaboration';
export {
	RemoteUserCursors,
	UserAvatarBar,
	CollaborationStatusIndicator,
} from './components/collaboration';
export type {
	RemoteUserCursorsProps,
	UserAvatarBarProps,
	CollaborationStatusIndicatorProps,
} from './components/collaboration';
