/**
 * useCollaborativeState — Composes the Yjs provider and presence tracking
 * into a single hook for the collaboration system.
 *
 * This is the primary hook consumed by the `CollaborationProvider` context.
 * It orchestrates:
 * - Yjs WebSocket connection lifecycle
 * - Presence tracking (broadcast + receive)
 * - Connection status
 *
 * @module collaboration/useCollaborativeState
 */
import type { CollaborationConfig, CollaborationContextValue } from "./types";
import { useYjsProvider } from "./useYjsProvider";
import { usePresenceTracking } from "./usePresenceTracking";
import { sanitizeColor } from "./sanitize";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseCollaborativeStateInput {
  config: CollaborationConfig;
  canvasWidth: number;
  canvasHeight: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCollaborativeState({
  config,
  canvasWidth,
  canvasHeight,
}: UseCollaborativeStateInput): CollaborationContextValue {
  const userColor = sanitizeColor(config.userColor, "#6366f1");

  const { status, awareness, clientId } = useYjsProvider({ config });

  const { remoteUsers, broadcastPresence } = usePresenceTracking({
    awareness,
    localClientId: clientId,
    userName: config.userName,
    userColor,
    userAvatar: config.userAvatar,
    canvasWidth,
    canvasHeight,
  });

  // Total connected = remote users + local (if connected)
  const connectedCount =
    status === "connected" ? remoteUsers.length + 1 : remoteUsers.length;

  return {
    status,
    remoteUsers,
    broadcastPresence,
    connectedCount,
    config,
  };
}
