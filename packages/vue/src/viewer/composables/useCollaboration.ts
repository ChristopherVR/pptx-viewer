import type { PptxSlide } from 'pptx-viewer-core';
import {
	clampCursorPosition,
	CONNECTION_TIMEOUT_MS,
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	isPresenceFresh,
	PRESENCE_HEARTBEAT_MS,
	sanitizeColor,
	sanitizeSlideIndex,
	sanitizeUserName,
	validateRoomId,
} from 'pptx-viewer-shared';
import type { ConnectionStatus } from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import type { CollaborationConfig, CollaborationRole } from '../types';

/**
 * Minimal real-time collaboration over Yjs + y-websocket.
 *
 * Scope: the slide model is broadcast as a whole-document JSON value in a shared
 * `Y.Map` (last-write-wins, not per-field CRDT) and remote collaborators'
 * **presence** (cursor position, selected element ids, active slide index, role)
 * is surfaced via the y-websocket **awareness** channel. `yjs`/`y-websocket` are
 * imported lazily so they stay out of the main chunk and are only loaded when a
 * session actually starts.
 *
 * On top of presence this composable adds **follow-mode**: the local user can
 * follow a chosen peer (`followUser(clientId)`), after which `followedSlideIndex`
 * reactively mirrors that peer's active slide so the host can drive navigation.
 *
 * Security / robustness (ported from the React `useYjsProvider` /
 * `usePresenceTracking` hooks, sharing `pptx-viewer-shared` validators):
 *  - the room id is validated before any network access;
 *  - an insecure `ws://` server is refused from a secure `https://` page
 *    (mixed-content), surfacing `status: 'error'` immediately;
 *  - the connection is given {@link CONNECTION_TIMEOUT_MS}; on timeout the
 *    provider is torn down and `status` becomes `'error'` (call `retry()`);
 *  - incoming awareness data (name / colour / cursor) is sanitised and cursor
 *    coordinates are clamped to the slide bounds (XSS / out-of-bounds defence);
 *  - the local user heartbeats every {@link PRESENCE_HEARTBEAT_MS} and stale
 *    peers (no update within the staleness window) are dropped.
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
	/**
	 * Slide canvas width/height (unscaled px) used to clamp incoming cursor
	 * coordinates. Defaults to a generous bound when omitted.
	 */
	canvasWidth?: Ref<number> | number;
	canvasHeight?: Ref<number> | number;
}

/**
 * A remote peer's full presence: identity plus the live cursor, selection and
 * active slide they have published over awareness. `cursor` is absent until the
 * peer moves their pointer; `selectionIds`/`activeSlide` default to empty/0.
 */
export interface RemotePresence {
	/** The peer's awareness clientId. */
	clientId: number;
	/** Display name (sanitised; falls back to `'Guest'`). */
	userName: string;
	/** Cursor + label colour (validated hex, falls back to a safe colour). */
	color: string;
	/** Last published cursor position (unscaled slide px, clamped), if any. */
	cursor?: { x: number; y: number };
	/** Ids of elements the peer currently has selected. */
	selectionIds: string[];
	/** Slide index the peer is currently viewing. */
	activeSlide: number;
	/** Session role, when published. */
	role?: CollaborationRole;
}

export interface UseCollaborationResult {
	/** Connection lifecycle: disconnected / connecting / connected / error. */
	status: Ref<ConnectionStatus>;
	/** True once the websocket provider reports a connection (derived). */
	connected: Ref<boolean>;
	/** Remote collaborators' live cursors (excludes self). */
	cursors: Ref<RemoteCursor[]>;
	/** Remote collaborators' full presence: cursor + selection + slide (excludes self). */
	remotePresences: Ref<RemotePresence[]>;
	/** Total connected participants (remote + self while active). */
	connectedCount: ComputedRef<number>;
	/** Whether a session is currently active. */
	active: Ref<boolean>;
	/** The clientId of the peer currently being followed, or null. */
	followedClientId: Ref<number | null>;
	/**
	 * The active-slide index of the followed peer, or null when not following
	 * (or the followed peer has left). The host watches this to navigate.
	 */
	followedSlideIndex: ComputedRef<number | null>;
	/**
	 * The active-slide index of the broadcaster, or null when no broadcaster is
	 * present. Viewers watch this to auto-follow a one-way broadcast.
	 */
	broadcasterSlideIndex: ComputedRef<number | null>;
	/** Connect to a room and begin syncing. */
	start: (config: CollaborationConfig) => Promise<void>;
	/** Disconnect and tear down the session. */
	stop: () => void;
	/** Retry after a connection timeout / error using the last config. */
	retry: () => Promise<void>;
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
	role?: string;
}

/** Shape of the `cursor` awareness field. */
interface AwarenessCursor {
	x: number;
	y: number;
}

const DEFAULT_CANVAS_BOUND = 100_000;

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

const VALID_ROLES: readonly CollaborationRole[] = ['owner', 'collaborator', 'viewer'];

/** Narrow an unknown awareness value to a known {@link CollaborationRole}. */
function asRole(value: unknown): CollaborationRole | undefined {
	return VALID_ROLES.includes(value as CollaborationRole)
		? (value as CollaborationRole)
		: undefined;
}

/** Read a reactive-or-plain numeric bound. */
function readBound(source: Ref<number> | number | undefined): number {
	if (source === undefined) {
		return DEFAULT_CANVAS_BOUND;
	}
	const value = typeof source === 'number' ? source : source.value;
	return value > 0 ? value : DEFAULT_CANVAS_BOUND;
}

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const status = ref<ConnectionStatus>('disconnected');
	const connected = computed(() => status.value === 'connected');
	const remotePresences = ref<RemotePresence[]>([]);
	const active = ref(false);
	const followedClientId = ref<number | null>(null);

	// Cursors are a projection of remotePresences (peers that have a cursor),
	// kept as a separate ref for the existing CollaborationCursors overlay.
	const cursors = ref<RemoteCursor[]>([]);

	const connectedCount = computed(() => remotePresences.value.length + (active.value ? 1 : 0));

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

	// broadcasterSlideIndex tracks the first broadcasting peer (one-way session).
	const broadcasterSlideIndex = computed<number | null>(() => {
		const broadcaster = remotePresences.value.find((p) => p.role === 'owner');
		return broadcaster ? broadcaster.activeSlide : null;
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
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let lastConfig: CollaborationConfig | null = null;

	function clearTimers(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
		if (heartbeat !== null) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
	}

	function refreshPresence(): void {
		if (!awareness) {
			remotePresences.value = [];
			cursors.value = [];
			return;
		}
		const now = Date.now();
		const width = readBound(options.canvasWidth);
		const height = readBound(options.canvasHeight);
		const presences: RemotePresence[] = [];
		const nextCursors: RemoteCursor[] = [];
		for (const [clientId, state] of awareness.getStates()) {
			if (clientId === selfId) {
				continue;
			}
			// Drop peers whose presence record has gone stale (no heartbeat).
			const lastUpdated = state.lastUpdated;
			if (typeof lastUpdated === 'string' && !isPresenceFresh(lastUpdated, now)) {
				continue;
			}

			const user = state.user as AwarenessUser | undefined;
			const cursor = state.cursor as AwarenessCursor | undefined;
			// Sanitise the name (strip HTML, clamp length); peers without a name
			// published fall back to 'Guest' to match the original overlay label.
			const userName = typeof user?.name === 'string' ? sanitizeUserName(user.name) : 'Guest';
			const color = sanitizeColor(user?.color, DEFAULT_CURSOR_COLOR);
			const selectionIds = asSelectionIds(state.selection);
			const activeSlide = sanitizeSlideIndex(state.activeSlide);
			const role = asRole(user?.role);

			const safeCursor =
				cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number'
					? {
							x: clampCursorPosition(cursor.x, 0, width),
							y: clampCursorPosition(cursor.y, 0, height),
						}
					: undefined;

			presences.push({
				clientId,
				userName,
				color,
				cursor: safeCursor,
				selectionIds,
				activeSlide,
				role,
			});

			if (safeCursor) {
				nextCursors.push({
					clientId,
					userName,
					color,
					x: safeCursor.x,
					y: safeCursor.y,
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

	/** Re-stamp the local presence heartbeat so peers don't drop us as stale. */
	function touchHeartbeat(): void {
		awareness?.setLocalStateField('lastUpdated', new Date().toISOString());
	}

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		lastConfig = config;

		// Reject malformed room ids before touching the network.
		try {
			validateRoomId(config.roomId);
		} catch {
			status.value = 'error';
			return;
		}

		// Fail fast on mixed content: an https page cannot open a ws:// socket.
		if (isMixedContentBlocked(config.serverUrl)) {
			status.value = 'error';
			return;
		}

		status.value = 'connecting';
		try {
			const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);
			const doc = new Y.Doc();
			ydoc = doc;
			const map = doc.getMap('presentation');
			ymap = map as unknown as typeof ymap;
			const wsProvider = new WebsocketProvider(config.serverUrl, config.roomId, doc, {
				params: config.authToken ? { token: config.authToken } : undefined,
			});
			provider = wsProvider as unknown as typeof provider;
			awareness = wsProvider.awareness as unknown as AwarenessLike;
			selfId = awareness.clientID ?? -1;

			awareness.setLocalStateField('user', {
				name: config.userName,
				color: options.userColor ?? config.userColor ?? DEFAULT_CURSOR_COLOR,
				role: config.role,
			});
			// Seed selection/active-slide/heartbeat so peers see us immediately.
			awareness.setLocalStateField('selection', []);
			awareness.setLocalStateField('activeSlide', 0);
			touchHeartbeat();
			awareness.on('change', refreshPresence);
			awareness.on('update', refreshPresence);

			wsProvider.on('status', (payload: { status?: string }) => {
				if (payload.status === 'connected') {
					if (connectTimer !== null) {
						clearTimeout(connectTimer);
						connectTimer = null;
					}
					status.value = 'connected';
				} else if (payload.status === 'disconnected' && active.value) {
					status.value = 'disconnected';
				}
			});

			map.observe(() => {
				const raw = map.get('slides');
				if (typeof raw === 'string') {
					try {
						applyingRemote = true;
						options.onRemoteSlides(JSON.parse(raw) as PptxSlide[]);
					} catch {
						// Malformed payload; ignore.
					} finally {
						applyingRemote = false;
					}
				}
			});

			// Broadcast local edits.
			stopWatch = watch(options.slides, pushLocalSlides, { deep: false });

			// Heartbeat so peers keep us in their fresh set.
			heartbeat = setInterval(touchHeartbeat, PRESENCE_HEARTBEAT_MS);

			// Connection timeout: if we never connect, tear down and surface error.
			if (!wsProvider.wsconnected) {
				connectTimer = setTimeout(() => {
					connectTimer = null;
					if (status.value !== 'connected') {
						stop();
						status.value = 'error';
					}
				}, CONNECTION_TIMEOUT_MS);
			} else {
				status.value = 'connected';
			}

			active.value = true;
			refreshPresence();
		} catch {
			// yjs/y-websocket unavailable or connection failed: surface an error.
			stop();
			status.value = 'error';
		}
	}

	function stop(): void {
		clearTimers();
		stopWatch?.();
		stopWatch = null;
		awareness?.off?.('change', refreshPresence);
		awareness?.off?.('update', refreshPresence);
		provider?.disconnect();
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		ymap = null;
		awareness = null;
		selfId = -1;
		applyingRemote = false;
		status.value = 'disconnected';
		active.value = false;
		cursors.value = [];
		remotePresences.value = [];
		followedClientId.value = null;
	}

	async function retry(): Promise<void> {
		if (lastConfig) {
			await start(lastConfig);
		}
	}

	function setCursor(x: number, y: number): void {
		if (!awareness) {
			return;
		}
		awareness.setLocalStateField('cursor', { x, y });
		touchHeartbeat();
	}

	function setSelection(ids: string[]): void {
		if (!awareness) {
			return;
		}
		awareness.setLocalStateField('selection', [...ids]);
		touchHeartbeat();
	}

	function setActiveSlide(index: number): void {
		if (!awareness) {
			return;
		}
		awareness.setLocalStateField('activeSlide', Math.max(0, Math.floor(index)));
		touchHeartbeat();
	}

	function followUser(clientId: number | null): void {
		followedClientId.value = clientId;
	}

	onScopeDispose(stop);

	return {
		status,
		connected,
		cursors,
		remotePresences,
		connectedCount,
		active,
		followedClientId,
		followedSlideIndex,
		broadcasterSlideIndex,
		start,
		stop,
		retry,
		setCursor,
		setSelection,
		setActiveSlide,
		followUser,
	};
}
