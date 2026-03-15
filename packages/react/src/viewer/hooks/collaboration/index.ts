/**
 * Collaboration hooks barrel export.
 *
 * @module collaboration
 */
export type {
  CollaborationConfig,
  ConnectionStatus,
  UserPresence,
  CollaborationContextValue,
} from "./types";

export { useYjsProvider } from "./useYjsProvider";
export type {
  UseYjsProviderInput,
  UseYjsProviderResult,
} from "./useYjsProvider";

export { usePresenceTracking } from "./usePresenceTracking";
export type {
  UsePresenceTrackingInput,
  UsePresenceTrackingResult,
} from "./usePresenceTracking";

export { useCollaborativeState } from "./useCollaborativeState";
export type { UseCollaborativeStateInput } from "./useCollaborativeState";

export { useCollaborativeHistory } from "./useCollaborativeHistory";
export type {
  UseCollaborativeHistoryInput,
  UseCollaborativeHistoryResult,
} from "./useCollaborativeHistory";

export {
  validateRoomId,
  sanitizeUserName,
  clampCursorPosition,
  sanitizeColor,
  sanitizeAvatarUrl,
  sanitizeSlideIndex,
  sanitizePresence,
} from "./sanitize";
