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
import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';

import type {
	CollabLoadOrigin,
	CollaborationConfig,
	CollaborationLivePatcher,
	CollaborationRole,
	ConnectionStatus,
} from '../internal/shared';
import {
	createCollaborationLivePatcher,
	createPresenceProjector,
	isMixedContentBlocked,
	presenceToCursors,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	validateRoomId,
} from '../internal/shared';
import type { RemoteCursor, RemotePresence } from './collaboration-helpers';
import { createWebrtcBundle, createWebsocketBundle } from './collaboration-providers';
import type { ActiveSession, ConnectOptions } from './collaboration-session-setup';
import { activateSession, teardownSession } from './collaboration-session-setup';
import { SlideSyncEngine } from './collaboration-slide-sync';
import { WriteBackScheduler } from './collaboration-writeback';
import type { TemplateElementsBySlideId } from './template-mode';

// Re-exported so existing importers of `ConnectOptions` from this module keep
// resolving after the interface moved to collaboration-session-setup.ts.
export type { ConnectOptions } from './collaboration-session-setup';

/** Sentinel canvas bound used until the host reports real dimensions. */
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

	// The live session's transport objects + wiring handles, owned as one atomic
	// unit: null when disconnected, assigned by connect(), disposed by
	// disconnect(). See collaboration-session-setup.ts.
	private session: ActiveSession | null = null;
	private readonly writeBack = new WriteBackScheduler();
	/** Granular local<->doc slide sync (gate + echo dedupe + broadcast/adopt). */
	private readonly slideSync = new SlideSyncEngine();

	private onRemoteSlides: ((slides: PptxSlide[]) => void) | null = null;
	private canvasWidth = DEFAULT_CANVAS_BOUND;
	private canvasHeight = DEFAULT_CANVAS_BOUND;
	private getSourceBytes: (() => Uint8Array | null) | null = null;
	private getTemplateElements: (() => TemplateElementsBySlideId) | null = null;
	private getSaveOptions: (() => PptxHandlerSaveOptions) | null = null;
	private currentConfig: CollaborationConfig | null = null;
	private lastConfig: CollaborationConfig | null = null;
	private lastOptions: ConnectOptions = {};
	/**
	 * Reentrancy token for {@link connect}: bumped by every connect() and
	 * disconnect(). A connect() whose token no longer matches after an await was
	 * superseded, so it tears down whatever it just created and leaves the
	 * service state to the newer call (a second provider join on the same room
	 * would otherwise throw inside Yjs and kill the surviving session).
	 */
	private connectToken = 0;

	/** Memoises the awareness -> presence projection so idle heartbeats are dropped. */
	private readonly projector = createPresenceProjector();

	private readonly refreshPresence = (): void => {
		const s = this.session;
		if (!s) {
			// Leaving the room clears the memo, so a re-join is never mistaken for
			// "nothing changed" against the previous session's peers.
			this.projector.reset();
			this.presence.set([]);
			return;
		}
		// A signal notifies on every `set` with a fresh array, and awareness fires
		// on each peer heartbeat as well as on our own writes, so this used to
		// re-run the collaboration overlay's computeds on a timer. The shared
		// projector reports whether anything visible actually moved (issue #145).
		const { list, changed } = this.projector.project(
			s.awareness.getStates(),
			s.selfId,
			this.canvasWidth,
			this.canvasHeight,
		);
		if (changed) {
			this.presence.set(list);
		}
	};

	constructor() {
		// Service destruction is not the only way a session ends: a tab close, a
		// navigation, or an embedding page detaching the viewer's iframe destroys
		// the document without running Angular teardown, leaving a ghost peer in
		// everyone else's presence list. Leave the room from `pagehide` too.
		const disposeTeardown = registerCollaborationTeardown({
			leave: () => this.disconnect(),
			rejoin: () => void this.retry(),
		});
		inject(DestroyRef).onDestroy(() => {
			disposeTeardown();
			this.disconnect();
		});
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
		this.getSaveOptions = options.getSaveOptions ?? null;
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
				bundle.departure.dispose();
				bundle.provider.disconnect();
				bundle.provider.destroy();
				bundle.doc.destroy();
				return;
			}
			this.session = activateSession(bundle, config, transport, {
				slideSync: this.slideSync,
				livePatcher: this.livePatcher,
				onRemoteSlides: this.onRemoteSlides,
				refreshPresence: this.refreshPresence,
				scheduleWriteBack: () => this.scheduleWriteBack(),
				setStatus: (status) => this.status.set(status),
				getStatus: () => this.status(),
				isActive: () => this.active(),
				failConnection: () => {
					this.disconnect();
					this.status.set('error');
				},
			});

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

	disconnect(): void {
		// Invalidate any in-flight connect() so it discards its bundle on resume.
		this.connectToken += 1;
		this.slideSync.reset();
		this.writeBack.cancel();
		if (this.session) {
			teardownSession(this.session, this.refreshPresence);
			this.session = null;
		}
		this.livePatcher.configure(null, null);
		this.onRemoteSlides = null;
		this.currentConfig = null;

		this.status.set('disconnected');
		this.active.set(false);
		this.activeRole.set(undefined);
		this.presence.set([]);
		this.followedClientId.set(null);
	}

	/**
	 * Record the current local deck as the sync baseline so the first (unchanged)
	 * broadcast after connecting is suppressed. Call right after {@link connect}
	 * for a joiner whose local deck is a placeholder awaiting remote sync.
	 */
	seedBaseline(slides: readonly PptxSlide[]): void {
		this.slideSync.seedBaseline(slides);
	}

	/**
	 * Re-adopt the shared document's slides after a local content load committed
	 * a parsed deck to viewer state (see {@link SlideSyncEngine.adoptDocAfterLoad}).
	 * Returns true when the room's slides were adopted over the loaded deck.
	 */
	adoptDocSlidesAfterLoad(origin: CollabLoadOrigin = 'user'): boolean {
		return this.connected() ? this.slideSync.adoptDocAfterLoad(origin) : false;
	}

	/**
	 * Broadcast the local slide set to peers, reconciling only what changed into
	 * the pptx:slides Y.Array. Empty/unchanged decks are skipped; while the gate
	 * is shut the deck is held pending until the initial sync confirms.
	 */
	broadcastSlides(slides: readonly PptxSlide[]): void {
		this.slideSync.broadcast(slides);
	}

	setCursor(x: number, y: number, activeSlideIndex?: number): void {
		this.session?.localPresence.setCursor(x, y, activeSlideIndex);
	}

	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void {
		this.session?.localPresence.setSelection(selectedElementId, activeSlideIndex);
	}

	/** Publish the local active-slide index (drives follow-along). */
	setActiveSlide(index: number): void {
		this.session?.localPresence.setActiveSlide(index);
	}

	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void {
		this.followedClientId.set(clientId);
	}

	private scheduleWriteBack(): void {
		this.writeBack.schedule(
			this.currentConfig,
			this.session?.ydoc ?? null,
			this.getSourceBytes,
			this.getTemplateElements,
			this.getSaveOptions,
		);
	}
}
