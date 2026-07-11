/**
 * Real-time collaboration over Yjs (Vue 3): y-websocket or serverless y-webrtc.
 * Presence is a single nested `presence` awareness field in the shared wire
 * format (React/Vue/Angular interop). Slide sync is granular via
 * `reconcileSlidesInYDoc` (tagged `LOCAL_SYNC_ORIGIN`; the observer skips its
 * own writes). Role 'owner' debounces write-back.
 */
import type {
	CollaborationConfig,
	PresencePublisher,
	YjsFactories,
	YDocLike,
} from 'pptx-viewer-shared';
import {
	CONNECTION_TIMEOUT_MS,
	createPresencePublisher,
	createSyncGate,
	createWriteBackScheduler,
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	PRESENCE_HEARTBEAT_MS,
	reconcileSlidesInYDoc,
	readSlidesFromYDoc,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, watch } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import { projectPresence, readBound } from './collaboration-presence-view';
import { createCollabProvider } from './collaboration-provider';
import type { CollabProviderHandle } from './collaboration-provider';
import type {
	UseCollaborationOptions,
	UseCollaborationResult,
	AwarenessLike,
	RemotePresence,
} from './collaboration-types';
import { buildSaveSlides } from './template-editing';

export type { RemotePresence, UseCollaborationOptions, UseCollaborationResult };

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationResult {
	const status = ref<import('pptx-viewer-shared').ConnectionStatus>('disconnected');
	const connected = computed(() => status.value === 'connected');
	const remotePresences = ref<RemotePresence[]>([]);
	const active = ref(false);
	const followedClientId = ref<number | null>(null);
	const cursors = ref<RemoteCursor[]>([]);
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
	let provider: CollabProviderHandle | null = null;
	let awareness: AwarenessLike | null = null;
	let publisher: PresencePublisher | null = null;
	let selfId = -1;
	let localActiveSlide = 0;
	let applyingRemote = false;
	let stopWatch: (() => void) | null = null;
	let unobserveSlides: (() => void) | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let lastSynced = '';
	let lastConfig: CollaborationConfig | null = null;
	let yFactories: YjsFactories | null = null;
	let currentYDoc: YDocLike | null = null;

	const writeBack = createWriteBackScheduler({
		getYDoc: () => currentYDoc,
		getSourceBytes: options.getSourceBytes,
		getTemplateElements: options.getTemplateElements,
		mergeTemplateElements: buildSaveSlides,
	});

	/** Write the current local slides into the doc (granular, echo-deduped). */
	function flushLocalSlides(): void {
		if (!currentYDoc || !yFactories || applyingRemote) {
			return;
		}
		const s = JSON.stringify(options.slides.value);
		if (s === lastSynced) {
			return;
		}
		lastSynced = s;
		reconcileSlidesInYDoc(options.slides.value, currentYDoc, yFactories);
		if (lastConfig) {
			writeBack.schedule(lastConfig);
		}
	}

	// First-write gate: until the provider confirms its initial sync (or the
	// grace period elapses for a lone webrtc peer), local slides must not seed
	// the doc, or a late joiner's bootstrap deck would merge into the room's
	// real content. Opening the gate performs the deferred first write.
	const syncGate = createSyncGate(flushLocalSlides);

	function clearTimers(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
		if (heartbeat !== null) {
			clearInterval(heartbeat);
			heartbeat = null;
		}
		writeBack.cancel();
	}

	function refreshPresence(): void {
		if (!awareness) {
			remotePresences.value = [];
			cursors.value = [];
			return;
		}
		const { presences, cursors: nextCursors } = projectPresence(
			awareness.getStates(),
			selfId,
			readBound(options.canvasWidth),
			readBound(options.canvasHeight),
			localActiveSlide,
		);
		remotePresences.value = presences;
		cursors.value = nextCursors;
		if (
			followedClientId.value !== null &&
			!presences.some((p) => p.clientId === followedClientId.value)
		) {
			followedClientId.value = null;
		}
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
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		// Mixed-content only affects a ws:// socket from an https page.
		if (transport === 'websocket' && isMixedContentBlocked(config.serverUrl)) {
			status.value = 'error';
			return;
		}
		status.value = 'connecting';
		try {
			const Y = await import('yjs');
			const doc = new Y.Doc();
			ydoc = doc;
			yFactories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};
			currentYDoc = doc as unknown as YDocLike;

			provider = await createCollabProvider(transport, config, doc);
			awareness = provider.awareness;
			selfId = awareness.clientID ?? -1;

			// Gate local writes on the provider's initial sync; the grace timer
			// covers a lone webrtc peer that never receives a sync event.
			syncGate.reset();
			provider.onSynced(() => syncGate.open());
			if (provider.syncedNow) {
				syncGate.open();
			} else {
				syncGate.arm();
			}

			publisher = createPresencePublisher(awareness, {
				userName: config.userName,
				userColor: options.userColor ?? config.userColor ?? DEFAULT_CURSOR_COLOR,
				userAvatar: config.userAvatar,
				role: config.role,
			});
			awareness.on('change', refreshPresence);
			awareness.on('update', refreshPresence);

			if (transport === 'webrtc') {
				// Same-browser tabs meet over BroadcastChannel at once (no server wait).
				status.value = 'connected';
				// y-webrtc reports peer connectivity via the same onStatus surface;
				// re-arm the gate on a drop so a reconnect re-gates writes instead
				// of leaving it permanently open from the first connection.
				provider.onStatus((isConnected) => {
					if (isConnected) {
						status.value = 'connected';
					} else if (active.value) {
						status.value = 'disconnected';
						syncGate.reset();
						syncGate.arm();
					}
				});
			} else {
				provider.onStatus((isConnected) => {
					if (isConnected) {
						if (connectTimer !== null) {
							clearTimeout(connectTimer);
							connectTimer = null;
						}
						status.value = 'connected';
					} else if (active.value) {
						status.value = 'disconnected';
						// Re-arm on (re)connect: without this, a peer that drops and
						// rejoins keeps the gate permanently open from the first
						// connection and can clobber the room with a stale local doc.
						syncGate.reset();
						syncGate.arm();
					}
				});
				if (provider.connectedNow) {
					status.value = 'connected';
				} else {
					connectTimer = setTimeout(() => {
						connectTimer = null;
						if (status.value !== 'connected') {
							stop();
							status.value = 'error';
						}
					}, CONNECTION_TIMEOUT_MS);
				}
			}

			// Observe remote slide changes, skipping our own reconcile transactions.
			unobserveSlides = observeYDocSlides(currentYDoc, (_events, transaction) => {
				if (transaction?.origin === LOCAL_SYNC_ORIGIN || applyingRemote || !currentYDoc) {
					return;
				}
				const remote = readSlidesFromYDoc(currentYDoc);
				if (remote.length === 0) {
					return;
				}
				applyingRemote = true;
				options.onRemoteSlides(remote);
				applyingRemote = false;
				// Dedupe the echo: the watch this assignment schedules is a no-op.
				lastSynced = JSON.stringify(remote);
				writeBack.schedule(config);
			});

			// Broadcast local slide edits granularly (diff by id, one transaction).
			// Suppressed until the sync gate opens; the gate flushes on open.
			stopWatch = watch(
				options.slides,
				() => {
					if (syncGate.isOpen()) {
						flushLocalSlides();
					}
				},
				{ deep: false },
			);

			heartbeat = setInterval(() => publisher?.flush(), PRESENCE_HEARTBEAT_MS);
			active.value = true;
			refreshPresence();
		} catch {
			stop();
			status.value = 'error';
		}
	}

	function stop(): void {
		clearTimers();
		syncGate.reset();
		unobserveSlides?.();
		unobserveSlides = null;
		stopWatch?.();
		stopWatch = null;
		awareness?.off?.('change', refreshPresence);
		awareness?.off?.('update', refreshPresence);
		publisher?.dispose();
		publisher = null;
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		awareness = null;
		selfId = -1;
		localActiveSlide = 0;
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
		publisher?.update({ cursorX: x, cursorY: y });
	}

	function setSelection(ids: string[]): void {
		// The shared wire format carries a single primary selected element.
		publisher?.update({ selectedElementId: ids[0] });
	}

	function setActiveSlide(index: number): void {
		localActiveSlide = Math.max(0, Math.floor(index));
		publisher?.update({ activeSlideIndex: localActiveSlide });
		refreshPresence(); // re-filter which peer cursors are visible
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
