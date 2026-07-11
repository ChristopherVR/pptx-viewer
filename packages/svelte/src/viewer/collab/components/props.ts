import type {
	BroadcastConfig,
	BroadcastDefaults,
	CollaborationConfig,
	ConnectionStatus,
	RemoteCursor,
	SanitizedPresence,
} from 'pptx-viewer-shared';
import type { Snippet } from 'svelte';

import type { ShareDefaults } from './share-helpers';

/**
 * Prop contracts for the collaboration dialogs/overlays. Kept in a plain
 * `.ts` module (not inside the SFCs) per repo convention: SFCs stay thin
 * presentation, logic and types live in lintable TypeScript files.
 */

/** Props for the reusable modal shell. */
export interface ModalDialogProps {
	/** Whether the dialog is visible. */
	open: boolean;
	/** Optional heading shown in the header bar. */
	title?: string;
	/** Fired on backdrop click, the close button, or Escape. */
	onclose: () => void;
	/** Dialog body. */
	children?: Snippet;
	/** Optional footer (action buttons), right-aligned. */
	footer?: Snippet;
}

/** Props for the share (collaboration) dialog. */
export interface ShareDialogProps {
	/** Whether the dialog is visible. */
	open: boolean;
	/** Prefilled values for the form fields. */
	defaults?: ShareDefaults;
	/** Whether a collaboration session is currently active. */
	active: boolean;
	/** Fired with the assembled config when the user starts sharing. */
	onstart: (config: CollaborationConfig) => void;
	/** Fired when the user stops an active session. */
	onstop: () => void;
	/** Fired when the dialog is dismissed. */
	onclose: () => void;
}

/** Props for the one-way broadcast dialog. */
export interface BroadcastDialogProps {
	/** Whether the dialog is visible. */
	open: boolean;
	/** Optional `{ roomId, serverUrl }` seed for the start form. */
	defaults?: BroadcastDefaults;
	/** Whether a broadcast is currently running. */
	active: boolean;
	/** The shareable follow link, shown while `active`. */
	viewerUrl?: string;
	/** Fired with the assembled config when the presenter starts broadcasting. */
	onstart: (config: BroadcastConfig) => void;
	/** Fired when the presenter stops the active broadcast. */
	onstop: () => void;
	/** Fired when the dialog is dismissed. */
	onclose: () => void;
}

/** Props for the remote-cursor overlay. */
export interface CollaborationCursorsProps {
	/** Remote collaborators to render, in unscaled slide coordinates. */
	cursors: RemoteCursor[];
	/** Current canvas zoom factor; cursor positions scale by this. */
	zoom: number;
}

/** Props for the connection status pill. */
export interface CollaborationStatusIndicatorProps {
	/** Current connection status. */
	status: ConnectionStatus;
	/** Number of connected participants (including the local user). */
	connectedCount: number;
	/** The user asked to retry after a connection error. */
	onretry: () => void;
}

/** Props for the follow-mode peer bar. */
export interface FollowModeBarProps {
	/** Active remote collaborators (excludes self). */
	presences: SanitizedPresence[];
	/** The clientId currently being followed, or null. */
	followedClientId: number | null;
	/** Follow the given peer, or `null` to stop following. */
	onfollow: (clientId: number | null) => void;
}
