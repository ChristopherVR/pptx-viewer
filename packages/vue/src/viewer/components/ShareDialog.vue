<script setup lang="ts">
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';

/**
 * ShareDialog - Vue port of the React `ShareDialog`.
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

const { t } = useI18n();

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
		:title="active ? t('pptx.share.collaborationActive') : t('pptx.toolbar.share')"
		@close="emit('close')"
	>
		<div v-if="active" class="pptx-vue-share-active flex flex-col gap-4">
			<p class="pptx-vue-share-desc text-[13px] leading-relaxed text-muted-foreground">
				{{ t('pptx.share.activeDescription') }}
			</p>
			<button
				type="button"
				class="pptx-vue-share-stop w-full rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
				@click="handleStop"
			>
				{{ t('pptx.share.stopSharing') }}
			</button>
		</div>

		<div v-else class="pptx-vue-share-form flex flex-col gap-4">
			<p class="pptx-vue-share-desc text-[13px] leading-relaxed text-muted-foreground">
				{{ t('pptx.share.formDescription') }}
			</p>

			<div class="pptx-vue-share-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-share-room"
					class="pptx-vue-share-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.share.roomId') }}
				</label>
				<input
					id="pptx-vue-share-room"
					v-model="roomId"
					type="text"
					class="pptx-vue-share-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="my-presentation"
				/>
			</div>

			<div class="pptx-vue-share-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-share-name"
					class="pptx-vue-share-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.share.yourName') }}
				</label>
				<input
					id="pptx-vue-share-name"
					v-model="userName"
					type="text"
					class="pptx-vue-share-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="Jane Doe"
				/>
			</div>

			<div class="pptx-vue-share-field flex flex-col gap-1.5">
				<label
					for="pptx-vue-share-server"
					class="pptx-vue-share-label text-[12px] font-medium text-foreground"
				>
					{{ t('pptx.share.serverUrl') }}
				</label>
				<input
					id="pptx-vue-share-server"
					v-model="serverUrl"
					type="text"
					class="pptx-vue-share-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					:placeholder="t('pptx.share.serverPlaceholder')"
				/>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-share-btn rounded bg-muted px-3 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
				@click="emit('close')"
			>
				{{ active ? t('pptx.share.close') : t('pptx.share.cancel') }}
			</button>
			<button
				v-if="!active"
				type="button"
				class="pptx-vue-share-btn pptx-vue-share-btn-primary rounded bg-primary px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
				:disabled="!canStart"
				@click="handleStart"
			>
				{{ t('pptx.share.startSharing') }}
			</button>
		</template>
	</ModalDialog>
</template>
