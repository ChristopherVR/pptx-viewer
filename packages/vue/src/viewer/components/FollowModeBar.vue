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
	<div
		v-if="props.presences.length > 0"
		class="pptx-vue-follow-bar flex flex-wrap items-center gap-3 rounded-lg bg-card/95 px-2.5 py-1.5 text-xs text-foreground"
		data-export-ignore="true"
	>
		<span
			class="pptx-vue-follow-status inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground"
		>
			<template v-if="followedPeer">
				Following <strong class="text-foreground">{{ followedPeer.userName }}</strong>
				<button
					type="button"
					class="pptx-vue-follow-stop cursor-pointer rounded-md border border-border bg-transparent px-2 py-0.5 text-[11px] text-foreground hover:bg-muted"
					title="Stop following"
					@click="stopFollowing"
				>
					Stop
				</button>
			</template>
			<template v-else> Follow a collaborator </template>
		</span>
		<ul class="pptx-vue-follow-list m-0 flex list-none items-center gap-1.5 p-0">
			<li v-for="peer in props.presences" :key="peer.clientId">
				<button
					type="button"
					class="pptx-vue-follow-peer inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-muted/60 py-0.5 pl-0.5 pr-2 text-foreground hover:bg-muted"
					:class="{
						'is-following border-primary bg-primary/30': peer.clientId === props.followedClientId,
					}"
					:data-client-id="peer.clientId"
					:aria-pressed="peer.clientId === props.followedClientId"
					:title="
						peer.clientId === props.followedClientId
							? `Stop following ${peer.userName}`
							: `Follow ${peer.userName}`
					"
					@click="toggleFollow(peer.clientId)"
				>
					<span
						class="pptx-vue-follow-avatar inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-semibold leading-none text-white"
						:style="{ backgroundColor: peer.color }"
					>
						{{ initials(peer.userName) }}
					</span>
					<span
						class="pptx-vue-follow-name max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap"
						>{{ peer.userName }}</span
					>
				</button>
			</li>
		</ul>
	</div>
</template>
