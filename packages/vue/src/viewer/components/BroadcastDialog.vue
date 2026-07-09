<script setup lang="ts">
import {
	DEFAULT_BROADCAST_SERVER_URL,
	generateBroadcastRoomId,
	resolveTransportForServerUrl,
} from 'pptx-viewer-shared';
import type { CollaborationTransport } from 'pptx-viewer-shared';
/**
 * BroadcastDialog: start / stop a one-way live broadcast for the Vue viewer.
 *
 * A broadcast is a one-way collaboration session: the presenter drives slide
 * navigation and viewers follow along via a shareable link. This dialog only
 * owns the start/stop UI; the host (`PowerPointViewer.vue`) is responsible for
 * actually opening a collaboration session in response to the `start` event and
 * for supplying the resolved `viewerUrl` while the broadcast is `active`.
 *
 * Mirrors the React `BroadcastDialog.tsx` contract but trimmed to the one-way
 * presenter/viewer flow, built on the local {@link ModalDialog} shell.
 *
 * Props:
 *  - `open`      : whether the dialog is visible.
 *  - `defaults`  : optional `{ roomId, serverUrl }` seed for the start form.
 *  - `active`    : whether a broadcast is currently running.
 *  - `viewerUrl` : the shareable follow link (shown while `active`).
 *
 * Emits:
 *  - `start` : `{ roomId, serverUrl }`, the presenter started a broadcast.
 *  - `stop`  : the presenter stopped the active broadcast.
 *  - `close` : the dialog was dismissed.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

interface BroadcastDefaults {
	roomId?: string;
	serverUrl?: string;
}

interface BroadcastConfig {
	roomId: string;
	serverUrl: string;
	transport?: CollaborationTransport;
}

const props = defineProps<{
	open: boolean;
	defaults?: BroadcastDefaults;
	active?: boolean;
	viewerUrl?: string;
}>();

const emit = defineEmits<{
	start: [config: BroadcastConfig];
	stop: [];
	close: [];
}>();

const { t } = useI18n();

const roomId = ref('');
const serverUrl = ref(DEFAULT_BROADCAST_SERVER_URL);
const copied = ref(false);

// Seed the form whenever the dialog opens for a fresh (non-active) broadcast.
watch(
	() => props.open,
	(open) => {
		if (open && !props.active) {
			roomId.value = props.defaults?.roomId ?? generateBroadcastRoomId();
			serverUrl.value = props.defaults?.serverUrl ?? DEFAULT_BROADCAST_SERVER_URL;
			copied.value = false;
		}
	},
	{ immediate: true },
);

// A blank server URL is valid: it selects serverless peer-to-peer (webrtc).
const canStart = computed(() => roomId.value.trim().length > 0);

// True when the current server field selects serverless peer-to-peer mode.
const isPeerToPeer = computed(() => resolveTransportForServerUrl(serverUrl.value) === 'webrtc');

const title = computed(() =>
	props.active ? t('pptx.broadcast.broadcastingTitle') : t('pptx.broadcast.startTitle'),
);

function onClose(): void {
	emit('close');
}

function onStart(): void {
	if (!canStart.value) {
		return;
	}
	const trimmedServer = serverUrl.value.trim();
	emit('start', {
		roomId: roomId.value.trim(),
		serverUrl: trimmedServer,
		transport: resolveTransportForServerUrl(trimmedServer),
	});
}

function onStop(): void {
	emit('stop');
}

const canCopy = computed(
	() =>
		typeof navigator !== 'undefined' &&
		navigator.clipboard !== undefined &&
		typeof navigator.clipboard.writeText === 'function',
);

function onCopyLink(): void {
	if (!props.viewerUrl || !canCopy.value) {
		return;
	}
	void Promise.resolve(navigator.clipboard.writeText(props.viewerUrl)).then(() => {
		copied.value = true;
		window.setTimeout(() => {
			copied.value = false;
		}, 2000);
		return undefined;
	});
}
</script>

<template>
	<ModalDialog :open="props.open" :title="title" @close="onClose">
		<!-- Active: share the follow link + stop control -->
		<div v-if="props.active" class="pptx-vue-broadcast flex flex-col gap-4">
			<p class="pptx-vue-broadcast-desc text-[13px] leading-relaxed text-muted-foreground">
				{{ t('pptx.broadcast.liveDesc') }}
			</p>

			<div class="pptx-vue-broadcast-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-broadcast-viewer-url"
					class="pptx-vue-broadcast-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.broadcast.viewerLink') }}
				</label>
				<div class="pptx-vue-broadcast-link-row flex items-center gap-2">
					<input
						id="pptx-vue-broadcast-viewer-url"
						class="pptx-vue-broadcast-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						type="text"
						readonly
						:value="props.viewerUrl ?? ''"
						@focus="(e) => (e.target as HTMLInputElement).select()"
					/>
					<button
						type="button"
						class="pptx-vue-broadcast-btn shrink-0 whitespace-nowrap rounded border border-border bg-muted px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
						:disabled="!canCopy || !props.viewerUrl"
						@click="onCopyLink"
					>
						{{ copied ? t('pptx.share.copied') : t('pptx.broadcast.copyLinkBtn') }}
					</button>
				</div>
				<p class="pptx-vue-broadcast-hint text-[11px] text-muted-foreground">
					{{ t('pptx.broadcast.viewerHint') }}
				</p>
				<p
					v-if="isPeerToPeer"
					class="pptx-vue-broadcast-server-value text-[11px] text-muted-foreground"
				>
					{{ t('pptx.broadcast.p2pServerValue') }}
				</p>
			</div>

			<button
				type="button"
				class="pptx-vue-broadcast-stop w-full rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
				@click="onStop"
			>
				{{ t('pptx.broadcast.stopBroadcast') }}
			</button>
		</div>

		<!-- Idle: configure + start a broadcast -->
		<div v-else class="pptx-vue-broadcast flex flex-col gap-4">
			<p class="pptx-vue-broadcast-desc text-[13px] leading-relaxed text-muted-foreground">
				{{ t('pptx.broadcast.idleDesc') }}
			</p>

			<div class="pptx-vue-broadcast-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-broadcast-room-id"
					class="pptx-vue-broadcast-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.broadcast.roomId') }}
				</label>
				<input
					id="pptx-vue-broadcast-room-id"
					v-model="roomId"
					class="pptx-vue-broadcast-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					type="text"
					:placeholder="t('pptx.broadcast.roomIdPlaceholder')"
				/>
			</div>

			<div class="pptx-vue-broadcast-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-broadcast-server-url"
					class="pptx-vue-broadcast-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.broadcast.serverUrl') }}
				</label>
				<input
					id="pptx-vue-broadcast-server-url"
					v-model="serverUrl"
					class="pptx-vue-broadcast-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					type="text"
					placeholder="ws://localhost:1234"
				/>
				<p
					v-if="isPeerToPeer"
					class="pptx-vue-broadcast-p2p-hint text-[11px] text-muted-foreground"
				>
					{{ t('pptx.broadcast.p2pHint') }}
				</p>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-broadcast-btn rounded bg-muted px-3 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
				@click="onClose"
			>
				{{ t('pptx.common.close') }}
			</button>
			<button
				v-if="!props.active"
				type="button"
				class="pptx-vue-broadcast-btn pptx-vue-broadcast-btn-primary rounded bg-primary px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
				:disabled="!canStart"
				@click="onStart"
			>
				{{ t('pptx.broadcast.startBroadcast') }}
			</button>
		</template>
	</ModalDialog>
</template>
