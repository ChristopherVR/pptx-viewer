/**
 * Real-time collaboration for the Svelte viewer (Yjs: y-websocket or serverless
 * y-webrtc), a runes port of the Vue binding's `useCollaboration` core. Provider
 * status and the remote-slide observer are extracted to `collaboration-status.ts`
 * / `collaboration-remote-sync.ts`, and presence to `collaboration-presence.svelte.ts`.
 * KNOWN LIMITATION: collaborative-undo semantics are undefined in shared - local
 * undo is kept as-is and may fight a concurrent remote edit (matching the others).
 */
import type {
	CollaborationConfig,
	CollabLoadOrigin,
	ConnectionStatus,
	RemoteCursor,
	SanitizedPresence,
} from 'pptx-viewer-shared';
import {
	DEFAULT_CURSOR_COLOR,
	isMixedContentBlocked,
	resolveTransportForServerUrl,
	validateRoomId,
} from 'pptx-viewer-shared';

import type { CollaborationDeps } from './collaboration-deps';
import { CollaborationDocument } from './collaboration-document.svelte';
import { registerCollaborationEffects } from './collaboration-effects.svelte';
import { CollaborationPresence } from './collaboration-presence.svelte';
import type { CollabProviderHandle } from './collaboration-provider';
import type { CollabSession, CollabSessionFactory } from './collaboration-session';
import { createDefaultSession, createExternalSession } from './collaboration-session';
import { wireProviderStatus } from './collaboration-status';

/**
 * The collaboration controller. Construct it once during component setup: it
 * registers the two effects (auto start/stop from the config, granular publish
 * of local edits) itself, so no further wiring is needed in the SFC.
 */
export class CollaborationController {
	/** Live connection status (reactive). */
	status = $state<ConnectionStatus>('disconnected');
	/** Interim Y.Doc channel for in-flight inline text (dormant when stopped). */
	get livePatcher() {
		return this.#document.livePatcher;
	}

	#active = $state(false);
	readonly #deps: CollaborationDeps;
	readonly #makeSession: CollabSessionFactory;

	#session: CollabSession | null = null;
	#provider: CollabProviderHandle | null = null;
	#config: CollaborationConfig | null = $state(null);
	#lastStarted: CollaborationConfig | null = null;
	#startedByEffect = false;
	#startToken = 0;
	#restoreExternalPresence: (() => void) | null = null;
	#connectTimer: ReturnType<typeof setTimeout> | null = null;
	readonly #document: CollaborationDocument;
	readonly #presence: CollaborationPresence;

	constructor(deps: CollaborationDeps) {
		this.#deps = deps;
		this.#document = new CollaborationDocument(deps, (status) => {
			this.status = status;
		});
		this.#makeSession = deps.createSession ?? createDefaultSession;
		this.#presence = new CollaborationPresence(() => ({
			width: this.#deps.getCanvasWidth?.(),
			height: this.#deps.getCanvasHeight?.(),
		}));

		registerCollaborationEffects({
			getConfig: () => this.#deps.getConfig(),
			getSlides: () => this.#deps.getSlides(),
			syncConfig: (config) => this.#syncConfig(config),
			isPublishable: () => this.#active && this.#document.gate.isOpen(),
			flushLocalSlides: (slides) => this.#document.flush(slides),
			leaveOnBeforeUnload: () => !this.#config?.externalSession,
			stop: () => this.stop(),
			rejoin: () => {
				if (this.#lastStarted) {
					void this.#run(this.#lastStarted);
				}
			},
		});
	}

	/** Whether a session is live (reactive). */
	get active(): boolean {
		return this.#active;
	}
	/** The requested viewer role forbids editing, including while attachment is pending. */
	get readOnly(): boolean {
		return this.#document.readOnly;
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
	/** The config the active session was started with (null when stopped); the
	 * Share dialog's active view reads the local user's name/colour from this. */
	get activeCollaboration(): CollaborationConfig | null {
		return this.#config;
	}
	/** Total connected participants (self + remote peers), reactive. */
	get connectedCount(): number {
		return this.remotePresences.length + (this.#active ? 1 : 0);
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

	/**
	 * Re-adopt the shared doc's slides after a local content load committed a
	 * parsed deck to viewer state (see `adoptDocSlidesAfterLoad`). The load
	 * pipeline calls this synchronously right after it applies, i.e. before the
	 * publish effect can flush the freshly loaded slides into the doc, so a
	 * late joiner's bootstrap deck never clobbers the room's synced content.
	 */
	adoptDocAfterLoad(origin: CollabLoadOrigin = 'user'): void {
		if (this.#active) {
			this.#document.adoptAfterLoad(origin);
		}
	}

	#syncConfig(config: CollaborationConfig | undefined): void {
		if (config && config !== this.#lastStarted) {
			this.#lastStarted = config;
			this.#startedByEffect = true;
			void this.#run(config);
		} else if (!config && this.#startedByEffect) {
			// Only auto-stop a session THIS effect started; a direct `start()`
			// call (e.g. from a dialog) always clears the flag below, so it
			// is immune to this branch on the effect's next run.
			this.#lastStarted = null;
			this.#startedByEffect = false;
			this.stop();
		}
	}

	#clearTimers(): void {
		if (this.#connectTimer !== null) {
			clearTimeout(this.#connectTimer);
			this.#connectTimer = null;
		}
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
		const token = ++this.#startToken;
		this.#config = config;
		this.#document.begin(config);
		try {
			validateRoomId(config.roomId);
		} catch {
			this.stop();
			this.status = 'error';
			return;
		}
		const transport = config.transport ?? resolveTransportForServerUrl(config.serverUrl);
		// Mixed-content only affects a ws:// socket from an https page.
		if (
			!config.externalSession &&
			transport === 'websocket' &&
			isMixedContentBlocked(config.serverUrl)
		) {
			this.stop();
			this.status = 'error';
			return;
		}
		this.status = 'connecting';
		try {
			if (config.externalSession) {
				await this.#runExternal(config, token);
				return;
			}
			const session = await this.#makeSession(transport, config);
			if (token !== this.#startToken) {
				session.destroy();
				return;
			}
			this.#session = session;
			this.#document.attach(session.ydoc, session.factories);
			this.#provider = session.provider;

			// Gate local writes on the provider's initial sync; the grace timer
			// covers a lone webrtc peer that never receives a sync event.
			this.#document.gate.reset();
			this.#provider.onSynced(() => this.#document.gate.open());
			if (this.#provider.syncedNow) {
				this.#document.gate.open();
			} else {
				this.#document.gate.arm();
			}

			this.#presence.start(this.#provider.awareness, {
				userName: config.userName,
				userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
				userAvatar: config.userAvatar,
				role: config.role,
			});

			this.#wireProvider(transport);

			this.#active = true;
			this.#deps.onStart?.(config);
		} catch {
			if (token !== this.#startToken) {
				return;
			}
			this.stop();
			this.status = 'error';
		}
	}

	async #runExternal(config: CollaborationConfig, token: number): Promise<void> {
		const external = config.externalSession!;
		const session = await createExternalSession(external);
		if (token !== this.#startToken) {
			session.dispose();
			return;
		}
		this.#restoreExternalPresence = session.dispose;
		this.#presence.start(session.awareness, {
			userName: config.userName,
			userColor: config.userColor ?? DEFAULT_CURSOR_COLOR,
			userAvatar: config.userAvatar,
			role: config.role,
		});
		this.#active = true;
		this.#document.attach(session.ydoc, session.factories);
		this.#deps.onStart?.(config);
	}

	/** Attach the status machine and the remote-slide observer to the session. */
	#wireProvider(transport: string): void {
		if (!this.#provider) {
			return;
		}
		wireProviderStatus(this.#provider, transport, {
			setStatus: (status) => (this.status = status),
			getStatus: () => this.status,
			isActive: () => this.#active,
			stop: () => this.stop(),
			gate: this.#document.gate,
			setConnectTimer: (timer) => (this.#connectTimer = timer),
			getConnectTimer: () => this.#connectTimer,
		});
	}

	stop(): void {
		this.#startToken++;
		this.#document.stop();
		this.#clearTimers();
		this.#presence.stop();
		this.#restoreExternalPresence?.();
		this.#restoreExternalPresence = null;
		this.#session?.destroy();
		this.#session = null;
		this.#provider = null;
		this.#config = null;
		if (this.#active) {
			this.#deps.onStop?.();
		}
		this.#active = false;
		this.status = 'disconnected';
	}
}
