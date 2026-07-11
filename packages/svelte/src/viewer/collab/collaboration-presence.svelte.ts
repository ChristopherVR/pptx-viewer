/**
 * collaboration-presence.svelte.ts: local presence publishing + remote
 * presence projection for the Svelte viewer's collaboration session, a runes
 * port of the vanilla binding's `collaboration-presence.ts`.
 *
 * Publishes the local user's cursor/selection/active-slide via the shared
 * `createPresencePublisher` (the same nested `presence` awareness field
 * every binding reads), and projects inbound awareness state into reactive
 * `$state` fields via the shared `derivePresenceList`/`presenceToCursors`.
 */
import type {
	AwarenessLike,
	PresenceIdentity,
	PresencePublisher,
	RemoteCursor,
	SanitizedPresence,
} from 'pptx-viewer-shared';
import {
	createPresencePublisher,
	derivePresenceList,
	presenceToCursors,
	PRESENCE_HEARTBEAT_MS,
} from 'pptx-viewer-shared';

const DEFAULT_CANVAS_BOUND = 100_000;

function readBound(size: number | undefined): number {
	return size !== undefined && size > 0 ? size : DEFAULT_CANVAS_BOUND;
}

export class CollaborationPresence {
	cursors = $state<RemoteCursor[]>([]);
	remotePresences = $state<SanitizedPresence[]>([]);
	followedClientId = $state<number | null>(null);

	readonly #getCanvasSize: () => { width?: number; height?: number };
	#publisher: PresencePublisher | null = null;
	#awareness: AwarenessLike | null = null;
	#selfId = -1;
	#localActiveSlide = 0;
	#heartbeat: ReturnType<typeof setInterval> | null = null;

	constructor(getCanvasSize: () => { width?: number; height?: number }) {
		this.#getCanvasSize = getCanvasSize;
	}

	/** Begin publishing/projecting presence for a live session. Call `stop()` first if already active. */
	start(awareness: AwarenessLike, identity: PresenceIdentity): void {
		this.stop();
		this.#awareness = awareness;
		this.#selfId = awareness.clientID ?? -1;
		this.#publisher = createPresencePublisher(awareness, identity);
		awareness.on('change', this.#refresh);
		awareness.on('update', this.#refresh);
		this.#heartbeat = setInterval(() => this.#publisher?.flush(), PRESENCE_HEARTBEAT_MS);
		this.#refresh();
	}

	/** Stop publishing and clear all reactive presence state. */
	stop(): void {
		if (this.#heartbeat !== null) {
			clearInterval(this.#heartbeat);
			this.#heartbeat = null;
		}
		this.#awareness?.off?.('change', this.#refresh);
		this.#awareness?.off?.('update', this.#refresh);
		this.#publisher?.dispose();
		this.#publisher = null;
		this.#awareness = null;
		this.#selfId = -1;
		this.#localActiveSlide = 0;
		this.cursors = [];
		this.remotePresences = [];
		this.followedClientId = null;
	}

	setCursor(x: number, y: number, activeSlideIndex: number = this.#localActiveSlide): void {
		this.#localActiveSlide = activeSlideIndex;
		this.#publisher?.update({ cursorX: x, cursorY: y, activeSlideIndex });
	}

	setSelection(
		selectedElementId: string | undefined,
		activeSlideIndex: number = this.#localActiveSlide,
	): void {
		this.#localActiveSlide = activeSlideIndex;
		this.#publisher?.update({ selectedElementId, activeSlideIndex });
	}

	setActiveSlide(index: number): void {
		this.#localActiveSlide = Math.max(0, Math.floor(index));
		this.#publisher?.update({ activeSlideIndex: this.#localActiveSlide });
		this.#refresh(); // re-filter which peer cursors are visible on this slide
	}

	followUser(clientId: number | null): void {
		this.followedClientId = clientId;
	}

	readonly #refresh = (): void => {
		if (!this.#awareness) {
			return;
		}
		const { width, height } = this.#getCanvasSize();
		const list = derivePresenceList(
			this.#awareness.getStates(),
			this.#selfId,
			readBound(width),
			readBound(height),
		);
		this.remotePresences = list;
		this.cursors = presenceToCursors(list, this.#localActiveSlide);
		if (this.followedClientId !== null && !list.some((p) => p.clientId === this.followedClientId)) {
			this.followedClientId = null;
		}
	};
}
