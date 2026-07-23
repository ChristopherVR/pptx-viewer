/**
 * CollaborationService: Angular real-time collaboration (Yjs) service.
 *
 * Owns the provider lifecycle and the reactive collaboration state consumed by
 * the viewer component:
 *  - Transport is `y-websocket` (default) or serverless `y-webrtc`
 *    (`config.transport === 'webrtc'`), created via `./collaboration-providers`.
 *  - Local edits sync via the granular `reconcileSlidesInYDoc` (only changed
 *    slides/elements/fields mutate) in a transaction tagged `LOCAL_SYNC_ORIGIN`;
 *    the remote observer skips its own local-origin writes.
 *  - Websocket connections fail fast on mixed content and time out to `'error'`
 *    after `CONNECTION_TIMEOUT_MS`; `retry()` reconnects with the last config.
 *  - Elected-writer write-back (role === 'owner') via `WriteBackScheduler`.
 *
 * Provide at the component level: `@Component({ providers: [CollaborationService] })`.
 */

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type {
	CollaborationConfig,
	CollaborationLivePatcher,
	CollaborationRole,
	CollaborationTransport,
	ConnectionStatus,
	YjsFactories,
	YTransactionLike,
} from '../internal/shared';
import {
	CONNECTION_TIMEOUT_MS,
	LOCAL_SYNC_ORIGIN,
	YDOC_SLIDES_KEY,
	createCollaborationLivePatcher,
	createSyncGate,
	derivePresenceList,
	isMixedContentBlocked,
	observeYDocSlides,
	presenceToCursors,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
	resolveTransportForServerUrl,
	validateRoomId,
} from '../internal/shared';
import { DEFAULT_CURSOR_COLOR } from './collaboration-helpers';
import type { RemoteCursor, RemotePresence } from './collaboration-helpers';
import { LocalPresencePublisher } from './collaboration-local-presence';
import { createWebrtcBundle, createWebsocketBundle } from './collaboration-providers';
import type { AwarenessLike, DestroyableYDoc, ProviderLike } from './collaboration-providers';
import { WriteBackScheduler } from './collaboration-writeback';
import type { TemplateElementsBySlideId } from './template-mode';

export interface ConnectOptions {
	onRemoteSlides?: (slides: PptxSlide[]) => void;
	canvasWidth?: number;
	canvasHeight?: number;
	getSourceBytes?: () => Uint8Array | null;
	/**
	 * Returns the editor's separated template (master/layout) elements keyed by
	 * slide id, so the elected-writer write-back can merge them back into the
	 * broadcast (template-free) slides before serializing. Without this, template
	 * edits would be dropped from the persisted deck.
	 */
	getTemplateElements?: () => TemplateElementsBySlideId;
}

const DEFAULT_CANVAS_BOUND = 100_000;

@Injectable()
export class CollaborationService {
	// Reactive state
	readonly status = signal<ConnectionStatus>('disconnected');
	readonly connected = computed<boolean>(() => this.status() === 'connected');
	readonly active = signal(false);
	/** Role of the local user in the active session, or undefined when idle. */
	readonly activeRole = signal<CollaborationRole | undefined>(undefined);
	readonly presence = signal<RemotePresence[]>([]);
	readonly cursors = computed<RemoteCursor[]>(() => presenceToCursors(this.presence()));
	readonly connectedCount = computed<number>(
		() => this.presence().length + (this.active() ? 1 : 0),
	);

	/** The client id the local user is currently following (null when free). */
	readonly followedClientId = signal<number | null>(null);
	/** Active-slide index of the followed peer, or null when not following. */
	readonly followedSlideIndex = computed<number | null>(() => {
		const id = this.followedClientId();
		if (id === null) {
			return null;
		}
		return this.presence().find((p) => p.clientId === id)?.activeSlideIndex ?? null;
	});
	/** Active-slide index of the first `owner` peer (the broadcaster), or null. */
	readonly broadcasterSlideIndex = computed<number | null>(
		() => this.presence().find((p) => p.role === 'owner')?.activeSlideIndex ?? null,
	);

	/**
	 * Interim ("live preview") Y.Doc write channel: publishes in-flight inline
	 * editor text that has not reached the slides state yet, so peers see typing
	 * as it happens instead of on commit. Dormant outside a session.
	 */
	readonly livePatcher: CollaborationLivePatcher = createCollaborationLivePatcher();

	// Internal handles
	private ydoc: DestroyableYDoc | null = null;
	private provider: ProviderLike | null = null;
	private awareness: AwarenessLike | null = null;
	private selfId = -1;
	private applyingRemote = false;
	private yFactories: YjsFactories | null = null;
	private lastSynced = '';
	private connectTimer: ReturnType<typeof setTimeout> | null = null;
	private unobserveSlides: (() => void) | null = null;
	private readonly writeBack = new WriteBackScheduler();
	/**
	 * First-write gate: local broadcasts are suppressed (captured as pending)
	 * until the provider confirms its initial sync or the grace period lifts
	 * the gate, so a late joiner never seeds its placeholder deck into a room
	 * whose real content has not arrived yet.
	 */
	private readonly syncGate = createSyncGate(() => this.flushPendingBroadcast());
	private pendingBroadcast: readonly PptxSlide[] | null = null;

	private onRemoteSlides: ((slides: PptxSlide[]) => void) | null = null;
	private canvasWidth = DEFAULT_CANVAS_BOUND;
	private canvasHeight = DEFAULT_CANVAS_BOUND;
	private getSourceBytes: (() => Uint8Array | null) | null = null;
	private getTemplateElements: (() => TemplateElementsBySlideId) | null = null;
	private currentConfig: CollaborationConfig | null = null;
	private lastConfig: CollaborationConfig | null = null;
	private lastOptions: ConnectOptions = {};
	private localPresence: LocalPresencePublisher | null = null;
	/**
	 * Reentrancy token for {@link connect}: bumped by every connect() and
	 * disconnect(). A connect() whose token no longer matches after an await was
	 * superseded, so it tears down whatever it just created and leaves the
	 * service state to the newer call (a second provider join on the same room
	 * would otherwise throw inside Yjs and kill the surviving session).
	 */
	private connectToken = 0;

	private readonly refreshPresence = (): void => {
		if (!this.awareness) {
			this.presence.set([]);
			return;
		}
		this.presence.set(
			derivePresenceList(
				this.awareness.getStates(),
				this.selfId,
				this.canvasWidth,
				this.canvasHeight,
			),
		);
	};

	constructor() {
		inject(DestroyRef).onDestroy(() => this.disconnect());
	}

	async connect(config: CollaborationConfig, options: ConnectOptions = {}): Promise<void> {
		this.disconnect();
		const token = ++this.connectToken;
		this.lastConfig = config;
		this.lastOptions = options;
		try {
			validateRoomId(config.roomId);
		} catch {
			this.status.set('error');
			return;
		}

		// Falls back from a blank serverUrl the same way Vue's session layer
		// already does, so a bare CollaborationConfig behaves identically
		// regardless of which binding's session layer receives it directly (not
		// just via the Share/Broadcast dialogs, which already pre-resolve it).
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);

		// Fail fast on mixed content (websocket only): an https page cannot open a
		// ws:// socket, so surface the error rather than hanging until the timeout.
		if (transport !== 'webrtc' && isMixedContentBlocked(config.serverUrl)) {
			this.status.set('error');
			return;
		}

		this.onRemoteSlides = options.onRemoteSlides ?? null;
		this.canvasWidth = options.canvasWidth ?? DEFAULT_CANVAS_BOUND;
		this.canvasHeight = options.canvasHeight ?? DEFAULT_CANVAS_BOUND;
		this.getSourceBytes = options.getSourceBytes ?? null;
		this.getTemplateElements = options.getTemplateElements ?? null;
		this.currentConfig = config;
		this.activeRole.set(config.role);

		this.status.set('connecting');
		try {
			const bundle =
				transport === 'webrtc'
					? await createWebrtcBundle(config)
					: await createWebsocketBundle(config);
			if (token !== this.connectToken) {
				// Superseded by a newer connect() or a disconnect() while awaiting
				// the transport: destroy the just-created bundle and bail without
				// touching the (newer call's) service state.
				bundle.provider.disconnect();
				bundle.provider.destroy();
				bundle.doc.destroy();
				return;
			}
			this.ydoc = bundle.doc;
			this.yFactories = bundle.factories;
			this.livePatcher.configure(bundle.doc, bundle.factories);
			this.provider = bundle.provider;
			this.awareness = bundle.awareness;
			this.selfId = this.awareness.clientID ?? -1;
			this.localPresence = new LocalPresencePublisher(this.awareness, {
				userName: config.userName,
				userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
				userAvatar: config.userAvatar,
				role: config.role,
			});

			this.localPresence.publish();
			this.awareness.on('change', this.refreshPresence);
			this.awareness.on('update', this.refreshPresence);

			this.wireStatus(transport);
			this.syncGate.reset();
			this.wireSynced();

			this.unobserveSlides = observeYDocSlides(this.ydoc, (_events, transaction) =>
				this.onRemoteChange(transaction),
			);

			this.active.set(true);
			this.refreshPresence();
		} catch {
			if (token !== this.connectToken) {
				// A newer connect() owns the service state; do not tear it down.
				return;
			}
			this.disconnect();
			this.status.set('error');
		}
	}

	/** Reconnect using the configuration from the most recent {@link connect}. */
	async retry(): Promise<void> {
		if (this.lastConfig) {
			await this.connect(this.lastConfig, this.lastOptions);
		}
	}

	/** Wire the provider status events + (websocket-only) connection timeout. */
	private wireStatus(transport: CollaborationTransport): void {
		const provider = this.provider;
		if (!provider) {
			return;
		}
		if (transport === 'webrtc') {
			// P2P: no server round-trip to wait on. Treat "created" as connected,
			// and reflect explicit disconnect events.
			this.status.set('connected');
			provider.on('status', (payload) => {
				if (payload.connected === false && this.active()) {
					this.status.set('disconnected');
					// Re-arm on (re)connect: without this, a peer that drops and
					// rejoins keeps the gate permanently open from the first
					// connection and can clobber the room with a stale local doc.
					this.syncGate.reset();
					this.syncGate.arm();
				} else if (payload.connected === true) {
					this.status.set('connected');
				}
			});
			return;
		}
		provider.on('status', (payload) => {
			if (payload.status === 'connected') {
				this.clearConnectTimer();
				this.status.set('connected');
			} else if (payload.status === 'disconnected' && this.active()) {
				this.status.set('disconnected');
				this.syncGate.reset();
				this.syncGate.arm();
			}
		});
		if (provider.wsconnected) {
			this.status.set('connected');
			return;
		}
		this.connectTimer = setTimeout(() => {
			this.connectTimer = null;
			if (this.status() !== 'connected') {
				this.disconnect();
				this.status.set('error');
			}
		}, CONNECTION_TIMEOUT_MS);
	}

	/**
	 * Open the first-write gate on the provider's initial-sync confirmation.
	 * y-websocket emits 'sync' with a boolean; y-webrtc emits 'synced' with an
	 * object carrying a `synced` flag (and only once a peer syncs, hence the
	 * grace timer). Listen to both; opening is idempotent.
	 */
	private wireSynced(): void {
		const provider = this.provider;
		if (!provider) {
			return;
		}
		const handle = (payload: unknown): void => {
			const flag = payload as boolean | { synced?: boolean } | undefined;
			const isSynced = typeof flag === 'boolean' ? flag : flag?.synced !== false;
			if (isSynced) {
				this.syncGate.open();
			}
		};
		provider.on('sync', handle);
		provider.on('synced', handle);
		if (provider.synced === true) {
			this.syncGate.open();
		} else {
			this.syncGate.arm();
		}
	}

	/**
	 * Perform the deferred first broadcast once the gate opens. When the doc is
	 * still empty (fresh room, or nobody else present), clear the baseline so
	 * the pending deck actually seeds it; when remote content already arrived,
	 * the pending deck matches the applied baseline and the write is a no-op.
	 */
	private flushPendingBroadcast(): void {
		const pending = this.pendingBroadcast;
		this.pendingBroadcast = null;
		if (!pending || !this.ydoc || !this.yFactories) {
			return;
		}
		if (this.ydoc.getArray(YDOC_SLIDES_KEY).length === 0) {
			this.lastSynced = '';
		}
		this.broadcastSlides(pending);
	}

	/** Handle a remote Y.Doc change, skipping our own local-origin transactions. */
	private onRemoteChange(transaction?: YTransactionLike): void {
		if (transaction?.origin === LOCAL_SYNC_ORIGIN || this.applyingRemote || !this.ydoc) {
			return;
		}
		const remote = readSlidesFromYDoc(this.ydoc);
		if (remote.length === 0) {
			return;
		}
		// Suppress the echo: record what we just applied so the subsequent local
		// broadcast (driven by the editor signal) is a no-op.
		this.lastSynced = JSON.stringify(remote);
		this.applyingRemote = true;
		this.onRemoteSlides?.(remote);
		this.applyingRemote = false;
		this.scheduleWriteBack();
	}

	disconnect(): void {
		// Invalidate any in-flight connect() so it discards its bundle on resume.
		this.connectToken += 1;
		this.clearConnectTimer();
		this.syncGate.reset();
		this.pendingBroadcast = null;
		this.writeBack.cancel();
		this.unobserveSlides?.();
		this.unobserveSlides = null;
		this.awareness?.off?.('change', this.refreshPresence);
		this.awareness?.off?.('update', this.refreshPresence);
		this.provider?.disconnect();
		this.provider?.destroy();
		this.ydoc?.destroy();

		this.provider = null;
		this.ydoc = null;
		this.awareness = null;
		this.localPresence = null;
		this.selfId = -1;
		this.applyingRemote = false;
		this.yFactories = null;
		this.livePatcher.configure(null, null);
		this.lastSynced = '';
		this.onRemoteSlides = null;
		this.currentConfig = null;

		this.status.set('disconnected');
		this.active.set(false);
		this.activeRole.set(undefined);
		this.presence.set([]);
		this.followedClientId.set(null);
	}

	/**
	 * Broadcast the local slide set to peers, reconciling only what changed into
	 * the pptx:slides Y.Array. An empty deck is never written (so a late-joiner
	 * that has not yet received the doc cannot clobber it), and an unchanged deck
	 * is skipped.
	 */
	/**
	 * Record the current local deck as the sync baseline so the first (unchanged)
	 * broadcast after connecting is suppressed. Call right after {@link connect}
	 * for a joiner whose local deck is a placeholder awaiting remote sync, so it
	 * never overwrites the shared document before receiving it.
	 */
	seedBaseline(slides: readonly PptxSlide[]): void {
		this.lastSynced = JSON.stringify(slides);
	}

	/**
	 * Re-adopt the shared document's slides after a local content load has been
	 * committed to viewer state. The load pipeline applies its parsed deck
	 * unconditionally, so a load that finishes AFTER the room's slides were
	 * already applied (a late joiner's bootstrap deck parsing slower than the
	 * doc sync) silently clobbers the synced state and, with the doc itself
	 * unchanged, the remote observer never re-fires. When the room already has
	 * slides they win: the doc content is re-applied through `onRemoteSlides`
	 * and recorded as the sync baseline (bypassing the usual JSON dedupe) so
	 * the follow-up local broadcast of the adopted deck is a no-op. An empty
	 * room means this client is the seeder and the loaded deck stands, written
	 * by the normal gated broadcast path. Returns true when the doc was adopted.
	 */
	adoptDocSlidesAfterLoad(): boolean {
		if (!this.ydoc || !this.connected()) {
			return false;
		}
		const docSlides = readSlidesFromYDoc(this.ydoc);
		if (docSlides.length === 0) {
			return false;
		}
		this.lastSynced = JSON.stringify(docSlides);
		this.applyingRemote = true;
		this.onRemoteSlides?.(docSlides);
		this.applyingRemote = false;
		return true;
	}

	broadcastSlides(slides: readonly PptxSlide[]): void {
		if (!this.ydoc || !this.yFactories || this.applyingRemote || slides.length === 0) {
			return;
		}
		if (!this.syncGate.isOpen()) {
			// Defer until the initial sync confirms; the gate flushes the latest
			// pending deck when it opens.
			this.pendingBroadcast = slides;
			return;
		}
		const s = JSON.stringify(slides);
		if (s === this.lastSynced) {
			return;
		}
		this.lastSynced = s;
		reconcileSlidesInYDoc([...slides], this.ydoc, this.yFactories, LOCAL_SYNC_ORIGIN);
		this.scheduleWriteBack();
	}

	setCursor(x: number, y: number, activeSlideIndex?: number): void {
		this.localPresence?.setCursor(x, y, activeSlideIndex);
	}

	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void {
		this.localPresence?.setSelection(selectedElementId, activeSlideIndex);
	}

	/** Publish the local active-slide index (drives follow-along). */
	setActiveSlide(index: number): void {
		this.localPresence?.setActiveSlide(index);
	}

	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void {
		this.followedClientId.set(clientId);
	}

	private clearConnectTimer(): void {
		if (this.connectTimer !== null) {
			clearTimeout(this.connectTimer);
			this.connectTimer = null;
		}
	}

	private scheduleWriteBack(): void {
		this.writeBack.schedule(
			this.currentConfig,
			this.ydoc,
			this.getSourceBytes,
			this.getTemplateElements,
		);
	}
}
