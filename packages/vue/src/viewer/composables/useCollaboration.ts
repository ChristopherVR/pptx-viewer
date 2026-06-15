import type { PptxSlide } from 'pptx-viewer-core';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import type { CollaborationConfig } from '../types';

/**
 * Minimal real-time collaboration over Yjs + y-websocket.
 *
 * Scope (foundational): the slide model is broadcast as a whole-document JSON
 * value in a shared `Y.Map` (last-write-wins, not per-field CRDT) and remote
 * collaborators' cursors are surfaced via the y-websocket **awareness** channel.
 * `yjs`/`y-websocket` are imported lazily so they stay out of the main chunk and
 * are only loaded when a session actually starts.
 *
 * This is intentionally a pragmatic baseline — fine-grained CRDT merging of the
 * element tree and presence (selection highlights, follow-mode) are future work.
 */
export interface UseCollaborationOptions {
	/** The editor's reactive slides ref (broadcast on local change). */
	slides: Ref<PptxSlide[]>;
	/** Called when a remote peer broadcasts a newer slide set. */
	onRemoteSlides: (slides: PptxSlide[]) => void;
	/** This user's cursor/label colour. */
	userColor?: string;
}

export interface UseCollaborationResult {
	/** True once the websocket provider reports a connection. */
	connected: Ref<boolean>;
	/** Remote collaborators' live cursors (excludes self). */
	cursors: Ref<RemoteCursor[]>;
	/** Whether a session is currently active. */
	active: Ref<boolean>;
	/** Connect to a room and begin syncing. */
	start: (config: CollaborationConfig) => Promise<void>;
	/** Disconnect and tear down the session. */
	stop: () => void;
	/** Publish this user's cursor position (unscaled slide px). */
	setCursor: (x: number, y: number) => void;
}

interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

const SAFE_COLOR = '#4c8bf5';

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const connected = ref(false);
	const cursors = ref<RemoteCursor[]>([]);
	const active = ref(false);

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

	function refreshCursors(): void {
		if (!awareness) {
			cursors.value = [];
			return;
		}
		const next: RemoteCursor[] = [];
		for (const [clientId, state] of awareness.getStates()) {
			if (clientId === selfId) {
				continue;
			}
			const cursor = state.cursor as { x: number; y: number } | undefined;
			const user = state.user as { name?: string; color?: string } | undefined;
			if (cursor) {
				next.push({
					clientId,
					userName: user?.name ?? 'Guest',
					color: user?.color ?? SAFE_COLOR,
					x: cursor.x,
					y: cursor.y,
				});
			}
		}
		cursors.value = next;
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
			awareness.on('change', refreshCursors);

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
		awareness?.off?.('change', refreshCursors);
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
	}

	function setCursor(x: number, y: number): void {
		awareness?.setLocalStateField('cursor', { x, y });
	}

	onScopeDispose(stop);

	return { connected, cursors, active, start, stop, setCursor };
}
