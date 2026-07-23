import type { PptxHandler } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	CollaborationLivePatcher,
	ConnectionStatus,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	createCollaborationLivePatcher,
	createSyncGate,
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { ConnectionWiring } from './collaboration-connection';
import { wireConnectionStatus } from './collaboration-connection';
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
	/**
	 * The load pipeline is about to commit a parsed deck to the store: suppress
	 * local->doc slide publishing until {@link notifyContentLoaded} runs, so a
	 * late joiner's bootstrap deck is never written into the room's doc before
	 * the adoption check.
	 */
	beginContentLoad(): void;
	/**
	 * A content load finished applying to viewer state. When the shared doc
	 * already holds slides (the room content arrived while the load was still
	 * parsing), adopt them over the just-loaded deck; when the doc is empty this
	 * client is the seeder and the deferred publish of the loaded deck runs.
	 */
	notifyContentLoaded(): void;
	/**
	 * Interim ("live preview") Y.Doc write channel: publishes in-flight inline
	 * editor text that has not reached the store yet, so peers see typing as it
	 * happens instead of on commit. Dormant outside a session.
	 */
	readonly livePatcher: CollaborationLivePatcher;
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
	let connection: ConnectionWiring | null = null;
	let loadApplying = false;
	const livePatcher = createCollaborationLivePatcher();

	function setStatus(next: ConnectionStatus): void {
		if (next === status) {
			return;
		}
		status = next;
		deps.onStatusChange?.(next);
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
			livePatcher.configure(currentYDoc, yFactories);

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

			// Connection-status wiring (incl. websocket connect timeout and the
			// gate re-arm on drops) lives in collaboration-connection.ts.
			connection = wireConnectionStatus({
				provider,
				transport,
				setStatus,
				isActive: () => active,
				reArmGate: () => {
					syncGate.reset();
					syncGate.arm();
				},
				onConnectTimeout: () => {
					if (status !== 'connected') {
						stop();
						setStatus('error');
					}
				},
			});

			// Observe remote slide changes, skipping our own reconcile transactions.
			unobserveSlides = observeYDocSlides(currentYDoc, (_events, transaction) => {
				if (transaction?.origin === LOCAL_SYNC_ORIGIN || slidesSync.isApplyingRemote()) {
					return;
				}
				slidesSync.applyRemoteSlides(currentYDoc, config);
			});

			// Broadcast local slide edits granularly (diff by id, one transaction).
			// Suppressed until the sync gate opens (the gate flushes on open) and
			// while the load pipeline is committing a parsed deck (adoption in
			// notifyContentLoaded decides whether that deck may be published).
			unsubscribeStore = store.subscribe((state, previous) => {
				if (state.slides !== previous.slides && !loadApplying && syncGate.isOpen()) {
					flushLocal();
				}
			});

			active = true;
		} catch {
			stop();
			setStatus('error');
		}
	}

	// Content-load adoption: the load pipeline commits its parsed deck to the
	// store unconditionally, so a late joiner whose bootstrap deck finishes
	// parsing AFTER the room's slides were applied would clobber the synced
	// state and, with the doc itself unchanged, the observer never re-fires to
	// repair it. The load path brackets its commit with beginContentLoad /
	// notifyContentLoaded: publishing is suppressed for that window, then the
	// room's slides win when the doc has content (applyRemoteSlides bypasses
	// the JSON dedupe and re-arms it against the echo); an empty doc means this
	// client is the seeder, so the suppressed publish runs now instead.
	function beginContentLoad(): void {
		loadApplying = true;
	}

	function notifyContentLoaded(): void {
		const suppressed = loadApplying;
		loadApplying = false;
		if (!active || !currentYDoc || !lastConfig) {
			return;
		}
		if (slidesSync.applyRemoteSlides(currentYDoc, lastConfig)) {
			return;
		}
		if (suppressed && syncGate.isOpen()) {
			flushLocal();
		}
	}

	function stop(): void {
		connection?.cancelConnectTimer();
		connection = null;
		loadApplying = false;
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
		livePatcher.configure(null, null);
		// Restore the editing state a viewer-role session forced off.
		if (publishSuppressed && editableBeforeViewer !== null) {
			deps.setEditable(editableBeforeViewer);
		}
		publishSuppressed = false;
		editableBeforeViewer = null;
		active = false;
		setStatus('disconnected');
	}

	// Viewer destruction is not the only way a session ends: a tab close, a
	// navigation, or an embedding page detaching the viewer's iframe destroys the
	// document without running any of our teardown, leaving a ghost peer in
	// everyone else's presence list. Leave the room from `pagehide` too.
	const disposeTeardown = registerCollaborationTeardown({
		leave: stop,
		rejoin: () => {
			if (lastConfig) {
				void start(lastConfig);
			}
		},
	});

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
		beginContentLoad,
		notifyContentLoaded,
		livePatcher,
		destroy: () => {
			disposeTeardown();
			stop();
		},
	};
}
