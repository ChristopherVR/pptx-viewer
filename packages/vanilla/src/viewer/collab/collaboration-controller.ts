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
	isMixedContentBlocked,
	LOCAL_SYNC_ORIGIN,
	observeYDocSlides,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';

import { clampSlideIndex } from '../state';
import type { Store, ViewerState } from '../state';
import type { CollabProviderHandle } from './collaboration-provider';
import { createCollabProvider } from './collaboration-provider';

/**
 * Real-time collaboration for the vanilla viewer over Yjs (y-websocket or
 * serverless y-webrtc), ported from the Vue `useCollaboration` composable minus
 * its reactive presence layer (see the module JSDoc caveats).
 *
 * Slide sync is granular via the shared `reconcileSlidesInYDoc` (tagged
 * `LOCAL_SYNC_ORIGIN` so the observer skips our own writes), matching the
 * React/Vue/Angular apply path exactly rather than a naive whole-array replace
 * on the wire. Local edits publish by subscribing to the viewer store; remote
 * edits apply by writing the reconstructed slides back into the store.
 *
 * KNOWN LIMITATIONS (they live in `pptx-viewer-shared`; fixing them is out of
 * scope here):
 *  - the codec allowlists drop binary media/OLE/3D/ink fields, so those
 *    elements travel structurally but without their embedded bytes;
 *  - a remote update replaces the whole local slides array, which can degrade
 *    host-provided media elements whose blob URLs are keyed in the separate
 *    `mediaDataUrls` map a late joiner never received;
 *  - collaboration undo semantics are undefined: the local `EditorHistory`
 *    stack keeps working but does not coordinate with peers.
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
	/** Stop and release everything (viewer destroy). */
	destroy(): void;
}

const WRITE_BACK_DEBOUNCE_MS = 5_000;

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
	let applyingRemote = false;
	let publishSuppressed = false;
	let editableBeforeViewer: boolean | null = null;
	let lastSynced = '';
	let lastConfig: CollaborationConfig | null = null;
	let unobserveSlides: (() => void) | null = null;
	let unsubscribeStore: (() => void) | null = null;
	let connectTimer: ReturnType<typeof setTimeout> | null = null;
	let writeBackTimer: ReturnType<typeof setTimeout> | null = null;

	function setStatus(next: ConnectionStatus): void {
		if (next === status) {
			return;
		}
		status = next;
		deps.onStatusChange?.(next);
	}

	function clearTimers(): void {
		if (connectTimer !== null) {
			clearTimeout(connectTimer);
			connectTimer = null;
		}
		if (writeBackTimer !== null) {
			clearTimeout(writeBackTimer);
			writeBackTimer = null;
		}
	}

	/** Elected-writer (role `owner`) persistence: re-serialize the doc to bytes. */
	function scheduleWriteBack(config: CollaborationConfig): void {
		if (!config.onWriteBack || config.role !== 'owner') {
			return;
		}
		if (writeBackTimer !== null) {
			clearTimeout(writeBackTimer);
		}
		const debounceMs = config.writeBackDebounceMs ?? WRITE_BACK_DEBOUNCE_MS;
		writeBackTimer = setTimeout(() => {
			writeBackTimer = null;
			const handler = deps.getHandler();
			if (!currentYDoc || !handler || !config.onWriteBack) {
				return;
			}
			void handler
				.save(readSlidesFromYDoc(currentYDoc))
				.then((bytes) => config.onWriteBack?.(bytes))
				.catch(() => {
					/* non-fatal: host can retry on the next change */
				});
		}, debounceMs);
	}

	/** Publish the current local slides into the doc (granular, echo-deduped). */
	function flushLocalSlides(): void {
		if (!currentYDoc || !yFactories || applyingRemote || publishSuppressed) {
			return;
		}
		const slides = store.get().slides;
		const serialized = JSON.stringify(slides);
		if (serialized === lastSynced) {
			return;
		}
		lastSynced = serialized;
		reconcileSlidesInYDoc(slides, currentYDoc, yFactories);
		if (lastConfig) {
			scheduleWriteBack(lastConfig);
		}
	}

	// First-write gate: until the provider confirms its initial sync (or the
	// grace period elapses for a lone webrtc peer), local slides must not seed
	// the doc, or a late joiner's bootstrap deck would merge into the room's real
	// content. Opening the gate performs the deferred first write.
	const syncGate = createSyncGate(flushLocalSlides);

	function applyRemoteSlides(config: CollaborationConfig): void {
		if (!currentYDoc) {
			return;
		}
		const remote = readSlidesFromYDoc(currentYDoc);
		if (remote.length === 0) {
			return;
		}
		applyingRemote = true;
		store.set({
			slides: remote,
			currentSlide: clampSlideIndex(store.get().currentSlide, remote.length),
		});
		applyingRemote = false;
		// Dedupe the echo: the store change this triggers is a no-op for us.
		lastSynced = JSON.stringify(remote);
		scheduleWriteBack(config);
	}

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
			} else {
				provider.onStatus((isConnected) => {
					if (isConnected) {
						if (connectTimer !== null) {
							clearTimeout(connectTimer);
							connectTimer = null;
						}
						setStatus('connected');
					} else if (active) {
						setStatus('disconnected');
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
				if (transaction?.origin === LOCAL_SYNC_ORIGIN || applyingRemote) {
					return;
				}
				applyRemoteSlides(config);
			});

			// Broadcast local slide edits granularly (diff by id, one transaction).
			// Suppressed until the sync gate opens; the gate flushes on open.
			unsubscribeStore = store.subscribe((state, previous) => {
				if (state.slides !== previous.slides && syncGate.isOpen()) {
					flushLocalSlides();
				}
			});

			active = true;
		} catch {
			stop();
			setStatus('error');
		}
	}

	function stop(): void {
		clearTimers();
		syncGate.reset();
		unobserveSlides?.();
		unobserveSlides = null;
		unsubscribeStore?.();
		unsubscribeStore = null;
		provider?.destroy();
		ydoc?.destroy();
		provider = null;
		ydoc = null;
		currentYDoc = null;
		yFactories = null;
		applyingRemote = false;
		lastSynced = '';
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
		destroy: stop,
	};
}
