<script setup lang="ts">
/**
 * BroadcastDialog — start / stop a one-way live broadcast for the Vue viewer.
 *
 * A broadcast is a one-way collaboration session: the presenter drives slide
 * navigation and viewers follow along via a shareable link. This dialog only
 * owns the start/stop UI — the host (`PowerPointViewer.vue`) is responsible for
 * actually opening a collaboration session in response to the `start` event and
 * for supplying the resolved `viewerUrl` while the broadcast is `active`.
 *
 * Mirrors the React `BroadcastDialog.tsx` contract but trimmed to the one-way
 * presenter/viewer flow, built on the local {@link ModalDialog} shell.
 *
 * Props:
 *  - `open`      — whether the dialog is visible.
 *  - `defaults`  — optional `{ roomId, serverUrl }` seed for the start form.
 *  - `active`    — whether a broadcast is currently running.
 *  - `viewerUrl` — the shareable follow link (shown while `active`).
 *
 * Emits:
 *  - `start` — `{ roomId, serverUrl }` — the presenter started a broadcast.
 *  - `stop`  — the presenter stopped the active broadcast.
 *  - `close` — the dialog was dismissed.
 */
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

interface BroadcastDefaults {
	roomId?: string;
	serverUrl?: string;
}

interface BroadcastConfig {
	roomId: string;
	serverUrl: string;
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

const DEFAULT_SERVER_URL = 'ws://localhost:1234';

/** Generate a fresh, broadcast-scoped room id. */
function generateRoomId(): string {
	const suffix = Math.random().toString(36).slice(2, 10);
	return `broadcast-${suffix}`;
}

const roomId = ref('');
const serverUrl = ref(DEFAULT_SERVER_URL);
const copied = ref(false);

// Seed the form whenever the dialog opens for a fresh (non-active) broadcast.
watch(
	() => props.open,
	(open) => {
		if (open && !props.active) {
			roomId.value = props.defaults?.roomId ?? generateRoomId();
			serverUrl.value = props.defaults?.serverUrl ?? DEFAULT_SERVER_URL;
			copied.value = false;
		}
	},
	{ immediate: true },
);

const canStart = computed(
	() => roomId.value.trim().length > 0 && serverUrl.value.trim().length > 0,
);

const title = computed(() => (props.active ? 'Broadcasting' : 'Broadcast to a live audience'));

function onClose(): void {
	emit('close');
}

function onStart(): void {
	if (!canStart.value) {
		return;
	}
	emit('start', { roomId: roomId.value.trim(), serverUrl: serverUrl.value.trim() });
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
		<div v-if="props.active" class="pptx-vue-broadcast">
			<p class="pptx-vue-broadcast-desc">
				Your broadcast is live. Share this link so viewers can follow along.
			</p>

			<div class="pptx-vue-broadcast-field">
				<label for="pptx-vue-broadcast-viewer-url" class="pptx-vue-broadcast-label">
					Viewer link
				</label>
				<div class="pptx-vue-broadcast-link-row">
					<input
						id="pptx-vue-broadcast-viewer-url"
						class="pptx-vue-broadcast-input"
						type="text"
						readonly
						:value="props.viewerUrl ?? ''"
						@focus="(e) => (e.target as HTMLInputElement).select()"
					/>
					<button
						type="button"
						class="pptx-vue-broadcast-btn"
						:disabled="!canCopy || !props.viewerUrl"
						@click="onCopyLink"
					>
						{{ copied ? 'Copied' : 'Copy link' }}
					</button>
				</div>
				<p class="pptx-vue-broadcast-hint">Viewers opening this link will follow your slides.</p>
			</div>

			<button type="button" class="pptx-vue-broadcast-stop" @click="onStop">Stop broadcast</button>
		</div>

		<!-- Idle: configure + start a broadcast -->
		<div v-else class="pptx-vue-broadcast">
			<p class="pptx-vue-broadcast-desc">
				Start a one-way broadcast. You drive the slides; viewers follow along from a shareable link.
			</p>

			<div class="pptx-vue-broadcast-field">
				<label for="pptx-vue-broadcast-room-id" class="pptx-vue-broadcast-label">Room ID</label>
				<input
					id="pptx-vue-broadcast-room-id"
					v-model="roomId"
					class="pptx-vue-broadcast-input"
					type="text"
					placeholder="broadcast-abc123"
				/>
			</div>

			<div class="pptx-vue-broadcast-field">
				<label for="pptx-vue-broadcast-server-url" class="pptx-vue-broadcast-label">
					Server URL
				</label>
				<input
					id="pptx-vue-broadcast-server-url"
					v-model="serverUrl"
					class="pptx-vue-broadcast-input"
					type="text"
					placeholder="ws://localhost:1234"
				/>
			</div>
		</div>

		<template #footer>
			<button type="button" class="pptx-vue-broadcast-btn" @click="onClose">Close</button>
			<button
				v-if="!props.active"
				type="button"
				class="pptx-vue-broadcast-btn pptx-vue-broadcast-btn-primary"
				:disabled="!canStart"
				@click="onStart"
			>
				Start broadcast
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-broadcast {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.pptx-vue-broadcast-desc {
	margin: 0;
	font-size: 0.8125rem;
	line-height: 1.5;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-broadcast-field {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.pptx-vue-broadcast-label {
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--pptx-foreground, #f3f4f6);
}

.pptx-vue-broadcast-input {
	width: 100%;
	padding: 0.375rem 0.75rem;
	border: 1px solid var(--pptx-border, #374151);
	border-radius: 0.375rem;
	background: var(--pptx-background, #030712);
	color: var(--pptx-foreground, #f3f4f6);
	font-size: 0.8125rem;
}

.pptx-vue-broadcast-input:focus {
	outline: none;
	border-color: var(--pptx-primary, #6366f1);
}

.pptx-vue-broadcast-link-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.pptx-vue-broadcast-hint {
	margin: 0;
	font-size: 0.6875rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-vue-broadcast-btn {
	padding: 0.375rem 0.75rem;
	border: 1px solid var(--pptx-border, #374151);
	border-radius: 0.375rem;
	background: var(--pptx-card, #111827);
	color: var(--pptx-foreground, #f3f4f6);
	font-size: 0.75rem;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s ease;
}

.pptx-vue-broadcast-btn:hover:not(:disabled) {
	background: var(--pptx-border, #374151);
}

.pptx-vue-broadcast-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.pptx-vue-broadcast-btn-primary {
	border-color: var(--pptx-primary, #6366f1);
	background: var(--pptx-primary, #6366f1);
	color: #ffffff;
}

.pptx-vue-broadcast-btn-primary:hover:not(:disabled) {
	background: var(--pptx-primary, #6366f1);
	filter: brightness(1.1);
}

.pptx-vue-broadcast-stop {
	width: 100%;
	padding: 0.5rem 0.75rem;
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.375rem;
	background: rgba(239, 68, 68, 0.1);
	color: #f87171;
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s ease;
}

.pptx-vue-broadcast-stop:hover {
	background: rgba(239, 68, 68, 0.2);
}
</style>
