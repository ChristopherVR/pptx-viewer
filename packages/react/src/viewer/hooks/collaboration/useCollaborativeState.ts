import { sanitizeColor } from 'pptx-viewer-shared';

/**
 * useCollaborativeState: Composes the Yjs provider and presence tracking
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
import type { CollaborationConfig, CollaborationContextValue } from './types';
import { usePresenceTracking } from './usePresenceTracking';
import { useYjsProvider } from './useYjsProvider';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseCollaborativeStateInput {
	/**
	 * Collaboration config, or `undefined` when collaboration is inactive. The
	 * hook is always called so the surrounding provider keeps a stable React
	 * tree shape; it produces a dormant value (no transport, empty presence)
	 * while config is absent.
	 */
	config?: CollaborationConfig;
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
}: UseCollaborativeStateInput): CollaborationContextValue | null {
	const userColor = sanitizeColor(config?.userColor, '#6366f1');

	const { status, awareness, doc, clientId, synced, retry } = useYjsProvider({ config });

	const { remoteUsers, broadcastPresence } = usePresenceTracking({
		awareness,
		localClientId: clientId,
		userName: config?.userName ?? '',
		userColor,
		userAvatar: config?.userAvatar,
		role: config?.role,
		canvasWidth,
		canvasHeight,
	});

	// Total connected = remote users + local (if connected)
	const connectedCount = status === 'connected' ? remoteUsers.length + 1 : remoteUsers.length;

	// Collaboration inactive: all the hooks above ran (and stayed dormant) so the
	// provider keeps a stable tree, but expose a null context value so
	// `useCollaboration()` reports "not collaborating", exactly as before.
	if (!config) {
		return null;
	}

	return {
		status,
		remoteUsers,
		broadcastPresence,
		connectedCount,
		config,
		doc,
		synced,
		retry,
	};
}
