/**
 * CollaborationService: Angular real-time collaboration (Yjs) service.
 *
 * Owns viewer state and built-in transports, or borrows a host-owned session:
 *  - Transport is y-websocket (default) or serverless y-webrtc, created through
 *    collaboration-session-connect. External resources are never destroyed.
 *  - Local edits reconcile changed slides/elements/fields in a transaction
 *    tagged LOCAL_SYNC_ORIGIN; observers skip their own local writes.
 *  - Websocket connections fail fast on mixed content and time out to error;
 *    retry() reconnects with the last config.
 *  - Elected-writer write-back (role owner) uses the shared WriteBackScheduler.
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
	isMixedContentBlocked,
	registerCollaborationTeardown,
	resolveTransportForServerUrl,
	validateRoomId,
} from '../internal/shared';
import { CollaborationPresenceState } from './collaboration-presence-state';
import { connectSession } from './collaboration-session-connect';
import type { ActiveSession, ConnectOptions } from './collaboration-session-setup';
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
	/** Active viewer role or host readiness can temporarily block editing. */
	readonly readOnly = signal(false);
	private readonly presenceState = new CollaborationPresenceState();
	readonly presence = this.presenceState.presence;
	readonly cursors = this.presenceState.cursors;
	readonly connectedCount = computed<number>(
		() => this.presence().length + (this.active() ? 1 : 0),
	);

	readonly followedClientId = this.presenceState.followedClientId;
	readonly followedSlideIndex = this.presenceState.followedSlideIndex;
	readonly broadcasterSlideIndex = this.presenceState.broadcasterSlideIndex;

	/**
	 * Interim ("live preview") Y.Doc write channel: publishes in-flight inline
	 * editor text that has not reached the slides state yet, so peers see typing
	 * as it happens instead of on commit. Dormant outside a session.
	 */
	readonly livePatcher: CollaborationLivePatcher = createCollaborationLivePatcher();

	// One handle owns viewer wiring, but external transport resources stay borrowed.
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
	 * Reentrancy token for connect: every connect/disconnect invalidates pending
	 * async setup. A superseded setup releases only what it created and never
	 * tears down the newer session (a second provider join can otherwise throw).
	 */
	private connectToken = 0;

	private readonly refreshPresence = (): void => {
		this.presenceState.refresh(this.session, this.canvasWidth, this.canvasHeight);
	};

	constructor() {
		// Service destruction is not the only way a session ends: a tab close, a
		// navigation, or an embedding page detaching the viewer's iframe destroys
		// the document without running Angular teardown, leaving a ghost peer in
		// everyone else's presence list. Leave the room from `pagehide` too.
		const disposeTeardown = registerCollaborationTeardown({
			leaveOnBeforeUnload: () => !this.currentConfig?.externalSession,
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

		// Blank server URLs select webrtc consistently with Share/Broadcast
		// dialogs and the other bindings; external sessions never open it.
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);

		// Fail fast on mixed content (websocket only): an https page cannot open a
		// ws:// socket, so surface the error rather than hanging until the timeout.
		if (
			!config.externalSession &&
			transport !== 'webrtc' &&
			isMixedContentBlocked(config.serverUrl)
		) {
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
		this.readOnly.set(Boolean(config.externalSession) || config.role === 'viewer');

		this.status.set('connecting');
		try {
			const session = await connectSession(
				config,
				transport,
				{
					slideSync: this.slideSync,
					livePatcher: this.livePatcher,
					onRemoteSlides: this.onRemoteSlides,
					refreshPresence: this.refreshPresence,
					scheduleWriteBack: () => this.scheduleWriteBack(),
					cancelWriteBack: () => this.writeBack.cancel(),
					setReadOnly: (readOnly) => this.readOnly.set(readOnly),
					setStatus: (status) => this.status.set(status),
					getStatus: () => this.status(),
					isActive: () => this.active(),
					failConnection: () => {
						this.disconnect();
						this.status.set('error');
					},
				},
				() => token === this.connectToken,
			);
			if (!session || token !== this.connectToken) {
				session?.dispose();
				return;
			}
			this.session = session;
			this.active.set(true);
			this.refreshPresence();
			// Readiness can seed/adopt synchronously before this.session exists.
			// Now an owner's startup snapshot has its live document available.
			if (session.readiness) {
				this.scheduleWriteBack();
			}
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
			this.session.dispose();
			this.session = null;
		}
		this.livePatcher.configure(null, null);
		this.onRemoteSlides = null;
		this.currentConfig = null;

		this.status.set('disconnected');
		this.active.set(false);
		this.activeRole.set(undefined);
		this.readOnly.set(false);
		this.presenceState.reset();
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
		if (this.session?.readiness) {
			return this.session.readiness.handleLoad(origin);
		}
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

	/** Follow the given peer's active slide, or null to stop following. */
	followUser(clientId: number | null): void {
		this.followedClientId.set(clientId);
	}

	private scheduleWriteBack(): void {
		if (this.currentConfig?.externalSession && !this.slideSync.gate.isOpen()) {
			return;
		}
		this.writeBack.schedule(
			this.currentConfig,
			this.session?.ydoc ?? null,
			this.getSourceBytes,
			this.getTemplateElements,
			this.getSaveOptions,
		);
	}
}
