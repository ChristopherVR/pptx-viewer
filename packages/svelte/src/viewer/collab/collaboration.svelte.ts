/**
 * Real-time collaboration for the Svelte viewer (Yjs: y-websocket or serverless
 * y-webrtc), a runes port of the Vue binding's `useCollaboration` core.
 *
 * Slide sync is granular via the shared `reconcileSlidesInYDoc` (tagged
 * `LOCAL_SYNC_ORIGIN`; the observer skips its own writes), so concurrent edits
 * merge per slide/element/field rather than colliding at document granularity.
 * Remote updates are read back with `readSlidesFromYDoc` and handed to
 * `applyRemoteSlides`, which replaces the working slides without an undo step.
 *
 * SCOPE / CAVEATS (intentional, documented for hosts):
 *  - Remote presence (cursors/selections/follow-mode) and the one-way broadcast
 *    role are DESCOPED in this binding; only two-way slide sync + owner
 *    write-back are wired. Presence is a modest follow-up (shared awareness
 *    helpers exist) but is not required for editing collaboration.
 *  - The shared codec allowlists drop media/OLE/3D/ink binary fields, and a
 *    full-array remote apply can degrade a host's media elements. These limits
 *    live in `pptx-viewer-shared` and are out of scope here.
 *  - Collaborative-undo semantics are undefined in shared: local undo is kept
 *    as-is and may fight a concurrent remote edit (matching React/Vue).
 */
import type { PptxSlide } from 'pptx-viewer-core';
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

import type { CollabProviderHandle } from './collaboration-provider';
import type { CollabSession, CollabSessionFactory } from './collaboration-session';
import { createDefaultSession } from './collaboration-session';
import { createWriteBackScheduler } from './collaboration-writeback';

export interface CollaborationDeps {
	/** Read the current local slides (broadcast granularly on change). */
	getSlides: () => PptxSlide[];
	/** Apply a remote peer's slide snapshot into the editable slides. */
	applyRemoteSlides: (slides: PptxSlide[]) => void;
	/** Live host `collaboration` config; watched to auto start/stop a session. */
	getConfig: () => CollaborationConfig | undefined;
	/** Return the loaded source bytes for elected-writer (role 'owner') write-back. */
	getSourceBytes?: () => Uint8Array | null;
	/** Fired when a session starts (host observability). */
	onStart?: (config: CollaborationConfig) => void;
	/** Fired when a session stops (host observability). */
	onStop?: () => void;
	/** Session factory seam (defaults to the real yjs + transport wiring). */
	createSession?: CollabSessionFactory;
}

/**
 * The collaboration controller. Construct it once during component setup: it
 * registers the two effects (auto start/stop from the config, granular publish
 * of local edits) itself, so no further wiring is needed in the SFC.
 */
export class CollaborationController {
	/** Live connection status (reactive). */
	status = $state<ConnectionStatus>('disconnected');

	#active = $state(false);
	readonly #deps: CollaborationDeps;
	readonly #makeSession: CollabSessionFactory;

	#session: CollabSession | null = null;
	#ydoc: YDocLike | null = null;
	#factories: YjsFactories | null = null;
	#provider: CollabProviderHandle | null = null;
	#config: CollaborationConfig | null = null;
	#lastStarted: CollaborationConfig | null = null;

	#applyingRemote = false;
	#lastSynced = '';
	#unobserve: (() => void) | null = null;
	#connectTimer: ReturnType<typeof setTimeout> | null = null;

	readonly #gate = createSyncGate(() => this.#flushLocalSlides());
	readonly #writeBack = createWriteBackScheduler({
		getYDoc: () => this.#ydoc,
		getSourceBytes: () => this.#deps.getSourceBytes?.() ?? null,
	});

	constructor(deps: CollaborationDeps) {
		this.#deps = deps;
		this.#makeSession = deps.createSession ?? createDefaultSession;

		// Auto start/stop when the host supplies (or clears) a config. Compared by
		// reference so re-emitting the same object does not restart the session.
		$effect(() => {
			const config = this.#deps.getConfig();
			this.#syncConfig(config);
		});

		// Broadcast local slide edits granularly. Reading `#active` re-runs the
		// effect on (de)activation; the gate + role checks live in the flush.
		$effect(() => {
			const slides = this.#deps.getSlides();
			if (this.#active && this.#gate.isOpen()) {
				this.#flushLocalSlides(slides);
			}
		});
	}

	/** Whether a session is live (reactive). */
	get active(): boolean {
		return this.#active;
	}

	/**
	 * Whether the local user is a read-only participant (session live with the
	 * `viewer` role). The viewer folds this into its effective editability so a
	 * viewer cannot select, drag, or mutate elements.
	 */
	get readOnly(): boolean {
		return this.#active && this.#config?.role === 'viewer';
	}

	#syncConfig(config: CollaborationConfig | undefined): void {
		if (config && config !== this.#lastStarted) {
			this.#lastStarted = config;
			void this.start(config);
		} else if (!config && this.#active) {
			this.#lastStarted = null;
			this.stop();
		}
	}

	/** Write the current local slides into the doc (granular, echo-deduped). */
	#flushLocalSlides(slides: PptxSlide[] = this.#deps.getSlides()): void {
		if (!this.#ydoc || !this.#factories || this.#applyingRemote) {
			return;
		}
		// A read-only viewer never writes; owners/collaborators publish edits.
		if (this.#config?.role === 'viewer') {
			return;
		}
		const serialized = JSON.stringify(slides);
		if (serialized === this.#lastSynced) {
			return;
		}
		this.#lastSynced = serialized;
		reconcileSlidesInYDoc(slides, this.#ydoc, this.#factories);
		if (this.#config) {
			this.#writeBack.schedule(this.#config);
		}
	}

	#clearTimers(): void {
		if (this.#connectTimer !== null) {
			clearTimeout(this.#connectTimer);
			this.#connectTimer = null;
		}
		this.#writeBack.cancel();
	}

	async start(config: CollaborationConfig): Promise<void> {
		this.stop();
		this.#config = config;
		this.#lastStarted = config;
		try {
			validateRoomId(config.roomId);
		} catch {
			this.status = 'error';
			return;
		}
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		// Mixed-content only affects a ws:// socket from an https page.
		if (transport === 'websocket' && isMixedContentBlocked(config.serverUrl)) {
			this.status = 'error';
			return;
		}
		this.status = 'connecting';
		try {
			const session = await this.#makeSession(transport, config);
			this.#session = session;
			this.#ydoc = session.ydoc;
			this.#factories = session.factories;
			this.#provider = session.provider;

			// Gate local writes on the provider's initial sync; the grace timer
			// covers a lone webrtc peer that never receives a sync event.
			this.#gate.reset();
			this.#provider.onSynced(() => this.#gate.open());
			if (this.#provider.syncedNow) {
				this.#gate.open();
			} else {
				this.#gate.arm();
			}

			this.#wireStatus(transport);
			this.#observeRemote(config);

			this.#active = true;
			this.#deps.onStart?.(config);
		} catch {
			this.stop();
			this.status = 'error';
		}
	}

	#wireStatus(transport: string): void {
		if (!this.#provider) {
			return;
		}
		if (transport === 'webrtc') {
			// Same-browser tabs meet over BroadcastChannel at once (no server wait).
			this.status = 'connected';
			return;
		}
		this.#provider.onStatus((isConnected) => {
			if (isConnected) {
				if (this.#connectTimer !== null) {
					clearTimeout(this.#connectTimer);
					this.#connectTimer = null;
				}
				this.status = 'connected';
			} else if (this.#active) {
				this.status = 'disconnected';
			}
		});
		if (this.#provider.connectedNow) {
			this.status = 'connected';
		} else {
			this.#connectTimer = setTimeout(() => {
				this.#connectTimer = null;
				if (this.status !== 'connected') {
					this.stop();
					this.status = 'error';
				}
			}, CONNECTION_TIMEOUT_MS);
		}
	}

	#observeRemote(config: CollaborationConfig): void {
		if (!this.#ydoc) {
			return;
		}
		this.#unobserve = observeYDocSlides(this.#ydoc, (_events, transaction) => {
			if (transaction?.origin === LOCAL_SYNC_ORIGIN || this.#applyingRemote || !this.#ydoc) {
				return;
			}
			const remote = readSlidesFromYDoc(this.#ydoc);
			if (remote.length === 0) {
				return;
			}
			this.#applyingRemote = true;
			this.#deps.applyRemoteSlides(remote);
			this.#applyingRemote = false;
			// Dedupe the echo: the publish effect this apply schedules is a no-op.
			this.#lastSynced = JSON.stringify(remote);
			this.#writeBack.schedule(config);
		});
	}

	stop(): void {
		this.#clearTimers();
		this.#gate.reset();
		this.#unobserve?.();
		this.#unobserve = null;
		this.#session?.destroy();
		this.#session = null;
		this.#provider = null;
		this.#ydoc = null;
		this.#factories = null;
		this.#applyingRemote = false;
		this.#lastSynced = '';
		if (this.#active) {
			this.#deps.onStop?.();
		}
		this.#active = false;
		this.status = 'disconnected';
	}
}
