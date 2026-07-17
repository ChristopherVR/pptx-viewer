<script setup lang="ts">
/**
 * AccountPage - File ▸ Account.
 *
 * Replaces the old static "PowerPoint Viewer" stub in `FileSection.vue` with
 * real, local-first content: a profile editor, a storage/privacy panel backed
 * by the shared autosave store, app/version info, and a disabled-by-default
 * sign-in hook point (`accountAuth`, injected from `PowerPointViewer.vue` via
 * `AccountAuthKey` so it doesn't need threading through `RibbonProps`).
 */
import {
	AVATAR_COLOR_SWATCHES,
	clearAllLocalViewerData,
	DEFAULT_VIEWER_PROFILE,
	formatBackstageSize,
	getLocalStorageUsageSummary,
	readStoredViewerPrefs,
	resolveProfileInitial,
	saveViewerProfile,
} from 'pptx-viewer-shared';
import type { ViewerProfile } from 'pptx-viewer-shared';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { PPTX_VUE_VIEWER_VERSION } from '../../../version';
import { useAccountAuth } from '../../composables/account-auth';

const { t } = useI18n();

const accountAuth = useAccountAuth();

// ── Profile ───────────────────────────────────────────────────────────
const profile = reactive<ViewerProfile>({
	...DEFAULT_VIEWER_PROFILE,
	...readStoredViewerPrefs().profile,
});

function commitProfile(): void {
	saveViewerProfile({ ...profile });
}

function onNameInput(event: Event): void {
	profile.displayName = (event.target as HTMLInputElement).value;
	commitProfile();
}

function selectAvatarColor(color: string): void {
	profile.avatarColor = color;
	commitProfile();
}

// ── Storage & Privacy ─────────────────────────────────────────────────
const presentationCount = ref(0);
const totalBytes = ref(0);
const cleared = ref(false);

async function refreshUsage(): Promise<void> {
	const summary = await getLocalStorageUsageSummary();
	presentationCount.value = summary.presentationCount;
	totalBytes.value = summary.totalBytes;
}

async function clearLocalData(): Promise<void> {
	if (!window.confirm(t('pptx.account.storage.clearConfirm'))) {
		return;
	}
	await clearAllLocalViewerData();
	cleared.value = true;
	await refreshUsage();
}

onMounted(() => void refreshUsage());
</script>

<template>
	<div class="pptx-vue-account mt-8 flex max-w-[760px] flex-col gap-6">
		<!-- Profile -->
		<section class="pptx-vue-account-section border border-border bg-card p-6 text-card-foreground">
			<h2 class="text-base font-semibold">{{ t('pptx.account.profile.title') }}</h2>
			<div class="mt-4 flex items-center gap-4">
				<div
					class="grid size-14 shrink-0 place-items-center rounded-full text-xl font-semibold text-white"
					:style="{ background: profile.avatarColor }"
				>
					{{ resolveProfileInitial(profile) }}
				</div>
				<div class="min-w-0 flex-1">
					<label class="block text-xs font-medium text-muted-foreground">
						{{ t('pptx.account.profile.nameLabel') }}
					</label>
					<input
						:value="profile.displayName"
						type="text"
						:placeholder="t('pptx.account.profile.namePlaceholder')"
						class="mt-1 h-9 w-full max-w-[320px] border border-input bg-background px-3 text-sm outline-none focus:border-ring"
						@input="onNameInput"
					/>
				</div>
			</div>
			<div class="mt-4">
				<span class="block text-xs font-medium text-muted-foreground">
					{{ t('pptx.account.profile.avatarColorLabel') }}
				</span>
				<div class="mt-2 flex gap-2">
					<button
						v-for="color in AVATAR_COLOR_SWATCHES"
						:key="color"
						type="button"
						class="size-7 rounded-full border-2 transition-transform hover:scale-110"
						:class="profile.avatarColor === color ? 'border-foreground' : 'border-transparent'"
						:style="{ background: color }"
						:aria-pressed="profile.avatarColor === color"
						:aria-label="color"
						@click="selectAvatarColor(color)"
					/>
				</div>
			</div>
		</section>

		<!-- Storage & Privacy -->
		<section class="pptx-vue-account-section border border-border bg-card p-6 text-card-foreground">
			<h2 class="text-base font-semibold">{{ t('pptx.account.storage.title') }}</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				{{
					presentationCount === 0
						? t('pptx.account.storage.usageEmpty')
						: t('pptx.account.storage.usage', {
								count: presentationCount,
								size: formatBackstageSize(totalBytes),
							})
				}}
			</p>
			<p class="mt-3 text-xs leading-5 text-muted-foreground">
				{{ t('pptx.account.storage.privacyBlurb') }}
			</p>
			<button
				type="button"
				class="mt-4 border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
				@click="clearLocalData"
			>
				{{ t('pptx.account.storage.clear') }}
			</button>
			<p v-if="cleared" class="mt-2 text-xs text-muted-foreground" role="status">
				{{ t('pptx.account.storage.clearedNotice') }}
			</p>
		</section>

		<!-- About -->
		<section class="pptx-vue-account-section border border-border bg-card p-6 text-card-foreground">
			<h2 class="text-base font-semibold">{{ t('pptx.account.about.title') }}</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				pptx-vue-viewer<template v-if="PPTX_VUE_VIEWER_VERSION">
					&middot; {{ t('pptx.account.about.version', { version: PPTX_VUE_VIEWER_VERSION }) }}
				</template>
			</p>
		</section>

		<!-- Sign-in (disabled by default) -->
		<section
			v-if="accountAuth?.enabled"
			class="pptx-vue-account-section border border-border bg-card p-6 text-card-foreground"
		>
			<template v-if="accountAuth.signedInUser">
				<h2 class="text-base font-semibold">{{ t('pptx.account.signIn.title') }}</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					{{ t('pptx.account.signIn.signedInAs', { name: accountAuth.signedInUser.name }) }}
				</p>
			</template>
			<template v-else>
				<h2 class="text-base font-semibold">{{ t('pptx.account.signIn.title') }}</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					{{ t('pptx.account.signIn.description') }}
				</p>
				<button
					type="button"
					class="mt-4 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
					@click="accountAuth.onSignIn"
				>
					{{ t('pptx.account.signIn.button') }}
				</button>
			</template>
		</section>
	</div>
</template>
