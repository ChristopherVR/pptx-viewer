import type { PptxHandler } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	ConnectionStatus,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	CONNECTION_TIMEOUT_MS,
	createSyncGate,
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { PresenceController } from './collaboration-presence';
import { createPresenceController } from './collaboration-presence';
import type { CollabProviderHandle } from './collaboration-provider';
import { createCollabProvider } from './collaboration-provider';
import { createSlidesSync } from './collaboration-slides-sync';
import type { SlidesSync } from './collaboration-slides-sync';
import { createWriteBackScheduler } from './collaboration-writeback';

/**
 * Real-time collaboration for the vanilla viewer over Yjs (y-websocket or
 * serverless y-webrtc), ported from the Vue `useCollaboration` composable.
 *
 * Slide sync is granular via the shared `reconcileSlidesInYDoc` (tagged
 * `LOCAL_SYNC_ORIGIN` so the observer skips our own writes; see
 * `collaboration-slides-sync.ts`), matching the React/Vue/Angular apply path.
 * Presence (cursors/selection/follow-mode) publishes via the shared
 * `createPresencePublisher`/`derivePresenceList` (`collaboration-presence.ts`)
 * into `store.get().remotePresences`/`.cursors` so the cursors overlay and
 * status UI re-render off the same store as the rest of the viewer.
 *
 * KNOWN LIMITATION: collaboration undo semantics are undefined - the local
 * `EditorHistory` stack keeps working but does not coordinate with peers
 * (matches React/Vue/Angular).
 */
export interface CollaborationControllerDeps {
	store: Store<ViewerState>;
	/** Live core handler (owner-role write-back re-serializes through it). */
	getHandler: () => PptxHandler | null;
	/** Enforce the read-only `viewer` role by disabling editing. */
	setEditable: (editable: boolean) => void;
	/** Notified on every connection-status transition. */
	onStatusChange?: (status: ConnectionStatus) => void;
}

export interface CollaborationController {
	/** Connect and begin syncing. Stops any prior session first. */
	start(config: CollaborationConfig): Promise<void>;
	/** Disconnect and tear the session down. */
	stop(): void;
	/** Whether a session is currently active. */
	isActive(): boolean;
	/** Current connection status. */
	getStatus(): ConnectionStatus;
	/** Publish a cursor move (slide-space px); no-op when no session is active. */
	setCursor(x: number, y: number, activeSlideIndex?: number): void;
	/** Publish the local selection; no-op when no session is active. */
	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void;
	/** Publish the local active-slide index (drives peer follow-along). */
	setActiveSlide(index: number): void;
	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void;
	/** The last config used to start a session (persists after `stop()`, for retry). */
	getConfig(): CollaborationConfig | null;
	/** Stop and release everything (viewer destroy). */
	destroy(): void;
}

export function createCollaborationController(
	deps: CollaborationControllerDeps,
): CollaborationController {
	const { store } = deps;

	let status: ConnectionStatus = 'disconnected';
	let active = false;
	let ydoc: { destroy: () => void } | null = null;
	let currentYDoc: YDocLike | null = null;
	let provider: CollabProviderHandle | null = null;
	let yFactories: YjsFactories | null = null;
	let presence: PresenceController | null = null;
	let publishSuppressed = false;
	let editableBeforeViewer: boolean | null = null;
	let lastConfig: CollaborationConfig | null = null;
	let unobserveSlides: (() => void) | null = null;
	let unsubscribeStore: (() => void) | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;

	function setStatus(next: ConnectionStatus): void {
		if (next === status) {
			return;
		}
		status = next;
		deps.onStatusChange?.(next);
	}

	function clearConnectTimer(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
	}

	const writeBack = createWriteBackScheduler({
		getYDoc: () => currentYDoc,
		getHandler: deps.getHandler,
	});

	const slidesSync: SlidesSync = createSlidesSync(store, (config) => writeBack.schedule(config));

	function flushLocal(): void {
		slidesSync.flushLocalSlides(currentYDoc, yFactories, lastConfig, publishSuppressed);
	}

	// First-write gate: until the provider confirms its initial sync (or the
	// grace period elapses for a lone webrtc peer), local slides must not seed
	// the doc, or a late joiner's bootstrap deck would merge into the room's real
	// content. Opening the gate performs the deferred first write.
	const syncGate = createSyncGate(flushLocal);

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		lastConfig = config;
		try {
			validateRoomId(config.roomId);
		} catch {
			setStatus('error');
			return;
		}
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		// Mixed-content only affects a ws:// socket from an https page.
		if (transport === 'websocket' && isMixedContentBlocked(config.serverUrl)) {
			setStatus('error');
			return;
		}
		setStatus('connecting');
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

			presence = createPresenceController(
				store,
				provider.awareness,
				{
					userName: config.userName,
					userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
					userAvatar: config.userAvatar,
					role: config.role,
				},
				() => ({ width: store.get().canvasSize.width, height: store.get().canvasSize.height }),
			);

			// Read-only viewer role: disable editing and never publish local edits.
			publishSuppressed = config.role === 'viewer';
			if (publishSuppressed) {
				editableBeforeViewer = store.get().editable;
				deps.setEditable(false);
			}

			// Gate local writes on the provider's initial sync; the grace timer
			// covers a lone webrtc peer that never receives a sync event.
			syncGate.reset();
			provider.onSynced(() => syncGate.open());
			if (provider.syncedNow) {
				syncGate.open();
			} else {
				syncGate.arm();
			}

			if (transport === 'webrtc') {
				// Same-browser tabs meet over BroadcastChannel at once (no server wait).
				setStatus('connected');
				// y-webrtc reports peer connectivity via the same onStatus surface;
				// re-arm the gate on a drop so a reconnect re-gates writes instead
				// of leaving it permanently open from the first connection.
				provider.onStatus((isConnected) => {
					if (isConnected) {
						setStatus('connected');
					} else if (active) {
						setStatus('disconnected');
						syncGate.reset();
						syncGate.arm();
					}
				});
			} else {
				provider.onStatus((isConnected) => {
					if (isConnected) {
						clearConnectTimer();
						setStatus('connected');
					} else if (active) {
						setStatus('disconnected');
						// Re-arm on (re)connect: without this, a peer that drops and
						// rejoins keeps the gate permanently open from the first
						// connection and can clobber the room with a stale local doc.
						syncGate.reset();
						syncGate.arm();
					}
				});
				if (provider.connectedNow) {
					setStatus('connected');
				} else {
					connectTimer = setTimeout(() => {
						connectTimer = null;
						if (status !== 'connected') {
							stop();
							setStatus('error');
						}
					}, CONNECTION_TIMEOUT_MS);
				}
			}

			// Observe remote slide changes, skipping our own reconcile transactions.
			unobserveSlides = observeYDocSlides(currentYDoc, (_events, transaction) => {
				if (transaction?.origin === LOCAL_SYNC_ORIGIN || slidesSync.isApplyingRemote()) {
					return;
				}
				slidesSync.applyRemoteSlides(currentYDoc, config);
			});

			// Broadcast local slide edits granularly (diff by id, one transaction).
			// Suppressed until the sync gate opens; the gate flushes on open.
			unsubscribeStore = store.subscribe((state, previous) => {
				if (state.slides !== previous.slides && syncGate.isOpen()) {
					flushLocal();
				}
			});

			active = true;
		} catch {
			stop();
			setStatus('error');
		}
	}

	function stop(): void {
		clearConnectTimer();
		writeBack.cancel();
		syncGate.reset();
		slidesSync.reset();
		unobserveSlides?.();
		unobserveSlides = null;
		unsubscribeStore?.();
		unsubscribeStore = null;
		presence?.destroy();
		presence = null;
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		currentYDoc = null;
		yFactories = null;
		// Restore the editing state a viewer-role session forced off.
		if (publishSuppressed && editableBeforeViewer !== null) {
			deps.setEditable(editableBeforeViewer);
		}
		publishSuppressed = false;
		editableBeforeViewer = null;
		active = false;
		setStatus('disconnected');
	}

	return {
		start,
		stop,
		isActive: () => active,
		getStatus: () => status,
		setCursor: (x, y, activeSlideIndex) => presence?.setCursor(x, y, activeSlideIndex),
		setSelection: (selectedElementId, activeSlideIndex) =>
			presence?.setSelection(selectedElementId, activeSlideIndex),
		setActiveSlide: (index) => presence?.setActiveSlide(index),
		followUser: (clientId) => presence?.followUser(clientId ?? null),
		getConfig: () => lastConfig,
		destroy: stop,
	};
}
