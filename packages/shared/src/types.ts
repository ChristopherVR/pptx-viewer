/**
 * Framework-agnostic public types shared by the viewer bindings.
 *
 * These were duplicated in the React (`types-ui.ts`) and Vue (`viewer/types.ts`)
 * packages; this is the canonical copy. Each binding layers its own
 * framework-specific prop/event/handle types on top of these.
 */

/** Canvas dimensions in pixels. */
export interface CanvasSize {
	width: number;
	height: number;
}

/** Collaboration role within a session. */
export type CollaborationRole = 'owner' | 'collaborator' | 'viewer';

/**
 * Real-time collaboration configuration.
 *
 * The collaboration runtime (Yjs) is not yet ported to every binding — this
 * type exists so the public prop surface stays identical across React, Vue,
 * and Angular.
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
	/** Role in the session — defaults to `'collaborator'`. */
	role?: CollaborationRole;
}
