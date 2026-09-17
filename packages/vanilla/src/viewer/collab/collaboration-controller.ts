import type {
	CollabLoadOrigin,
	CollaborationConfig,
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
	readSlidesFromYDoc,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	shouldRoomSlidesReplaceLoad,
	validateRoomId,
} from 'pptx-viewer-shared';

import type { ConnectionWiring } from './collaboration-connection';
import { wireConnectionStatus } from './collaboration-connection';
import type {
	CollaborationController,
	CollaborationControllerDeps,
} from './collaboration-controller-types';
import { createCollaborationEditState } from './collaboration-edit-state';
import type { ExternalSessionSync } from './collaboration-external-sync';
import { createExternalSessionSync } from './collaboration-external-sync';
import type { PresenceController } from './collaboration-presence';
import { createPresenceController } from './collaboration-presence';
import type { CollaborationSession } from './collaboration-session';
import { createCollaborationSession } from './collaboration-session';
import { createSlidesSync } from './collaboration-slides-sync';
import type { SlidesSync } from './collaboration-slides-sync';
import { createWriteBackScheduler } from './collaboration-writeback';

/**
 * Yjs collaboration with built-in transports or a borrowed host session.
 * Granular slide sync and presence live in their focused modules.
 *
 * KNOWN LIMITATION: collaboration undo semantics are undefined - the local
 * `EditorHistory` stack keeps working but does not coordinate with peers
 * (matches React/Vue/Angular).
 */

export function createCollaborationController(
	deps: CollaborationControllerDeps,
): CollaborationController {
	const { store } = deps;

	let status: ConnectionStatus = 'disconnected';
	let active = false;
	let session: CollaborationSession | null = null;
	let generation = 0;
	let externalSync: ExternalSessionSync | null = null;
	let currentYDoc: YDocLike | null = null;
	let yFactories: YjsFactories | null = null;
	let presence: PresenceController | null = null;
	const editState = createCollaborationEditState(deps);
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
		getSaveOptions: deps.getSaveOptions,
	});

	const slidesSync: SlidesSync = createSlidesSync(store, (config) => {
		if (!config.externalSession || syncGate.isOpen()) {
			writeBack.schedule(config);
		}
	});

	function flushLocal(): void {
		slidesSync.flushLocalSlides(currentYDoc, yFactories, lastConfig, editState.isReadOnly());
	}
	// Prevent a bootstrap deck from preceding initial sync. Built-in transports
	// retain their grace timer; external sessions only use host readiness.
	const syncGate = createSyncGate(flushLocal);

	async function start(config: CollaborationConfig): Promise<void> {
		stop();
		const token = generation;
		lastConfig = config;
		try {
			validateRoomId(config.roomId);
		} catch {
			setStatus('error');
			return;
		}
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		// Mixed-content only affects a ws:// socket from an https page.
		if (
			!config.externalSession &&
			transport === 'websocket' &&
			isMixedContentBlocked(config.serverUrl)
		) {
			setStatus('error');
			return;
		}
		setStatus('connecting');
		editState.setReadOnly(Boolean(config.externalSession) || config.role === 'viewer');
		try {
			const created = await createCollaborationSession(config, transport);
			if (token !== generation) {
				created.dispose();
				return;
			}
			session = created;
			currentYDoc = created.doc;
			yFactories = created.factories;
			presence = createPresenceController(
				store,
				created.awareness,
				{
					userName: config.userName,
					userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
					userAvatar: config.userAvatar,
					role: config.role,
				},
				() => ({ width: store.get().canvasSize.width, height: store.get().canvasSize.height }),
			);

			// Observe remote slide changes, skipping our own reconcile transactions.
			if (!config.externalSession) {
				unobserveSlides = observeYDocSlides(currentYDoc, (_events, transaction) => {
					if (transaction?.origin === LOCAL_SYNC_ORIGIN || slidesSync.isApplyingRemote()) {
						return;
					}
					slidesSync.applyRemoteSlides(currentYDoc, config);
				});
			}

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
			if (config.externalSession) {
				externalSync = createExternalSessionSync(config.externalSession, config, {
					factories: created.factories,
					livePatcher,
					gate: syncGate,
					setStatus,
					setReadOnly: editState.setReadOnly,
					flushLocal,
					resetBaseline: slidesSync.reset,
					cancelWriteBack: writeBack.cancel,
					adoptSlides: (slides) => slidesSync.adoptSlides(slides, config),
				});
			} else if (created.provider) {
				const provider = created.provider;
				livePatcher.configure(
					editState.isReadOnly() ? null : currentYDoc,
					editState.isReadOnly() ? null : yFactories,
				);
				provider.onSynced(() => syncGate.open());
				if (provider.syncedNow) {
					syncGate.open();
				} else {
					syncGate.arm();
				}
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
			}
		} catch {
			if (token === generation) {
				stop();
				setStatus('error');
			}
		}
	}

	// Loads suppress publishing until adoption decides whether the room's deck
	// beats a late bootstrap. Explicit user-opened files instead replace the room.
	function beginContentLoad(_origin: CollabLoadOrigin): void {
		loadApplying = true;
	}

	function notifyContentLoaded(origin: CollabLoadOrigin): void {
		const suppressed = loadApplying;
		loadApplying = false;
		if (!active || !currentYDoc || !lastConfig) {
			return;
		}
		if (externalSync) {
			externalSync.contentLoaded(origin);
			return;
		}
		if (
			shouldRoomSlidesReplaceLoad(origin, readSlidesFromYDoc(currentYDoc).length) &&
			slidesSync.applyRemoteSlides(currentYDoc, lastConfig)
		) {
			return;
		}
		if (suppressed && syncGate.isOpen()) {
			flushLocal();
		}
	}

	function stop(): void {
		generation += 1;
		externalSync?.dispose();
		externalSync = null;
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
		session?.dispose();
		session = null;
		currentYDoc = null;
		yFactories = null;
		livePatcher.configure(null, null);
		active = false;
		editState.setReadOnly(false);
		setStatus('disconnected');
	}

	const disposeTeardown = registerCollaborationTeardown({
		leaveOnBeforeUnload: () => !lastConfig?.externalSession,
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
		isReadOnly: editState.isReadOnly,
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
