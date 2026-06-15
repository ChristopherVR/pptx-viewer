<script setup lang="ts">
/**
 * FollowModeBar — presentational control that lists the active remote peers
 * and lets the local user follow one of them (mirroring that peer's active
 * slide) or stop following.
 *
 * Owns no Yjs/network logic: the integrator supplies the reactive
 * {@link RemotePresence} list and the currently-followed clientId (from the
 * collaboration composable), and listens for the `follow` event to drive
 * `followUser(clientId | null)`. Each peer chip shows an initials avatar in the
 * peer's colour; the followed peer is highlighted with a "Stop" affordance.
 */
import { computed } from 'vue';

import type { RemotePresence } from '../composables/useCollaboration';

const props = defineProps<{
	/** Active remote collaborators (excludes self). */
	presences: RemotePresence[];
	/** The clientId currently being followed, or null. */
	followedClientId: number | null;
}>();

const emit = defineEmits<{
	/** Follow the given peer, or `null` to stop following. */
	(e: 'follow', clientId: number | null): void;
}>();

/** First-letter / two-char initials for the avatar chip. */
function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase() || '?';
}

/** The presence of the peer currently being followed, if still present. */
const followedPeer = computed<RemotePresence | null>(() => {
	if (props.followedClientId === null) {
		return null;
	}
	return props.presences.find((p) => p.clientId === props.followedClientId) ?? null;
});

function toggleFollow(clientId: number): void {
	emit('follow', props.followedClientId === clientId ? null : clientId);
}

function stopFollowing(): void {
	emit('follow', null);
}
</script>

<template>
	<div v-if="props.presences.length > 0" class="pptx-vue-follow-bar" data-export-ignore="true">
		<span class="pptx-vue-follow-status">
			<template v-if="followedPeer">
				Following <strong>{{ followedPeer.userName }}</strong>
				<button
					type="button"
					class="pptx-vue-follow-stop"
					title="Stop following"
					@click="stopFollowing"
				>
					Stop
				</button>
			</template>
			<template v-else> Follow a collaborator </template>
		</span>
		<ul class="pptx-vue-follow-list">
			<li v-for="peer in props.presences" :key="peer.clientId">
				<button
					type="button"
					class="pptx-vue-follow-peer"
					:class="{ 'is-following': peer.clientId === props.followedClientId }"
					:data-client-id="peer.clientId"
					:aria-pressed="peer.clientId === props.followedClientId"
					:title="
						peer.clientId === props.followedClientId
							? `Stop following ${peer.userName}`
							: `Follow ${peer.userName}`
					"
					@click="toggleFollow(peer.clientId)"
				>
					<span class="pptx-vue-follow-avatar" :style="{ backgroundColor: peer.color }">
						{{ initials(peer.userName) }}
					</span>
					<span class="pptx-vue-follow-name">{{ peer.userName }}</span>
				</button>
			</li>
		</ul>
	</div>
</template>

<style scoped>
.pptx-vue-follow-bar {
	display: flex;
	align-items: center;
	gap: 12px;
	flex-wrap: wrap;
	padding: 6px 10px;
	font-family: system-ui, sans-serif;
	font-size: 12px;
	color: #e5e7eb;
	background: rgba(17, 24, 39, 0.92);
	border-radius: 8px;
}

.pptx-vue-follow-status {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
	color: #9ca3af;
}

.pptx-vue-follow-status strong {
	color: #f3f4f6;
}

.pptx-vue-follow-stop {
	padding: 2px 8px;
	border: 1px solid #4b5563;
	border-radius: 6px;
	background: transparent;
	color: #e5e7eb;
	font-size: 11px;
	cursor: pointer;
}

.pptx-vue-follow-stop:hover {
	background: rgba(75, 85, 99, 0.4);
}

.pptx-vue-follow-list {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pptx-vue-follow-peer {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 3px 8px 3px 3px;
	border: 1px solid transparent;
	border-radius: 999px;
	background: rgba(55, 65, 81, 0.5);
	color: inherit;
	font: inherit;
	cursor: pointer;
}

.pptx-vue-follow-peer:hover {
	background: rgba(75, 85, 99, 0.7);
}

.pptx-vue-follow-peer.is-following {
	border-color: #60a5fa;
	background: rgba(37, 99, 235, 0.35);
}

.pptx-vue-follow-avatar {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	color: #ffffff;
	font-size: 10px;
	font-weight: 600;
	line-height: 1;
}

.pptx-vue-follow-name {
	max-width: 120px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
