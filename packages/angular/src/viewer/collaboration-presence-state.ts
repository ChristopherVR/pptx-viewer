import { computed, signal } from '@angular/core';

import { createPresenceProjector, presenceToCursors } from '../internal/shared';
import type { RemoteCursor, RemotePresence } from './collaboration-helpers';
import type { ActiveSession } from './collaboration-session-setup';

/** Angular signals over the shared memoized awareness projection. */
export class CollaborationPresenceState {
	readonly presence = signal<RemotePresence[]>([]);
	readonly cursors = computed<RemoteCursor[]>(() => presenceToCursors(this.presence()));
	/** The client id the local user is currently following (null when free). */
	readonly followedClientId = signal<number | null>(null);
	/** Active-slide index of the followed peer, or null when not following. */
	readonly followedSlideIndex = computed<number | null>(() => {
		const id = this.followedClientId();
		return id === null
			? null
			: (this.presence().find((peer) => peer.clientId === id)?.activeSlideIndex ?? null);
	});
	/** Active-slide index of the first owner peer (the broadcaster), or null. */
	readonly broadcasterSlideIndex = computed<number | null>(
		() => this.presence().find((peer) => peer.role === 'owner')?.activeSlideIndex ?? null,
	);
	private readonly projector = createPresenceProjector();

	refresh(session: ActiveSession | null, width: number, height: number): void {
		if (!session) {
			this.reset();
			return;
		}
		// Awareness fires on idle heartbeats too. Preserve array identity unless
		// visible presence changes so overlays do not rerender on a timer (#145).
		const { list, changed } = this.projector.project(
			session.awareness.getStates(),
			session.selfId,
			width,
			height,
		);
		if (changed) {
			this.presence.set(list);
		}
	}

	reset(): void {
		// Rejoining the same peers must not reuse the departed session's memo.
		this.projector.reset();
		this.presence.set([]);
		this.followedClientId.set(null);
	}
}
