/**
 * Real-time collaboration for the Svelte viewer (Yjs: y-websocket or serverless
 * y-webrtc), a runes port of the Vue binding's `useCollaboration` core. Provider
 * status and the remote-slide observer are extracted to `collaboration-status.ts`
 * / `collaboration-remote-sync.ts`, and presence to `collaboration-presence.svelte.ts`.
 * KNOWN LIMITATION: collaborative-undo semantics are undefined in shared - local
 * undo is kept as-is and may fight a concurrent remote edit (matching the others).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type {
	CollaborationConfig,
	ConnectionStatus,
	RemoteCursor,
	SanitizedPresence,
	YDocLike,
	YjsFactories,
} from 'pptx-viewer-shared';
import {
	createSyncGate,
	createWriteBackScheduler,
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	reconcileSlidesInYDoc,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';

import { CollaborationPresence } from './collaboration-presence.svelte';
import type { CollabProviderHandle } from './collaboration-provider';
import { observeRemoteSlides } from './collaboration-remote-sync';
import type { CollabSession, CollabSessionFactory } from './collaboration-session';
import { createDefaultSession } from './collaboration-session';
import { wireProviderStatus } from './collaboration-status';

export interface CollaborationDeps {
	/** Read the current local slides (broadcast granularly on change). */
	getSlides: () => PptxSlide[];
	/** Apply a remote peer's slide snapshot into the editable slides. */
	applyRemoteSlides: (slides: PptxSlide[]) => void;
	/** Live host `collaboration` config; watched to auto start/stop a session. */
	getConfig: () => CollaborationConfig | undefined;
	/** Return the loaded source bytes for elected-writer (role 'owner') write-back. */
	getSourceBytes?: () => Uint8Array | null;
	/** Slide canvas width/height (unscaled px), used to clamp incoming cursor coordinates. */
	getCanvasWidth?: () => number | undefined;
	getCanvasHeight?: () => number | undefined;
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
	#startedByEffect = false;

	#applyingRemote = false;
	#lastSynced = '';
	#unobserve: (() => void) | null = null;
	#connectTimer: ReturnType<typeof setTimeout> | null = null;

	readonly #gate = createSyncGate(() => this.#flushLocalSlides());
	readonly #writeBack = createWriteBackScheduler({
		getYDoc: () => this.#ydoc,
		getSourceBytes: () => this.#deps.getSourceBytes?.() ?? null,
	});
	readonly #presence: CollaborationPresence;

	constructor(deps: CollaborationDeps) {
		this.#deps = deps;
		this.#makeSession = deps.createSession ?? createDefaultSession;
		this.#presence = new CollaborationPresence(() => ({
			width: this.#deps.getCanvasWidth?.(),
			height: this.#deps.getCanvasHeight?.(),
		}));

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
	/** Read-only participant (session live with the `viewer` role) - cannot select/drag/mutate. */
	get readOnly(): boolean {
		return this.#active && this.#config?.role === 'viewer';
	}
	/** Remote cursors on the current slide (reactive). */
	get cursors(): RemoteCursor[] {
		return this.#presence.cursors;
	}
	/** Remote collaborators in the session (reactive). */
	get remotePresences(): SanitizedPresence[] {
		return this.#presence.remotePresences;
	}
	/** Followed peer's client id, or null when free (reactive). */
	get followedClientId(): number | null {
		return this.#presence.followedClientId;
	}

	/** Publish a cursor move (slide-space px); no-op when no session is active. */
	setCursor(x: number, y: number, activeSlideIndex?: number): void {
		this.#presence.setCursor(x, y, activeSlideIndex);
	}
	/** Publish the local selection; no-op when no session is active. */
	setSelection(selectedElementId: string | undefined, activeSlideIndex?: number): void {
		this.#presence.setSelection(selectedElementId, activeSlideIndex);
	}
	/** Publish the local active-slide index (drives peer follow-along). */
	setActiveSlide(index: number): void {
		this.#presence.setActiveSlide(index);
	}
	/** Follow the given peer's active slide, or `null` to stop following. */
	followUser(clientId: number | null): void {
		this.#presence.followUser(clientId);
	}

	#syncConfig(config: CollaborationConfig | undefined): void {
		if (config && config !== this.#lastStarted) {
			this.#lastStarted = config;
			this.#startedByEffect = true;
			void this.#run(config);
		} else if (!config && this.#active && this.#startedByEffect) {
			// Only auto-stop a session THIS effect started; a direct `start()`
			// call (e.g. from a dialog) always clears the flag below, so it
			// is immune to this branch on the effect's next run.
			this.#lastStarted = null;
			this.#startedByEffect = false;
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
	/** Start (or restart) a session with the given config (dialog-driven). */
	async start(config: CollaborationConfig): Promise<void> {
		// Set synchronously, before any `await` below, so a same-tick effect
		// flush (see `#syncConfig`) sees this config as already current and
		// does not redundantly start a second, concurrent session.
		this.#lastStarted = config;
		this.#startedByEffect = false;
		await this.#run(config);
	}

	async #run(config: CollaborationConfig): Promise<void> {
		this.stop();
		this.#config = config;
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

			this.#presence.start(this.#provider.awareness, {
				userName: config.userName,
				userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
				userAvatar: config.userAvatar,
				role: config.role,
			});

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
		wireProviderStatus(this.#provider, transport, {
			setStatus: (status) => (this.status = status),
			getStatus: () => this.status,
			isActive: () => this.#active,
			stop: () => this.stop(),
			gate: this.#gate,
			setConnectTimer: (timer) => (this.#connectTimer = timer),
			getConnectTimer: () => this.#connectTimer,
		});
	}

	#observeRemote(config: CollaborationConfig): void {
		if (!this.#ydoc) {
			return;
		}
		this.#unobserve = observeRemoteSlides(this.#ydoc, config, {
			isApplyingRemote: () => this.#applyingRemote,
			setApplyingRemote: (value) => (this.#applyingRemote = value),
			setLastSynced: (value) => (this.#lastSynced = value),
			applyRemoteSlides: (slides) => this.#deps.applyRemoteSlides(slides),
			scheduleWriteBack: (cfg) => this.#writeBack.schedule(cfg),
		});
	}

	stop(): void {
		this.#clearTimers();
		this.#gate.reset();
		this.#presence.stop();
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
