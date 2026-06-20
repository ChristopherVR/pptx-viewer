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
	/**
	 * Elected-writer write-back callback (Area 3 of the C3 hardening plan).
	 *
	 * When the local user has `role: 'owner'`, the binding debounces changes and
	 * serializes the current Y.Doc state to a PPTX byte array, then calls this
	 * callback so the host can persist the snapshot. Only one writer (the owner)
	 * does this; other collaborators never trigger write-back, eliminating the
	 * last-save-wins problem.
	 */
	onWriteBack?: (bytes: Uint8Array) => void;
	/**
	 * Debounce delay (ms) between the last Y.Doc change and the write-back
	 * invocation. Defaults to 5000 ms. Set to 0 to write back on every change
	 * (not recommended for large documents).
	 */
	writeBackDebounceMs?: number;
}
