/**
 * CollaborationService: Angular port of the Vue `useCollaboration` composable.
 *
 * Changes from the original:
 *  - Slide sync uses the granular `pptx:slides` Y.Array (structural CRDT) via
 *    the shared `writeSlidesToYDoc` / `readSlidesFromYDoc` / `observeYDocSlides`
 *    helpers, replacing the monolithic JSON blob in 'presentation'.
 *  - Elected-writer write-back: when role === 'owner', changes are debounced
 *    and `config.onWriteBack` receives serialized PPTX bytes for persistence.
 *
 * Provide at the component level: `@Component({ providers: [CollaborationService] })`.
 */

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';

import type {
	CollaborationConfig,
	YjsFactories,
	YDocLike as SharedYDocLike,
} from '../internal/shared';
import { writeSlidesToYDoc, readSlidesFromYDoc, observeYDocSlides } from '../internal/shared';
import {
	DEFAULT_CURSOR_COLOR,
	derivePresenceList,
	presenceToCursors,
	validateRoomId,
} from './collaboration-helpers';
import type { RemoteCursor, RemotePresence } from './collaboration-helpers';

// ---------------------------------------------------------------------------
// Loose structural types for lazily-imported yjs / y-websocket.
// ---------------------------------------------------------------------------

interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

interface YDocLike extends SharedYDocLike {
	destroy: () => void;
}

interface ProviderLike {
	awareness: AwarenessLike;
	disconnect: () => void;
	destroy: () => void;
	on: (event: string, cb: (payload: { status?: string }) => void) => void;
}

interface WebsocketProviderModule {
	WebsocketProvider: new (
		serverUrl: string,
		roomId: string,
		doc: unknown,
		opts?: { params?: Record<string, string> },
	) => unknown;
}

export interface ConnectOptions {
	onRemoteSlides?: (slides: PptxSlide[]) => void;
	canvasWidth?: number;
	canvasHeight?: number;
	getSourceBytes?: () => Uint8Array | null;
}

const DEFAULT_CANVAS_BOUND = 100_000;
const WRITE_BACK_DEBOUNCE_MS = 5_000;

@Injectable()
export class CollaborationService {
	// Reactive state
	readonly connected = signal(false);
	readonly active = signal(false);
	readonly presence = signal<RemotePresence[]>([]);
	readonly cursors = computed<RemoteCursor[]>(() => presenceToCursors(this.presence()));
	readonly connectedCount = computed<number>(
		() => this.presence().length + (this.active() ? 1 : 0),
	);

	// Internal handles
	private ydoc: YDocLike | null = null;
	private provider: ProviderLike | null = null;
	private awareness: AwarenessLike | null = null;
	private selfId = -1;
	private applyingRemote = false;
	private yFactories: YjsFactories | null = null;
	private lastSynced = '';
	private writeBackTimer: ReturnType<typeof setTimeout> | null = null;
	private unobserveSlides: (() => void) | null = null;

	private onRemoteSlides: ((slides: PptxSlide[]) => void) | null = null;
	private canvasWidth = DEFAULT_CANVAS_BOUND;
	private canvasHeight = DEFAULT_CANVAS_BOUND;
	private getSourceBytes: (() => Uint8Array | null) | null = null;
	private userName = 'Anonymous';
	private userColor = DEFAULT_CURSOR_COLOR;
	private userAvatar: string | undefined;
	private role: string | undefined;
	private currentConfig: CollaborationConfig | null = null;

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
		try {
			validateRoomId(config.roomId);
		} catch {
			return;
		}

		this.onRemoteSlides = options.onRemoteSlides ?? null;
		this.canvasWidth = options.canvasWidth ?? DEFAULT_CANVAS_BOUND;
		this.canvasHeight = options.canvasHeight ?? DEFAULT_CANVAS_BOUND;
		this.getSourceBytes = options.getSourceBytes ?? null;
		this.userName = config.userName;
		this.userColor = config.userColor ?? DEFAULT_CURSOR_COLOR;
		this.userAvatar = config.userAvatar;
		this.role = config.role;
		this.currentConfig = config;

		try {
			const wsModule = 'y-websocket';
			const [Y, yws] = await Promise.all([
				import('yjs'),
				import(/* @vite-ignore */ wsModule) as Promise<WebsocketProviderModule>,
			]);
			const doc = new Y.Doc() as unknown as YDocLike;
			this.ydoc = doc;
			this.yFactories = {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			};

			const wsProvider = new yws.WebsocketProvider(
				config.serverUrl,
				config.roomId,
				doc,
				config.authToken ? { params: { token: config.authToken } } : undefined,
			) as unknown as ProviderLike;
			this.provider = wsProvider;
			this.awareness = wsProvider.awareness;
			this.selfId = this.awareness.clientID ?? -1;

			this._publishAwareness();
			this.awareness.on('change', this.refreshPresence);
			this.awareness.on('update', this.refreshPresence);

			wsProvider.on('status', (payload: { status?: string }) => {
				this.connected.set(payload.status === 'connected');
			});

			// Observe remote slide changes
			this.unobserveSlides = observeYDocSlides(doc, () => {
				if (this.applyingRemote || !this.ydoc) {
					return;
				}
				const remote = readSlidesFromYDoc(this.ydoc);
				if (remote.length === 0) {
					return;
				}
				this.applyingRemote = true;
				this.onRemoteSlides?.(remote);
				this.applyingRemote = false;
				this._scheduleWriteBack();
			});

			this.active.set(true);
			this.refreshPresence();
		} catch {
			this.disconnect();
		}
	}

	disconnect(): void {
		if (this.writeBackTimer !== null) {
			clearTimeout(this.writeBackTimer);
			this.writeBackTimer = null;
		}
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
		this.selfId = -1;
		this.applyingRemote = false;
		this.yFactories = null;
		this.lastSynced = '';
		this.onRemoteSlides = null;
		this.currentConfig = null;

		this.connected.set(false);
		this.active.set(false);
		this.presence.set([]);
	}

	/** Broadcast the local slide set to peers via the pptx:slides Y.Array. */
	broadcastSlides(slides: readonly PptxSlide[]): void {
		if (!this.ydoc || !this.yFactories || this.applyingRemote) {
			return;
		}
		const s = JSON.stringify(slides);
		if (s === this.lastSynced) {
			return;
		}
		this.lastSynced = s;
		writeSlidesToYDoc([...slides], this.ydoc, this.yFactories);
		this._scheduleWriteBack();
	}

	setCursor(x: number, y: number, activeSlideIndex = 0): void {
		if (!this.awareness) {
			return;
		}
		this.awareness.setLocalStateField('cursor', { x, y });
		this._publishAwareness(activeSlideIndex, x, y);
	}

	setSelection(selectedElementId: string | undefined, activeSlideIndex = 0): void {
		if (!this.awareness) {
			return;
		}
		this._publishAwareness(activeSlideIndex, undefined, undefined, selectedElementId);
	}

	private _publishAwareness(
		activeSlideIndex = 0,
		cursorX = 0,
		cursorY = 0,
		selectedElementId?: string,
	): void {
		this.awareness?.setLocalStateField('presence', {
			userName: this.userName,
			userColor: this.userColor,
			userAvatar: this.userAvatar,
			role: this.role,
			activeSlideIndex,
			cursorX,
			cursorY,
			selectedElementId,
			lastUpdated: new Date().toISOString(),
		});
		this.awareness?.setLocalStateField('user', { name: this.userName, color: this.userColor });
	}

	private _scheduleWriteBack(): void {
		const config = this.currentConfig;
		if (!config?.onWriteBack || config.role !== 'owner' || !this.ydoc) {
			return;
		}
		if (this.writeBackTimer !== null) {
			clearTimeout(this.writeBackTimer);
		}
		const ms = config.writeBackDebounceMs ?? WRITE_BACK_DEBOUNCE_MS;
		this.writeBackTimer = setTimeout(async () => {
			this.writeBackTimer = null;
			if (!this.ydoc || !config.onWriteBack) {
				return;
			}
			const sourceBytes = this.getSourceBytes?.();
			if (!sourceBytes) {
				return;
			}
			try {
				const { PptxHandler } = await import('pptx-viewer-core');
				const handler = new PptxHandler();
				await handler.load(sourceBytes.buffer as ArrayBuffer);
				const slides = readSlidesFromYDoc(this.ydoc);
				const bytes = await handler.save(slides);
				config.onWriteBack(bytes);
			} catch {
				/* non-fatal */
			}
		}, ms);
	}
}
