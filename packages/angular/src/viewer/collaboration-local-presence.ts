/**
 * collaboration-local-presence.ts: publishes the local user's presence into a
 * single awareness `presence` field.
 *
 * Cursor, selection, and active-slide updates all merge into one record so a
 * later cursor move never clobbers the selection (or vice versa). The remote
 * side reads this shape via the shared `derivePresenceList`.
 */

import type { AwarenessLike } from './collaboration-providers';

/** Immutable identity of the local collaborator. */
export interface LocalIdentity {
	userName: string;
	userColor: string;
	userAvatar?: string;
	role?: string;
}

export class LocalPresencePublisher {
	private activeSlide = 0;
	private cursor = { x: 0, y: 0 };
	private selection: string | undefined;

	constructor(
		private readonly awareness: AwarenessLike,
		private readonly identity: LocalIdentity,
	) {}

	/** Re-emit the merged presence record (also used as a heartbeat). */
	publish(): void {
		this.awareness.setLocalStateField('presence', {
			userName: this.identity.userName,
			userColor: this.identity.userColor,
			userAvatar: this.identity.userAvatar,
			role: this.identity.role,
			activeSlideIndex: this.activeSlide,
			cursorX: this.cursor.x,
			cursorY: this.cursor.y,
			selectedElementId: this.selection,
			lastUpdated: new Date().toISOString(),
		});
	}

	setCursor(x: number, y: number, activeSlideIndex = this.activeSlide): void {
		this.cursor = { x, y };
		this.activeSlide = activeSlideIndex;
		this.publish();
	}

	setSelection(selectedElementId: string | undefined, activeSlideIndex = this.activeSlide): void {
		this.selection = selectedElementId;
		this.activeSlide = activeSlideIndex;
		this.publish();
	}

	setActiveSlide(index: number): void {
		this.activeSlide = Math.max(0, Math.floor(index));
		this.publish();
	}
}
