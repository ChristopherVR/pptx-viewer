<script setup lang="ts">
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';

/**
 * ShareDialog — Vue port of the React `ShareDialog`.
 *
 * Configures and starts a real-time collaboration session (room id, display
 * name, server URL), or stops an active one. Field defaults are supplied by
 * the host application via the `defaults` prop. When `active` is `true` the
 * form is replaced by a "Stop sharing" action.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Prefilled values for the form fields. */
	defaults?: { roomId?: string; userName?: string; serverUrl?: string };
	/** Whether a collaboration session is currently active. */
	active?: boolean;
}>();

const emit = defineEmits<{
	/** Fired with the assembled config when the user starts sharing. */
	start: [config: CollaborationConfig];
	/** Fired when the user stops an active session. */
	stop: [];
	/** Fired when the dialog is dismissed. */
	close: [];
}>();

const roomId = ref('');
const userName = ref('');
const serverUrl = ref('');

function resetFromDefaults(): void {
	roomId.value = props.defaults?.roomId ?? '';
	userName.value = props.defaults?.userName ?? '';
	serverUrl.value = props.defaults?.serverUrl ?? '';
}

// Re-seed the form from defaults whenever the dialog (re)opens.
watch(
	() => props.open,
	(open) => {
		if (open) {
			resetFromDefaults();
		}
	},
	{ immediate: true },
);

const canStart = computed(
	() =>
		roomId.value.trim().length > 0 &&
		userName.value.trim().length > 0 &&
		serverUrl.value.trim().length > 0,
);

function handleStart(): void {
	if (!canStart.value) {
		return;
	}
	emit('start', {
		roomId: roomId.value.trim(),
		userName: userName.value.trim(),
		serverUrl: serverUrl.value.trim(),
	});
}

function handleStop(): void {
	emit('stop');
}
</script>

<template>
	<ModalDialog
		:open="open"
		:title="active ? 'Collaboration active' : 'Share'"
		@close="emit('close')"
	>
		<div v-if="active" class="pptx-vue-share-active">
			<p class="pptx-vue-share-desc">A collaboration session is currently active.</p>
			<button type="button" class="pptx-vue-share-stop" @click="handleStop">Stop sharing</button>
		</div>

		<div v-else class="pptx-vue-share-form">
			<p class="pptx-vue-share-desc">
				Start a real-time session and invite others to edit with you.
			</p>

			<div class="pptx-vue-share-field">
				<label for="pptx-vue-share-room" class="pptx-vue-share-label">Room ID</label>
				<input
					id="pptx-vue-share-room"
					v-model="roomId"
					type="text"
					class="pptx-vue-share-input"
					placeholder="my-presentation"
				/>
			</div>

			<div class="pptx-vue-share-field">
				<label for="pptx-vue-share-name" class="pptx-vue-share-label">Your name</label>
				<input
					id="pptx-vue-share-name"
					v-model="userName"
					type="text"
					class="pptx-vue-share-input"
					placeholder="Jane Doe"
				/>
			</div>

			<div class="pptx-vue-share-field">
				<label for="pptx-vue-share-server" class="pptx-vue-share-label">Server URL</label>
				<input
					id="pptx-vue-share-server"
					v-model="serverUrl"
					type="text"
					class="pptx-vue-share-input"
					placeholder="wss://collab.example.com"
				/>
			</div>
		</div>

		<template #footer>
			<button type="button" class="pptx-vue-share-btn" @click="emit('close')">
				{{ active ? 'Close' : 'Cancel' }}
			</button>
			<button
				v-if="!active"
				type="button"
				class="pptx-vue-share-btn pptx-vue-share-btn-primary"
				:disabled="!canStart"
				@click="handleStart"
			>
				Start sharing
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-share-form,
.pptx-vue-share-active {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.pptx-vue-share-desc {
	margin: 0;
	font-size: 0.8125rem;
	color: var(--pptx-muted-foreground, #9a9a9a);
}

.pptx-vue-share-field {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.pptx-vue-share-label {
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--pptx-foreground, #e5e5e5);
}

.pptx-vue-share-input {
	width: 100%;
	padding: 0.375rem 0.75rem;
	border-radius: 0.375rem;
	border: 1px solid var(--pptx-border, #2a2a2a);
	background: var(--pptx-background, #111);
	color: var(--pptx-foreground, #e5e5e5);
	font-size: 0.8125rem;
}

.pptx-vue-share-input:focus {
	outline: none;
	border-color: var(--pptx-primary, #6366f1);
	box-shadow: 0 0 0 1px var(--pptx-primary, #6366f1);
}

.pptx-vue-share-btn {
	padding: 0.375rem 0.75rem;
	border: none;
	border-radius: 0.375rem;
	background: var(--pptx-muted, #2a2a2a);
	color: var(--pptx-foreground, #e5e5e5);
	font-size: 0.75rem;
	cursor: pointer;
}

.pptx-vue-share-btn-primary {
	background: var(--pptx-primary, #6366f1);
	color: var(--pptx-primary-foreground, #fff);
}

.pptx-vue-share-btn-primary:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.pptx-vue-share-stop {
	width: 100%;
	padding: 0.5rem 0.75rem;
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.375rem;
	background: rgba(239, 68, 68, 0.1);
	color: #f87171;
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
}

.pptx-vue-share-stop:hover {
	background: rgba(239, 68, 68, 0.2);
}
</style>
