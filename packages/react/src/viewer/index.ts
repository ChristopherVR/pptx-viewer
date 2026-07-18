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

// Audience window helpers (opt-in, tree-shakeable)
export {
	isAudienceTab,
	loadAudienceContent,
	storeAudienceContent,
	clearAudienceContent,
	parseAudienceNonce,
} from './hooks/presentation-mode';

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
