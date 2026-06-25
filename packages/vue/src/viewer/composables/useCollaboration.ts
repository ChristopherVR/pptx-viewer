/**
 * Minimal real-time collaboration over Yjs + y-websocket (Vue 3).
 *
 * Changes from the original implementation:
 *  - Slides sync uses the granular `pptx:slides` Y.Array (one Y.Map per slide,
 *    Y.Text for text bodies) instead of a monolithic JSON blob, enabling true
 *    structural CRDT merging.
 *  - Elected-writer write-back: when role === 'owner', the composable debounces
 *    Y.Doc changes and calls `config.onWriteBack` with serialized PPTX bytes.
 */
import type { CollaborationConfig, YjsFactories } from 'pptx-viewer-shared';
import {
	asSelectionIds,
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
	writeSlidesToYDoc,
	readSlidesFromYDoc,
	observeYDocSlides,
} from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, watch } from 'vue';

import type {
	UseCollaborationOptions,
	UseCollaborationResult,
	AwarenessLike,
	AwarenessUser,
	AwarenessCursor,
	RemotePresence,
} from './collaboration-types';

const DEFAULT_CANVAS_BOUND = 100_000;
const WRITE_BACK_DEBOUNCE_MS = 5_000;

const VALID_ROLES = ['owner', 'collaborator', 'viewer'] as const;
function asRole(v: unknown) {
	return VALID_ROLES.includes(v as (typeof VALID_ROLES)[number])
		? (v as RemotePresence['role'])
		: undefined;
}

function readBound(source: import('vue').Ref<number> | number | undefined): number {
	if (source === undefined) {
		return DEFAULT_CANVAS_BOUND;
	}
	const value = typeof source === 'number' ? source : source.value;
	return value > 0 ? value : DEFAULT_CANVAS_BOUND;
}

export type { RemotePresence, UseCollaborationOptions, UseCollaborationResult };

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const status = ref<import('pptx-viewer-shared').ConnectionStatus>('disconnected');
	const connected = computed(() => status.value === 'connected');
	const remotePresences = ref<RemotePresence[]>([]);
	const active = ref(false);
	const followedClientId = ref<number | null>(null);
	const cursors = ref<import('../components/CollaborationCursors.vue').RemoteCursor[]>([]);
	const connectedCount = computed(() => remotePresences.value.length + (active.value ? 1 : 0));

	const followedSlideIndex = computed<number | null>(() => {
		if (followedClientId.value === null) {
			return null;
		}
		return (
			remotePresences.value.find((p) => p.clientId === followedClientId.value)?.activeSlide ?? null
		);
	});
	const broadcasterSlideIndex = computed<number | null>(
		() => remotePresences.value.find((p) => p.role === 'owner')?.activeSlide ?? null,
	);

	let ydoc: { destroy: () => void } | null = null;
	let provider: {
		awareness: AwarenessLike;
		disconnect: () => void;
		destroy: () => void;
		on: (e: string, cb: (p: { status?: string }) => void) => void;
	} | null = null;
	let awareness: AwarenessLike | null = null;
	let selfId = -1;
	let applyingRemote = false;
	let stopWatch: (() => void) | null = null;
	let unobserveSlides: (() => void) | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let writeBackTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSynced = '';
	let lastConfig: CollaborationConfig | null = null;
	let yFactories: YjsFactories | null = null;
	let currentYDoc: Parameters<typeof writeSlidesToYDoc>[1] | null = null;

	function clearTimers(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
		if (heartbeat !== null) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
		if (writeBackTimer !== null) {
			clearTimeout(writeBackTimer);
			writeBackTimer = null;
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
		const nextCursors: import('../components/CollaborationCursors.vue').RemoteCursor[] = [];
		for (const [clientId, state] of awareness.getStates()) {
			if (clientId === selfId) {
				continue;
			}
			const lastUpdated = state.lastUpdated;
			if (typeof lastUpdated === 'string' && !isPresenceFresh(lastUpdated, now)) {
				continue;
			}
			const user = state.user as AwarenessUser | undefined;
			const cursor = state.cursor as AwarenessCursor | undefined;
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
		if (
			followedClientId.value !== null &&
			!presences.some((p) => p.clientId === followedClientId.value)
		) {
			followedClientId.value = null;
		}
	}

	function scheduleWriteBack(config: CollaborationConfig): void {
		if (!config.onWriteBack || config.role !== 'owner' || !currentYDoc) {
			return;
		}
		if (writeBackTimer !== null) {
			clearTimeout(writeBackTimer);
		}
		const debounceMs = config.writeBackDebounceMs ?? WRITE_BACK_DEBOUNCE_MS;
		writeBackTimer = setTimeout(async () => {
			writeBackTimer = null;
			if (!currentYDoc || !config.onWriteBack) {
				return;
			}
			const sourceBytes = options.getSourceBytes?.();
			if (!sourceBytes) {
				return;
			}
			try {
				const { PptxHandler } = await import('pptx-viewer-core');
				const handler = new PptxHandler();
				await handler.load(sourceBytes.buffer as ArrayBuffer);
				const slides = readSlidesFromYDoc(currentYDoc);
				const bytes = await handler.save(slides);
				config.onWriteBack(bytes);
			} catch {
				/* non-fatal */
			}
		}, debounceMs);
	}

	function touchHeartbeat(): void {
		awareness?.setLocalStateField('lastUpdated', new Date().toISOString());
	}

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		lastConfig = config;
		try {
			validateRoomId(config.roomId);
		} catch {
			status.value = 'error';
			return;
		}
		if (isMixedContentBlocked(config.serverUrl)) {
			status.value = 'error';
			return;
		}
		status.value = 'connecting';
		try {
			const [Y, { WebsocketProvider }] = await Promise.all([import('yjs'), import('y-websocket')]);
			const doc = new Y.Doc();
			ydoc = doc;
			yFactories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};
			currentYDoc = doc as unknown as Parameters<typeof writeSlidesToYDoc>[1];

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

			// Observe remote slide changes
			unobserveSlides = observeYDocSlides(currentYDoc, () => {
				if (applyingRemote || !currentYDoc) {
					return;
				}
				const remote = readSlidesFromYDoc(currentYDoc);
				if (remote.length === 0) {
					return;
				}
				applyingRemote = true;
				options.onRemoteSlides(remote);
				applyingRemote = false;
				scheduleWriteBack(config);
			});

			// Broadcast local slide edits
			stopWatch = watch(
				options.slides,
				() => {
					if (!currentYDoc || !yFactories || applyingRemote) {
						return;
					}
					const s = JSON.stringify(options.slides.value);
					if (s === lastSynced) {
						return;
					}
					lastSynced = s;
					writeSlidesToYDoc(options.slides.value, currentYDoc, yFactories);
					scheduleWriteBack(config);
				},
				{ deep: false },
			);

			heartbeat = setInterval(touchHeartbeat, PRESENCE_HEARTBEAT_MS);
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
			stop();
			status.value = 'error';
		}
	}

	function stop(): void {
		clearTimers();
		unobserveSlides?.();
		unobserveSlides = null;
		stopWatch?.();
		stopWatch = null;
		awareness?.off?.('change', refreshPresence);
		awareness?.off?.('update', refreshPresence);
		provider?.disconnect();
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		awareness = null;
		selfId = -1;
		applyingRemote = false;
		yFactories = null;
		currentYDoc = null;
		lastSynced = '';
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
