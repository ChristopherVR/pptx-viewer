/**
 * Collaboration types — Shared type definitions for the real-time
 * collaboration infrastructure (Yjs-backed CRDT sync, presence tracking,
 * collaborative editing).
 *
 * @module collaboration/types
 */

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
export interface CollaborationConfig {
  /** Unique identifier for the collaboration room (alphanumeric, hyphens, underscores). */
  roomId: string;
  /** WebSocket server URL for the Yjs provider (e.g. "wss://collab.example.com"). */
  serverUrl: string;
  /** Display name for the local user. */
  userName: string;
  /** Avatar URL for the local user (optional). */
  userAvatar?: string;
  /** Hex colour for the local user's cursor/presence indicator. */
  userColor?: string;
  /** Optional authentication token sent with the WebSocket handshake. */
  authToken?: string;
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

/** Connection lifecycle states for the Yjs WebSocket provider. */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

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
  broadcastPresence: (update: Partial<Omit<UserPresence, "clientId">>) => void;
  /** Total number of connected users (including local). */
  connectedCount: number;
  /** The collaboration config that was provided. */
  config: CollaborationConfig;
}
