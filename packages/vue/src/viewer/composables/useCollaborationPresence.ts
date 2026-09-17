import type {
	AwarenessLike,
	CollaborationConfig,
	PresencePublisher,
	SanitizedPresence,
} from 'pptx-viewer-shared';
import {
	assignUserColor,
	createPresencePublisher,
	PRESENCE_HEARTBEAT_MS,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';

import type { RemoteCursor } from '../components/CollaborationCursors.vue';
import { createPresenceProjection, readBound } from './collaboration-presence-view';
import type { RemotePresence, UseCollaborationOptions } from './collaboration-types';

/** Reactive presence projection; document readiness stays in the shared controller. */
export function useCollaborationPresence(options: UseCollaborationOptions) {
	const remotePresences = ref<RemotePresence[]>([]);
	const remoteUsers = ref<SanitizedPresence[]>([]);
	const cursors = ref<RemoteCursor[]>([]);
	const followedClientId = ref<number | null>(null);
	const followedSlideIndex = computed(
		() =>
			remotePresences.value.find((peer) => peer.clientId === followedClientId.value)?.activeSlide ??
			null,
	);
	const broadcasterSlideIndex = computed(
		() => remotePresences.value.find((peer) => peer.role === 'owner')?.activeSlide ?? null,
	);
	const projection = createPresenceProjection();
	let awareness: AwarenessLike | null = null;
	let publisher: PresencePublisher | null = null;
	let activeSlide = 0;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	function refresh(): void {
		if (!awareness) {
			return;
		}
		const next = projection.project(
			awareness.getStates(),
			awareness.clientID ?? -1,
			readBound(options.canvasWidth),
			readBound(options.canvasHeight),
			activeSlide,
		);
		// Idle awareness heartbeats must not rerender an unchanged overlay.
		if (!next.changed) {
			return;
		}
		remotePresences.value = next.presences;
		remoteUsers.value = next.remoteUsers;
		cursors.value = next.cursors;
		if (
			followedClientId.value !== null &&
			!next.presences.some((peer) => peer.clientId === followedClientId.value)
		) {
			followedClientId.value = null;
		}
	}
	function start(next: AwarenessLike, config: CollaborationConfig): void {
		awareness = next;
		publisher = createPresencePublisher(next, {
			userName: config.userName,
			// Keep a deterministic color for the same user across sessions.
			userColor: options.userColor ?? config.userColor ?? assignUserColor(config.userName),
			userAvatar: config.userAvatar,
			role: config.role,
		});
		next.on('change', refresh);
		next.on('update', refresh);
		heartbeat = setInterval(() => publisher?.flush(), PRESENCE_HEARTBEAT_MS);
		refresh();
	}
	function stop(): void {
		if (heartbeat !== null) {
			clearInterval(heartbeat);
		}
		heartbeat = null;
		awareness?.off?.('change', refresh);
		awareness?.off?.('update', refresh);
		publisher?.dispose();
		publisher = null;
		awareness = null;
		activeSlide = 0;
		projection.reset();
		remotePresences.value = [];
		remoteUsers.value = [];
		cursors.value = [];
		followedClientId.value = null;
	}
	return {
		remoteUsers,
		remotePresences,
		cursors,
		followedClientId,
		followedSlideIndex,
		broadcasterSlideIndex,
		start,
		stop,
		setCursor: (x: number, y: number) => publisher?.update({ cursorX: x, cursorY: y }),
		setSelection: (ids: string[]) => publisher?.update({ selectedElementId: ids[0] }),
		setActiveSlide: (index: number) => {
			activeSlide = Math.max(0, Math.floor(index));
			publisher?.update({ activeSlideIndex: activeSlide });
			refresh();
		},
		followUser: (clientId: number | null) => {
			followedClientId.value = clientId;
		},
	};
}
