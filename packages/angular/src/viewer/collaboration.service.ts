/**
 * collaboration.service.ts — Angular port of the Vue `useCollaboration`
 * composable and the React `usePresenceTracking` / `useYjsProvider` hooks.
 *
 * Minimal real-time collaboration over Yjs + y-websocket:
 *  - the slide model is broadcast as a whole-document JSON value in a shared
 *    `Y.Map` (last-write-wins, not per-field CRDT);
 *  - remote collaborators' cursors/selection/presence are surfaced via the
 *    y-websocket **awareness** channel.
 *
 * `yjs`/`y-websocket` are imported lazily so they stay out of the main chunk
 * and are only loaded when a session actually starts. All connection failures
 * degrade silently (the viewer remains a normal single-user viewer).
 *
 * Reactive surface is exposed as Angular signals. The Yjs doc + awareness +
 * provider lifecycle is torn down both on `disconnect()` and automatically via
 * `DestroyRef.onDestroy` (mirroring how `LoadContentService` cleans up).
 *
 * Provide it at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [CollaborationService] })`.
 */

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type { CollaborationConfig } from '../internal/shared';
import {
	DEFAULT_CURSOR_COLOR,
	derivePresenceList,
	presenceToCursors,
	validateRoomId,
} from './collaboration-helpers';
import type { RemoteCursor, RemotePresence } from './collaboration-helpers';

// ---------------------------------------------------------------------------
// Loose structural types for the lazily-imported yjs / y-websocket surface.
// (Kept minimal so we never take a static dependency on those modules.)
// ---------------------------------------------------------------------------

interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

interface YMapLike {
	set: (key: string, value: unknown) => void;
	get: (key: string) => unknown;
	observe: (cb: () => void) => void;
}

interface YDocLike {
	getMap: (name: string) => YMapLike;
	destroy: () => void;
}

interface ProviderLike {
	awareness: AwarenessLike;
	disconnect: () => void;
	destroy: () => void;
	on: (event: string, cb: (payload: { status?: string }) => void) => void;
}

/** Minimal shape of the lazily-imported `y-websocket` module. */
interface WebsocketProviderModule {
	WebsocketProvider: new (
		serverUrl: string,
		roomId: string,
		doc: unknown,
		opts?: { params?: Record<string, string> },
	) => unknown;
}

/** Options the host viewer supplies when wiring collaboration. */
export interface ConnectOptions {
	/** Called when a remote peer broadcasts a newer slide set. */
	onRemoteSlides?: (slides: PptxSlide[]) => void;
	/**
	 * Canvas dimensions (unscaled slide px) used to clamp incoming cursor
	 * coordinates. Defaults to a generous bound when omitted.
	 */
	canvasWidth?: number;
	canvasHeight?: number;
}

const DEFAULT_CANVAS_BOUND = 100_000;

@Injectable()
export class CollaborationService {
	// ── Reactive state ────────────────────────────────────────────────
	/** True once the websocket provider reports a `connected` status. */
	readonly connected = signal(false);
	/** True while a session is active (provider constructed, not yet stopped). */
	readonly active = signal(false);
	/** Sanitised remote presence list (excludes the local user, stale dropped). */
	readonly presence = signal<RemotePresence[]>([]);

	/** Remote collaborators' live cursors, derived from presence. */
	readonly cursors = computed<RemoteCursor[]>(() => presenceToCursors(this.presence()));

	/** Total connected participants (remote + self when active). */
	readonly connectedCount = computed<number>(
		() => this.presence().length + (this.active() ? 1 : 0),
	);

	// ── Internal handles ──────────────────────────────────────────────
	private ydoc: YDocLike | null = null;
	private provider: ProviderLike | null = null;
	private ymap: YMapLike | null = null;
	private awareness: AwarenessLike | null = null;
	private selfId = -1;
	private applyingRemote = false;

	private onRemoteSlides: ((slides: PptxSlide[]) => void) | null = null;
	private canvasWidth = DEFAULT_CANVAS_BOUND;
	private canvasHeight = DEFAULT_CANVAS_BOUND;
	private userName = 'Anonymous';
	private userColor = DEFAULT_CURSOR_COLOR;
	private userAvatar: string | undefined;
	private role: string | undefined;

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

	/**
	 * Connect to a room and begin syncing. Any existing session is torn down
	 * first. Returns when the session has been established (or silently when
	 * yjs/y-websocket are unavailable / the connection fails).
	 */
	async connect(config: CollaborationConfig, options: ConnectOptions = {}): Promise<void> {
		this.disconnect();

		// Reject malformed room ids before touching the network.
		try {
			validateRoomId(config.roomId);
		} catch {
			return;
		}

		this.onRemoteSlides = options.onRemoteSlides ?? null;
		this.canvasWidth = options.canvasWidth ?? DEFAULT_CANVAS_BOUND;
		this.canvasHeight = options.canvasHeight ?? DEFAULT_CANVAS_BOUND;
		this.userName = config.userName;
		this.userColor = config.userColor ?? DEFAULT_CURSOR_COLOR;
		this.userAvatar = config.userAvatar;
		this.role = config.role;

		try {
			// `y-websocket` is loaded through an indirected specifier so it stays
			// out of the static import graph (it is an optional peer — the package
			// degrades gracefully when it is not installed, and the bundler / lib
			// target never hard-links it).
			const wsModule = 'y-websocket';
			const [Y, yws] = await Promise.all([
				import('yjs'),
				import(/* @vite-ignore */ wsModule) as Promise<WebsocketProviderModule>,
			]);
			const doc = new Y.Doc() as unknown as YDocLike;
			this.ydoc = doc;
			const map = doc.getMap('presentation');
			this.ymap = map;

			const wsProvider = new yws.WebsocketProvider(
				config.serverUrl,
				config.roomId,
				doc,
				config.authToken ? { params: { token: config.authToken } } : undefined,
			) as unknown as ProviderLike;
			this.provider = wsProvider;
			this.awareness = wsProvider.awareness;
			this.selfId = this.awareness.clientID ?? -1;

			// Announce our presence so peers can render us immediately.
			this.awareness.setLocalStateField('presence', {
				userName: this.userName,
				userColor: this.userColor,
				userAvatar: this.userAvatar,
				role: this.role,
				activeSlideIndex: 0,
				cursorX: 0,
				cursorY: 0,
				lastUpdated: new Date().toISOString(),
			});
			// Also publish the foundational `user` field used by the lightweight path.
			this.awareness.setLocalStateField('user', {
				name: this.userName,
				color: this.userColor,
			});

			this.awareness.on('change', this.refreshPresence);
			this.awareness.on('update', this.refreshPresence);

			wsProvider.on('status', (payload: { status?: string }) => {
				this.connected.set(payload.status === 'connected');
			});

			map.observe(() => {
				const raw = map.get('slides');
				if (typeof raw === 'string' && this.onRemoteSlides) {
					try {
						this.applyingRemote = true;
						this.onRemoteSlides(JSON.parse(raw) as PptxSlide[]);
					} catch {
						// Malformed payload — ignore.
					} finally {
						this.applyingRemote = false;
					}
				}
			});

			this.active.set(true);
			this.refreshPresence();
		} catch {
			// yjs/y-websocket unavailable or connection failed — degrade silently.
			this.disconnect();
		}
	}

	/** Disconnect and tear down the session, resetting all reactive state. */
	disconnect(): void {
		this.awareness?.off?.('change', this.refreshPresence);
		this.awareness?.off?.('update', this.refreshPresence);
		this.provider?.disconnect();
		this.provider?.destroy();
		this.ydoc?.destroy();

		this.provider = null;
		this.ydoc = null;
		this.ymap = null;
		this.awareness = null;
		this.selfId = -1;
		this.applyingRemote = false;
		this.onRemoteSlides = null;

		this.connected.set(false);
		this.active.set(false);
		this.presence.set([]);
	}

	/**
	 * Broadcast the local slide set to peers (no-op while applying a remote
	 * update, to avoid an echo loop). Call this whenever the editor's slides
	 * change.
	 */
	broadcastSlides(slides: readonly PptxSlide[]): void {
		if (this.ymap && !this.applyingRemote) {
			this.ymap.set('slides', JSON.stringify(slides));
		}
	}

	/**
	 * Publish this user's cursor position (unscaled slide px) plus the slide
	 * they're viewing. Updates both the foundational `cursor` field and the full
	 * `presence` record so either consumer path sees it.
	 */
	setCursor(x: number, y: number, activeSlideIndex = 0): void {
		if (!this.awareness) {
			return;
		}
		this.awareness.setLocalStateField('cursor', { x, y });
		this.awareness.setLocalStateField('presence', {
			userName: this.userName,
			userColor: this.userColor,
			userAvatar: this.userAvatar,
			role: this.role,
			activeSlideIndex,
			cursorX: x,
			cursorY: y,
			lastUpdated: new Date().toISOString(),
		});
	}

	/** Broadcast the local user's currently selected element ids. */
	setSelection(selectedElementId: string | undefined, activeSlideIndex = 0): void {
		if (!this.awareness) {
			return;
		}
		this.awareness.setLocalStateField('presence', {
			userName: this.userName,
			userColor: this.userColor,
			userAvatar: this.userAvatar,
			role: this.role,
			activeSlideIndex,
			selectedElementId,
			lastUpdated: new Date().toISOString(),
		});
	}
}
