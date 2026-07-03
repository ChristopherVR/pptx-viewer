/**
 * Collaboration hooks barrel export.
 *
 * @module collaboration
 */
export type {
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
	UserPresence,
	CollaborationContextValue,
} from './types';

export { useYjsProvider } from './useYjsProvider';
export type { UseYjsProviderInput, UseYjsProviderResult } from './useYjsProvider';

export { usePresenceTracking } from './usePresenceTracking';
export type { UsePresenceTrackingInput, UsePresenceTrackingResult } from './usePresenceTracking';

export { useCollaborativeState } from './useCollaborativeState';
export type { UseCollaborativeStateInput } from './useCollaborativeState';

export { useCollaborativeHistory } from './useCollaborativeHistory';
export type {
	UseCollaborativeHistoryInput,
	UseCollaborativeHistoryResult,
} from './useCollaborativeHistory';

export { useYjsDocumentSync } from './useYjsDocumentSync';
export type { UseYjsDocumentSyncInput } from './useYjsDocumentSync';

export { useBroadcastFollower } from './useBroadcastFollower';
export type { UseBroadcastFollowerInput } from './useBroadcastFollower';

export { useFollowMode } from './useFollowMode';
export type { UseFollowModeInput, UseFollowModeResult } from './useFollowMode';

export {
	validateRoomId,
	sanitizeUserName,
	clampCursorPosition,
	sanitizeColor,
	sanitizeAvatarUrl,
	sanitizeSlideIndex,
	sanitizePresence,
} from 'pptx-viewer-shared';
