<script setup lang="ts">
import type { CollaborationConfig } from 'pptx-viewer-shared';
import {
	buildActiveSessionUsers,
	buildCollaborationShareUrl,
	buildCreateCollaborationConfig,
	buildJoinCollaborationConfig,
	resolveTransportForServerUrl,
} from 'pptx-viewer-shared';
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { UseCollaborationResult } from '../composables/useCollaboration';
import { ViewerOptionsKey } from '../composables/useViewerOptionsStore';
import ModalDialog from './ModalDialog.vue';

/**
 * ShareDialog - Vue port of the React `ShareDialog`.
 *
 * Configures and starts a real-time collaboration session (room id, display
 * name, server URL), or stops an active one. Field defaults are supplied by
 * the host application via the `defaults` prop. When `active` is `true` the
 * form is replaced by the active-session view: status, a copyable share link,
 * room/server details, and the connected-users list built by shared's
 * `buildActiveSessionUsers` from `collab`'s live presence state.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Prefilled values for the form fields. */
	defaults?: { roomId?: string; userName?: string; serverUrl?: string };
	/** Whether a collaboration session is currently active. */
	active?: boolean;
	/** Live collaboration session state (status/count/remote users). */
	collab?: UseCollaborationResult;
	/** The config the active session was started with; null while stopped. */
	activeCollaboration?: CollaborationConfig | null;
}>();

const viewerOptions = inject(ViewerOptionsKey, undefined);

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
const mode = ref<'create' | 'join'>('create');
const invitation = ref('');

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

// A blank server URL is valid: it selects serverless peer-to-peer (webrtc).
const pendingConfig = computed(() =>
	mode.value === 'join'
		? buildJoinCollaborationConfig({
				invitation: invitation.value,
				userName: userName.value,
				serverUrl: serverUrl.value,
			})
		: buildCreateCollaborationConfig({
				roomId: roomId.value,
				userName: userName.value,
				serverUrl: serverUrl.value,
			}),
);
const canStart = computed(() => pendingConfig.value !== null);

// True when the current server field selects serverless peer-to-peer mode.
const isPeerToPeer = computed(() => resolveTransportForServerUrl(serverUrl.value) === 'webrtc');

// ── Active-session view ──────────────────────────────────────────────────

const status = computed(() => props.collab?.status.value ?? 'disconnected');
const connectedCount = computed(() => props.collab?.connectedCount.value ?? 0);
const activeIsPeerToPeer = computed(
	() => resolveTransportForServerUrl(props.activeCollaboration?.serverUrl ?? '') === 'webrtc',
);
const activeShareUrl = computed(() => {
	if (!props.activeCollaboration || typeof window === 'undefined') {
		return '';
	}
	return buildCollaborationShareUrl(props.activeCollaboration, {
		origin: window.location.origin,
		pathname: window.location.pathname,
	});
});
const sessionUsers = computed(() => {
	if (!props.collab || !props.activeCollaboration) {
		return [];
	}
	return buildActiveSessionUsers({
		localUserName: props.activeCollaboration.userName,
		localUserInitials: viewerOptions?.value.general.userInitials,
		localUserColor: props.activeCollaboration.userColor,
		remoteUsers: props.collab.remotePresences.value.map((peer) => ({
			clientId: peer.clientId,
			userName: peer.userName,
			userColor: peer.color,
			activeSlideIndex: peer.activeSlide,
		})),
	});
});

const copied = ref(false);
function onCopyLink(): void {
	if (!activeShareUrl.value || typeof navigator === 'undefined' || !navigator.clipboard) {
		return;
	}
	void navigator.clipboard.writeText(activeShareUrl.value).then(() => {
		copied.value = true;
		window.setTimeout(() => {
			copied.value = false;
		}, 2000);
		return undefined;
	});
}

function handleStart(): void {
	if (pendingConfig.value) {
		emit('start', pendingConfig.value);
	}
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
			<!-- Status -->
			<div class="flex items-center gap-2">
				<span
					class="inline-block h-2 w-2 rounded-full"
					:class="{
						'bg-green-400': status === 'connected',
						'bg-yellow-400': status === 'connecting',
						'bg-red-400': status !== 'connected' && status !== 'connecting',
					}"
				/>
				<span class="text-[13px] font-medium capitalize text-foreground">{{ status }}</span>
				<span class="ml-auto text-[12px] text-muted-foreground">
					{{ t('pptx.collaboration.userCount', { count: connectedCount }) }}
				</span>
			</div>

			<!-- Share URL -->
			<div v-if="activeShareUrl" class="pptx-vue-share-field flex flex-col gap-1.5">
				<label class="text-[12px] font-medium text-foreground">{{
					t('pptx.share.shareLink')
				}}</label>
				<div class="flex items-center gap-2">
					<div
						class="flex-1 select-all truncate rounded border border-border bg-background px-3 py-1.5 font-mono text-[11px] text-foreground"
					>
						{{ activeShareUrl }}
					</div>
					<button
						type="button"
						class="shrink-0 rounded border border-border bg-muted px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:bg-accent"
						:title="t('pptx.share.copyLink')"
						@click="onCopyLink"
					>
						{{ copied ? t('pptx.share.copied') : t('pptx.share.copyUrl') }}
					</button>
				</div>
				<p class="text-[11px] text-muted-foreground">{{ t('pptx.share.shareHint') }}</p>
			</div>

			<!-- Session details -->
			<div
				v-if="activeCollaboration"
				class="flex items-center gap-3 text-[11px] text-muted-foreground"
			>
				<span>
					{{ t('pptx.share.room') }}
					<code class="font-mono text-foreground">{{ activeCollaboration.roomId }}</code>
				</span>
				<span>
					{{ t('pptx.share.server') }}
					<code class="font-mono text-foreground">
						{{
							activeIsPeerToPeer ? t('pptx.share.p2pServerValue') : activeCollaboration.serverUrl
						}}
					</code>
				</span>
			</div>
			<p
				v-else-if="isPeerToPeer"
				class="pptx-vue-share-server-value text-[12px] text-muted-foreground"
			>
				{{ t('pptx.share.p2pServerValue') }}
			</p>

			<!-- Connected users -->
			<div v-if="sessionUsers.length > 0" class="pptx-vue-share-field flex flex-col gap-1.5">
				<label class="text-[12px] font-medium text-foreground">{{
					t('pptx.share.connectedUsers')
				}}</label>
				<div
					class="max-h-[140px] divide-y divide-border overflow-y-auto rounded border border-border bg-background"
				>
					<div
						v-for="user in sessionUsers"
						:key="user.id"
						class="flex items-center gap-2 px-3 py-2"
					>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
							:style="{ backgroundColor: user.color }"
						>
							<img
								v-if="user.avatarUrl"
								:src="user.avatarUrl"
								alt=""
								class="h-full w-full rounded-full object-cover"
							/>
							<template v-else>{{ user.initials }}</template>
						</div>
						<span class="truncate text-[12px] text-foreground">{{ user.name }}</span>
						<span class="ml-auto text-[10px] text-muted-foreground">
							{{
								user.isLocal ? t('pptx.share.you') : t('pptx.notes.slideN', { n: user.slideNumber })
							}}
						</span>
					</div>
				</div>
			</div>

			<button
				type="button"
				class="pptx-vue-share-stop w-full rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
				@click="handleStop"
			>
				{{ t('pptx.share.stopSharing') }}
			</button>
		</div>

		<div v-else class="pptx-vue-share-form flex flex-col gap-4">
			<div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
				<button
					v-for="candidate in ['create', 'join'] as const"
					:key="candidate"
					type="button"
					role="tab"
					:aria-selected="mode === candidate"
					class="rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
					:class="
						mode === candidate ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
					"
					@click="mode = candidate"
				>
					{{ t(candidate === 'create' ? 'pptx.share.createSession' : 'pptx.share.joinSession') }}
				</button>
			</div>
			<p class="pptx-vue-share-desc text-[13px] leading-relaxed text-muted-foreground">
				{{ t(mode === 'join' ? 'pptx.share.joinDescription' : 'pptx.share.formDescription') }}
			</p>

			<div v-if="mode === 'join'" class="pptx-vue-share-field flex flex-col gap-1.5">
				<label for="pptx-vue-share-invitation" class="text-[12px] font-medium text-foreground">
					{{ t('pptx.share.invitationLabel') }}
				</label>
				<input
					id="pptx-vue-share-invitation"
					v-model="invitation"
					type="text"
					class="pptx-vue-share-input w-full rounded border border-border bg-background px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					:placeholder="t('pptx.share.invitationPlaceholder')"
				/>
				<p class="text-[11px] text-muted-foreground">{{ t('pptx.share.invitationHint') }}</p>
			</div>

			<div v-else class="pptx-vue-share-field flex flex-col gap-1.5">
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
					:placeholder="t('pptx.share.roomIdPlaceholder')"
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
					:placeholder="t('pptx.share.yourNamePlaceholder')"
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
				<p v-if="isPeerToPeer" class="pptx-vue-share-p2p-hint text-[11px] text-muted-foreground">
					{{ t('pptx.share.p2pHint') }}
				</p>
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
				{{ t(mode === 'join' ? 'pptx.share.joinSession' : 'pptx.share.startSharing') }}
			</button>
		</template>
	</ModalDialog>
</template>
