/**
 * Collaboration types: Shared type definitions for the real-time
 * collaboration infrastructure (Yjs-backed CRDT sync, presence tracking,
 * collaborative editing).
 *
 * @module collaboration/types
 */

import type {
	CollaborationConfig,
	CollaborationRole,
	CollaborationTransport,
} from 'pptx-viewer-shared';
import type { Doc as YDoc } from 'yjs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for enabling real-time collaboration on a presentation.
 *
 * When provided to `PowerPointViewer`, the viewer wraps its content in a
 * `CollaborationProvider` and wires up presence tracking, remote cursors,
 * and CRDT-based state synchronisation.
 */
/**
 * Role of a user within a collaboration or broadcast session.
 *
 * Re-exported from `pptx-viewer-shared` so the React binding shares the
 * canonical union (`'owner' | 'collaborator' | 'viewer'`). The session
 * "owner" is the broadcaster: whoever starts a broadcast owns the session,
 * and followers join as viewers.
 *
 * {@link CollaborationConfig} is the canonical shared shape: it carries the
 * websocket/webrtc `transport`, optional webrtc `signaling` list, and the
 * elected-writer `onWriteBack` / `writeBackDebounceMs` fields in addition to
 * the room/user identity. The React binding accepts it verbatim via the
 * `collaboration` prop.
 */
export type { CollaborationConfig, CollaborationRole, CollaborationTransport };

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

/** Connection lifecycle states for the Yjs WebSocket provider. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/**
 * Presence data broadcast to other participants.
 * Cursor position is relative to the slide canvas (0..canvasWidth, 0..canvasHeight).
 */
export interface UserPresence {
	/** Unique client ID (assigned by Yjs awareness). */
	clientId: number;
	/** Sanitised display name. */
	userName: string;
	/** Optional avatar URL (validated). */
	userAvatar?: string;
	/** Hex colour for the user's cursor ring. */
	userColor: string;
	/** Slide index the user is currently viewing. */
	activeSlideIndex: number;
	/** Cursor X on the canvas (clamped to slide bounds). */
	cursorX: number;
	/** Cursor Y on the canvas (clamped to slide bounds). */
	cursorY: number;
	/** ISO timestamp of last update (for stale-presence cleanup). */
	lastUpdated: string;
	/** Optional currently selected element ID. */
	selectedElementId?: string;
	/** Role in the session (owner, viewer, or collaborator). */
	role?: CollaborationRole;
}

// ---------------------------------------------------------------------------
// Provider context value
// ---------------------------------------------------------------------------

/** Value exposed by `CollaborationContext`. */
export interface CollaborationContextValue {
	/** Current WebSocket connection status. */
	status: ConnectionStatus;
	/** Presence data for all remote users (excludes the local user). */
	remoteUsers: UserPresence[];
	/** Broadcast the local user's presence state. */
	broadcastPresence: (update: Partial<Omit<UserPresence, 'clientId'>>) => void;
	/** Total number of connected users (including local). */
	connectedCount: number;
	/** The collaboration config that was provided. */
	config: CollaborationConfig;
	/** The Yjs document (for document sync). */
	doc: YDoc | null;
	/**
	 * Whether the provider completed its initial document sync (or the
	 * first-write grace period elapsed). Local doc writes are gated on this.
	 */
	synced: boolean;
	/** Manually retry the WebSocket connection after a timeout or error. */
	retry: () => void;
}
