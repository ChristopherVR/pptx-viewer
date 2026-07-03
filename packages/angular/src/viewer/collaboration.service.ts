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
	CollaborationRole,
	ConnectionStatus,
	YjsFactories,
	YTransactionLike,
} from '../internal/shared';
import {
	CONNECTION_TIMEOUT_MS,
	LOCAL_SYNC_ORIGIN,
	derivePresenceList,
	isMixedContentBlocked,
	observeYDocSlides,
	presenceToCursors,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
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

	private onRemoteSlides: ((slides: PptxSlide[]) => void) | null = null;
	private canvasWidth = DEFAULT_CANVAS_BOUND;
	private canvasHeight = DEFAULT_CANVAS_BOUND;
	private getSourceBytes: (() => Uint8Array | null) | null = null;
	private getTemplateElements: (() => TemplateElementsBySlideId) | null = null;
	private currentConfig: CollaborationConfig | null = null;
	private lastConfig: CollaborationConfig | null = null;
	private lastOptions: ConnectOptions = {};
	private localPresence: LocalPresencePublisher | null = null;

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
		this.lastConfig = config;
		this.lastOptions = options;
		try {
			validateRoomId(config.roomId);
		} catch {
			this.status.set('error');
			return;
		}

		// Fail fast on mixed content (websocket only): an https page cannot open a
		// ws:// socket, so surface the error rather than hanging until the timeout.
		if (config.transport !== 'webrtc' && isMixedContentBlocked(config.serverUrl)) {
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
				config.transport === 'webrtc'
					? await createWebrtcBundle(config)
					: await createWebsocketBundle(config);
			this.ydoc = bundle.doc;
			this.yFactories = bundle.factories;
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

			this.wireStatus(config);

			this.unobserveSlides = observeYDocSlides(this.ydoc, (_events, transaction) =>
				this.onRemoteChange(transaction),
			);

			this.active.set(true);
			this.refreshPresence();
		} catch {
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
	private wireStatus(config: CollaborationConfig): void {
		const provider = this.provider;
		if (!provider) {
			return;
		}
		if (config.transport === 'webrtc') {
			// P2P: no server round-trip to wait on. Treat "created" as connected,
			// and reflect explicit disconnect events.
			this.status.set('connected');
			provider.on('status', (payload) => {
				if (payload.connected === false && this.active()) {
					this.status.set('disconnected');
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
		this.clearConnectTimer();
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

	broadcastSlides(slides: readonly PptxSlide[]): void {
		if (!this.ydoc || !this.yFactories || this.applyingRemote || slides.length === 0) {
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
