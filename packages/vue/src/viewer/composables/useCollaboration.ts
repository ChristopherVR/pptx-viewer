import type { PptxSlide } from 'pptx-viewer-core';
import { computed, onScopeDispose, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import type { CollaborationConfig } from '../types';

/**
 * Minimal real-time collaboration over Yjs + y-websocket.
 *
 * Scope: the slide model is broadcast as a whole-document JSON value in a shared
 * `Y.Map` (last-write-wins, not per-field CRDT) and remote collaborators'
 * **presence** — cursor position, selected element ids and active slide index —
 * is surfaced via the y-websocket **awareness** channel. `yjs`/`y-websocket` are
 * imported lazily so they stay out of the main chunk and are only loaded when a
 * session actually starts.
 *
 * On top of presence this composable adds **follow-mode**: the local user can
 * follow a chosen peer (`followUser(clientId)`), after which `followedSlideIndex`
 * reactively mirrors that peer's active slide so the host can drive navigation.
 *
 * Fine-grained CRDT merging of the element tree remains future work.
 */
export interface UseCollaborationOptions {
	/** The editor's reactive slides ref (broadcast on local change). */
	slides: Ref<PptxSlide[]>;
	/** Called when a remote peer broadcasts a newer slide set. */
	onRemoteSlides: (slides: PptxSlide[]) => void;
	/** This user's cursor/label colour. */
	userColor?: string;
}

/**
 * A remote peer's full presence: identity plus the live cursor, selection and
 * active slide they have published over awareness. `cursor` is absent until the
 * peer moves their pointer; `selectionIds`/`activeSlide` default to empty/0.
 */
export interface RemotePresence {
	/** The peer's awareness clientId. */
	clientId: number;
	/** Display name (falls back to `'Guest'`). */
	userName: string;
	/** Cursor + label colour. */
	color: string;
	/** Last published cursor position (unscaled slide px), if any. */
	cursor?: { x: number; y: number };
	/** Ids of elements the peer currently has selected. */
	selectionIds: string[];
	/** Slide index the peer is currently viewing. */
	activeSlide: number;
}

export interface UseCollaborationResult {
	/** True once the websocket provider reports a connection. */
	connected: Ref<boolean>;
	/** Remote collaborators' live cursors (excludes self). */
	cursors: Ref<RemoteCursor[]>;
	/** Remote collaborators' full presence — cursor + selection + slide (excludes self). */
	remotePresences: Ref<RemotePresence[]>;
	/** Whether a session is currently active. */
	active: Ref<boolean>;
	/** The clientId of the peer currently being followed, or null. */
	followedClientId: Ref<number | null>;
	/**
	 * The active-slide index of the followed peer, or null when not following
	 * (or the followed peer has left). The host watches this to navigate.
	 */
	followedSlideIndex: ComputedRef<number | null>;
	/** Connect to a room and begin syncing. */
	start: (config: CollaborationConfig) => Promise<void>;
	/** Disconnect and tear down the session. */
	stop: () => void;
	/** Publish this user's cursor position (unscaled slide px). */
	setCursor: (x: number, y: number) => void;
	/** Publish this user's selected element ids. */
	setSelection: (ids: string[]) => void;
	/** Publish this user's active slide index. */
	setActiveSlide: (index: number) => void;
	/** Follow a peer's active slide (or `null` to stop following). */
	followUser: (clientId: number | null) => void;
}

interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

/** Shape of the `user` awareness field. */
interface AwarenessUser {
	name?: string;
	color?: string;
}

/** Shape of the `cursor` awareness field. */
interface AwarenessCursor {
	x: number;
	y: number;
}

const SAFE_COLOR = '#4c8bf5';

/** Coerce an unknown awareness value into a list of element-id strings. */
function asSelectionIds(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const ids: string[] = [];
	for (const entry of value) {
		if (typeof entry === 'string') {
			ids.push(entry);
		}
	}
	return ids;
}

/** Coerce an unknown awareness value into a non-negative slide index. */
function asSlideIndex(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.floor(value));
}

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const connected = ref(false);
	const remotePresences = ref<RemotePresence[]>([]);
	const active = ref(false);
	const followedClientId = ref<number | null>(null);

	// Cursors are a projection of remotePresences (peers that have a cursor),
	// kept as a separate ref for the existing CollaborationCursors overlay.
	const cursors = ref<RemoteCursor[]>([]);

	// followedSlideIndex tracks the followed peer's active slide; null when not
	// following or when that peer is no longer present.
	const followedSlideIndex = computed<number | null>(() => {
		const target = followedClientId.value;
		if (target === null) {
			return null;
		}
		const peer = remotePresences.value.find((p) => p.clientId === target);
		return peer ? peer.activeSlide : null;
	});

	// Yjs handles (kept loosely typed to avoid a hard dependency at module load).
	let ydoc: { destroy: () => void } | null = null;
	let provider: {
		awareness: AwarenessLike;
		disconnect: () => void;
		destroy: () => void;
		on: (e: string, cb: (p: { status?: string }) => void) => void;
	} | null = null;
	let ymap: {
		set: (k: string, v: unknown) => void;
		get: (k: string) => unknown;
		observe: (cb: () => void) => void;
	} | null = null;
	let awareness: AwarenessLike | null = null;
	let selfId = -1;
	let applyingRemote = false;
	let stopWatch: (() => void) | null = null;

	function refreshPresence(): void {
		if (!awareness) {
			remotePresences.value = [];
			cursors.value = [];
			return;
		}
		const presences: RemotePresence[] = [];
		const nextCursors: RemoteCursor[] = [];
		for (const [clientId, state] of awareness.getStates()) {
			if (clientId === selfId) {
				continue;
			}
			const user = state.user as AwarenessUser | undefined;
			const cursor = state.cursor as AwarenessCursor | undefined;
			const userName = user?.name ?? 'Guest';
			const color = user?.color ?? SAFE_COLOR;
			const selectionIds = asSelectionIds(state.selection);
			const activeSlide = asSlideIndex(state.activeSlide);

			presences.push({
				clientId,
				userName,
				color,
				cursor: cursor ? { x: cursor.x, y: cursor.y } : undefined,
				selectionIds,
				activeSlide,
			});

			if (cursor) {
				nextCursors.push({
					clientId,
					userName,
					color,
					x: cursor.x,
					y: cursor.y,
					selectionIds,
				});
			}
		}
		remotePresences.value = presences;
		cursors.value = nextCursors;

		// Drop the follow target if that peer has disconnected.
		if (
			followedClientId.value !== null &&
			!presences.some((p) => p.clientId === followedClientId.value)
		) {
			followedClientId.value = null;
		}
	}

	function pushLocalSlides(): void {
		if (ymap && !applyingRemote) {
			ymap.set('slides', JSON.stringify(options.slides.value));
		}
	}

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		try {
			const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);
			const doc = new Y.Doc();
			ydoc = doc;
			const map = doc.getMap('presentation');
			ymap = map as unknown as typeof ymap;
			const wsProvider = new WebsocketProvider(config.serverUrl, config.roomId, doc);
			provider = wsProvider as unknown as typeof provider;
			awareness = wsProvider.awareness as unknown as AwarenessLike;
			selfId = awareness.clientID ?? -1;

			awareness.setLocalStateField('user', {
				name: config.userName,
				color: options.userColor ?? SAFE_COLOR,
			});
			// Seed selection/active-slide so peers see us immediately.
			awareness.setLocalStateField('selection', []);
			awareness.setLocalStateField('activeSlide', 0);
			awareness.on('change', refreshPresence);

			wsProvider.on('status', (payload: { status?: string }) => {
				connected.value = payload.status === 'connected';
			});

			map.observe(() => {
				const raw = map.get('slides');
				if (typeof raw === 'string') {
					try {
						applyingRemote = true;
						options.onRemoteSlides(JSON.parse(raw) as PptxSlide[]);
					} finally {
						applyingRemote = false;
					}
				}
			});

			// Broadcast local edits.
			stopWatch = watch(options.slides, pushLocalSlides, { deep: false });
			active.value = true;
		} catch {
			// yjs/y-websocket unavailable or connection failed — degrade silently.
			stop();
		}
	}

	function stop(): void {
		stopWatch?.();
		stopWatch = null;
		awareness?.off?.('change', refreshPresence);
		provider?.disconnect();
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		ymap = null;
		awareness = null;
		selfId = -1;
		connected.value = false;
		active.value = false;
		cursors.value = [];
		remotePresences.value = [];
		followedClientId.value = null;
	}

	function setCursor(x: number, y: number): void {
		awareness?.setLocalStateField('cursor', { x, y });
	}

	function setSelection(ids: string[]): void {
		awareness?.setLocalStateField('selection', [...ids]);
	}

	function setActiveSlide(index: number): void {
		awareness?.setLocalStateField('activeSlide', Math.max(0, Math.floor(index)));
	}

	function followUser(clientId: number | null): void {
		followedClientId.value = clientId;
	}

	onScopeDispose(stop);

	return {
		connected,
		cursors,
		remotePresences,
		active,
		followedClientId,
		followedSlideIndex,
		start,
		stop,
		setCursor,
		setSelection,
		setActiveSlide,
		followUser,
	};
}
