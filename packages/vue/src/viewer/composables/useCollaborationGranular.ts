/**
 * Granular collaboration composables (Vue 3).
 *
 * These are thin projections over the monolithic `useCollaboration` session so
 * the Vue package exposes the same granular collaboration surface as React and
 * Angular (`useYjsProvider` / `usePresenceTracking` / `useCollaborativeState` /
 * `useCollaborativeHistory`). `useCollaboration` remains the convenience wrapper
 * that bundles every facet; reach for these when you want to consume a single
 * facet in isolation while still driving ONE underlying session.
 *
 * Composition pattern (one transport, several views):
 *
 *   const session = useYjsProvider(options);
 *   const presence = usePresenceTracking(session);
 *   const state = useCollaborativeState(session);
 *   session.start(config);
 */
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import type {
	RemotePresence,
	UseCollaborationOptions,
	UseCollaborationResult,
} from './collaboration-types';
import { useCollaboration } from './useCollaboration';

export type { RemotePresence, UseCollaborationOptions, UseCollaborationResult };

/**
 * Transport/session owner. Creates (and tears down) the Yjs document and
 * provider lifecycle and exposes the connection controls. The React counterpart
 * of the same name owns the transport layer too; the presence and slide-state
 * projections below take the returned session so they all share one connection.
 */
export function useYjsProvider(options: UseCollaborationOptions): UseCollaborationResult {
	return useCollaboration(options);
}

export interface UsePresenceTrackingResult {
	/** Remote peers' full published presence (identity, cursor, selection). */
	remotePresences: Ref<RemotePresence[]>;
	/** Remote cursor overlays projected onto the local canvas. */
	cursors: Ref<RemoteCursor[]>;
	/** Total connected participants (remote peers plus self when active). */
	connectedCount: ComputedRef<number>;
	/** The peer currently being followed, if any. */
	followedClientId: Ref<number | null>;
	/** Broadcast the local cursor position. */
	setCursor: (x: number, y: number) => void;
	/** Broadcast the local selection. */
	setSelection: (ids: string[]) => void;
	/** Broadcast the local active slide index. */
	setActiveSlide: (index: number) => void;
	/** Follow (or unfollow with `null`) a remote peer. */
	followUser: (clientId: number | null) => void;
}

/**
 * Presence/awareness view over an existing session: which peers are connected,
 * their cursors, and the outgoing presence broadcasters.
 */
export function usePresenceTracking(session: UseCollaborationResult): UsePresenceTrackingResult {
	return {
		remotePresences: session.remotePresences,
		cursors: session.cursors,
		connectedCount: session.connectedCount,
		followedClientId: session.followedClientId,
		setCursor: session.setCursor,
		setSelection: session.setSelection,
		setActiveSlide: session.setActiveSlide,
		followUser: session.followUser,
	};
}

export interface UseCollaborativeStateResult {
	/** Current connection status. */
	status: UseCollaborationResult['status'];
	/** Whether the session is connected. */
	connected: Ref<boolean>;
	/** Whether a session is currently active. */
	active: Ref<boolean>;
	/** Start a session with the given config. */
	start: (config: Parameters<UseCollaborationResult['start']>[0]) => Promise<void>;
	/** Stop the active session. */
	stop: () => void;
	/** Retry the last session after a timeout or error. */
	retry: () => Promise<void>;
}

/**
 * Shared-document/state view over an existing session: the slide-sync lifecycle
 * controls (start/stop/retry) and connection status.
 */
export function useCollaborativeState(
	session: UseCollaborationResult,
): UseCollaborativeStateResult {
	return {
		status: session.status,
		connected: session.connected,
		active: session.active,
		start: session.start,
		stop: session.stop,
		retry: session.retry,
	};
}

export interface UseCollaborativeHistoryInput {
	/** Standard history undo function. */
	handleUndo: () => void;
	/** Standard history redo function. */
	handleRedo: () => void;
	/** Whether undo is available. */
	canUndo: Ref<boolean> | ComputedRef<boolean> | boolean;
	/** Whether redo is available. */
	canRedo: Ref<boolean> | ComputedRef<boolean> | boolean;
}

export interface UseCollaborativeHistoryResult {
	/** Undo the last local change (no-op when unavailable). */
	handleUndo: () => void;
	/** Redo the last undone local change (no-op when unavailable). */
	handleRedo: () => void;
	/** Whether undo is available. */
	canUndo: ComputedRef<boolean>;
	/** Whether redo is available. */
	canRedo: ComputedRef<boolean>;
}

function readFlag(flag: Ref<boolean> | ComputedRef<boolean> | boolean): boolean {
	return typeof flag === 'boolean' ? flag : flag.value;
}

/**
 * Collaboration-aware wrapper over the editor history. Mirrors React's
 * `useCollaborativeHistory`: the undo/redo stack is still owned by the editor;
 * this guards each call on availability and tracks the local change count for
 * future multi-user undo scoping.
 */
export function useCollaborativeHistory(
	input: UseCollaborativeHistoryInput,
): UseCollaborativeHistoryResult {
	const localChangeCount = ref(0);
	const canUndo = computed(() => readFlag(input.canUndo));
	const canRedo = computed(() => readFlag(input.canRedo));

	function handleUndo(): void {
		if (!canUndo.value) {
			return;
		}
		input.handleUndo();
		localChangeCount.value = Math.max(0, localChangeCount.value - 1);
	}

	function handleRedo(): void {
		if (!canRedo.value) {
			return;
		}
		input.handleRedo();
		localChangeCount.value += 1;
	}

	return { handleUndo, handleRedo, canUndo, canRedo };
}
