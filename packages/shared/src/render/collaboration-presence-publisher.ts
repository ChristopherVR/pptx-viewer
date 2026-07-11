/**
 * collaboration-presence-publisher.ts: throttled writer for the local user's
 * awareness presence.
 *
 * Publishes a single nested `presence` field over Yjs awareness, the
 * cross-framework wire format every binding (React, Vue, Angular, Vanilla,
 * Svelte) reads via `derivePresenceList`. The shape mirrors `sanitizePresence`:
 * `{ userName, userColor, userAvatar?, role?, activeSlideIndex, cursorX,
 * cursorY, selectedElementId?, lastUpdated }`.
 *
 * Outgoing updates are throttled to `BROADCAST_THROTTLE_MS` (leading edge plus
 * a trailing flush) so rapid cursor moves do not flood the network; a caller's
 * heartbeat re-publishes via {@link PresencePublisher.flush} so peers do not
 * time us out.
 */
import type { CollaborationRole } from '../types';
import { BROADCAST_THROTTLE_MS } from './collaboration-presence';

/**
 * Structural interface for the lazily-imported Yjs awareness surface. Every
 * binding's live `y-protocols/awareness` `Awareness` instance satisfies this.
 */
export interface AwarenessLike {
	clientID?: number;
	setLocalStateField: (field: string, value: unknown) => void;
	getStates: () => Map<number, Record<string, unknown>>;
	on: (event: string, cb: () => void) => void;
	off?: (event: string, cb: () => void) => void;
}

/** Stable identity fields, fixed for the lifetime of a session. */
export interface PresenceIdentity {
	userName: string;
	userColor: string;
	userAvatar?: string;
	role?: CollaborationRole;
}

/** The mutable per-frame presence state (cursor, selection, active slide). */
export interface LocalPresenceState {
	activeSlideIndex: number;
	cursorX: number;
	cursorY: number;
	selectedElementId?: string;
}

export interface PresencePublisher {
	/** Merge a partial state patch and publish (throttled). */
	update: (patch: Partial<LocalPresenceState>) => void;
	/** Re-publish the current state immediately (heartbeat / initial announce). */
	flush: () => void;
	/** Cancel any pending throttled publish. */
	dispose: () => void;
}

/**
 * Create a throttled presence publisher bound to an awareness instance. The
 * initial presence is announced synchronously so peers learn of us at once.
 */
export function createPresencePublisher(
	awareness: AwarenessLike,
	identity: PresenceIdentity,
): PresencePublisher {
	const local: LocalPresenceState = { activeSlideIndex: 0, cursorX: 0, cursorY: 0 };
	// Starts at 0 so the first real update publishes immediately (the initial
	// announce below does not consume the throttle budget).
	let lastBroadcast = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;

	function publish(): void {
		awareness.setLocalStateField('presence', {
			userName: identity.userName,
			userColor: identity.userColor,
			userAvatar: identity.userAvatar,
			role: identity.role,
			activeSlideIndex: local.activeSlideIndex,
			cursorX: local.cursorX,
			cursorY: local.cursorY,
			selectedElementId: local.selectedElementId,
			lastUpdated: new Date().toISOString(),
		});
	}

	function update(patch: Partial<LocalPresenceState>): void {
		Object.assign(local, patch);
		const elapsed = Date.now() - lastBroadcast;
		if (elapsed >= BROADCAST_THROTTLE_MS) {
			if (pending !== null) {
				clearTimeout(pending);
				pending = null;
			}
			lastBroadcast = Date.now();
			publish();
		} else if (pending === null) {
			pending = setTimeout(() => {
				pending = null;
				lastBroadcast = Date.now();
				publish();
			}, BROADCAST_THROTTLE_MS - elapsed);
		}
	}

	function flush(): void {
		if (pending !== null) {
			clearTimeout(pending);
			pending = null;
		}
		lastBroadcast = Date.now();
		publish();
	}

	function dispose(): void {
		if (pending !== null) {
			clearTimeout(pending);
			pending = null;
		}
	}

	// Announce initial presence immediately (without consuming the throttle).
	publish();

	return { update, flush, dispose };
}
