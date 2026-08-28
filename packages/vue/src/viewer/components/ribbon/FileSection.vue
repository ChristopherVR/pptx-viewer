<script setup lang="ts">
import { ArrowLeft, Settings } from 'lucide-vue-next';
import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	listBackstageRecentFiles,
} from 'pptx-viewer-shared';
import type { BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import AccountPage from './AccountPage.vue';
import { buildFileSectionActions } from './file-section-actions';
import { backstageIcon } from './file-section-icons';
import type { FileSectionProps } from './file-section-types';

const props = defineProps<FileSectionProps>();
const { t } = useI18n();
const page = ref<BackstagePage>('home');
const query = ref('');
const recent = ref<BackstageRecentFile[]>([]);
onMounted(
	() =>
		void listBackstageRecentFiles(t, props.recentPresentationsCount).then(
			(items) => (recent.value = items),
		),
);
const visibleRecent = computed(() => {
	const q = query.value.trim().toLowerCase();
	return q
		? recent.value.filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q))
		: recent.value;
});
const title = computed(() => {
	const current = BACKSTAGE_NAV.find((item) => item.id === page.value);
	return current ? t(current.labelKey) : t('pptx.backstage.nav.home');
});
const run = (action?: () => void) => {
	action?.();
	if (action) {
		props.onClose();
	}
};
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);
const actions = computed(() => buildFileSectionActions(page.value, props, isHidden));
function selectPage(id: BackstagePage): void {
	if (id === 'close') {
		return props.onClose();
	}
	if (id === 'save') {
		return run(props.onSaveAsPptx);
	}
	if (id === 'options' && props.onOpenSettings) {
		return run(props.onOpenSettings);
	}
	page.value = id;
}
</script>

<template>
	<div
		class="fixed inset-0 z-[200] flex bg-background font-[Aptos,Segoe_UI,sans-serif] text-foreground max-md:flex-col"
		role="dialog"
		aria-modal="true"
		:aria-label="t('pptx.backstage.title')"
	>
		<aside
			class="flex w-[148px] shrink-0 flex-col border-r border-border bg-secondary max-md:w-full max-md:flex-row max-md:items-center max-md:overflow-x-auto max-md:border-r-0 max-md:border-b"
		>
			<button
				type="button"
				:aria-label="t('pptx.backstage.back')"
				class="grid min-h-12 place-items-center border-b border-border text-xl hover:bg-accent max-md:min-w-[48px] max-md:shrink-0 max-md:border-b-0 max-md:border-r"
				@click="props.onClose()"
			>
				<ArrowLeft :size="18" aria-hidden="true" />
			</button>
			<nav
				class="flex min-h-0 flex-1 flex-col py-2 max-md:flex-row max-md:items-center max-md:py-0"
			>
				<button
					v-for="item in BACKSTAGE_NAV.filter((entry) => !entry.group)"
					:key="item.id"
					type="button"
					:class="[
						'flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px] max-md:shrink-0 max-md:whitespace-nowrap max-md:border-l-0 max-md:border-b-2 max-md:px-3',
						page === item.id
							? 'border-primary bg-card text-primary'
							: 'border-transparent hover:bg-accent',
					]"
					@click="selectPage(item.id)"
				>
					<component :is="backstageIcon(item.id)" :size="17" aria-hidden="true" />
					{{ t(item.labelKey) }}
				</button>
				<div class="flex-1 max-md:hidden" />
				<button
					v-for="item in BACKSTAGE_NAV.filter((entry) => entry.group)"
					:key="item.id"
					type="button"
					:class="[
						'flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px] max-md:shrink-0 max-md:whitespace-nowrap max-md:border-l-0 max-md:border-b-2 max-md:px-3',
						page === item.id
							? 'border-primary bg-card text-primary'
							: 'border-transparent hover:bg-accent',
					]"
					@click="selectPage(item.id)"
				>
					<component :is="backstageIcon(item.id)" :size="17" aria-hidden="true" />
					{{ t(item.labelKey) }}
				</button>
			</nav>
		</aside>
		<main
			class="min-w-0 flex-1 overflow-y-auto px-[clamp(32px,4vw,72px)] py-5 max-md:px-4 max-md:py-4"
		>
			<h1 class="text-[24px] font-semibold">
				{{ page === 'home' ? t('pptx.backstage.greeting') : title }}
			</h1>
			<template v-if="page === 'home' || page === 'new'">
				<h2 class="mt-7 text-[17px] font-semibold">{{ t('pptx.backstage.newHeading') }}</h2>
				<div class="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-6">
					<button
						v-for="template in BACKSTAGE_TEMPLATES"
						:key="template.id"
						type="button"
						class="text-left"
						@click="run(() => props.onCreatePresentation(template.id))"
					>
						<span
							class="block aspect-[16/9] border border-border shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
							:style="{ background: template.preview }"
						/><strong class="mt-2 block truncate text-[12px] font-medium">{{
							t(template.nameKey)
						}}</strong
						><span class="block truncate text-[10px] text-muted-foreground">{{
							t(template.descriptionKey)
						}}</span>
					</button>
				</div>
			</template>
			<template v-if="page === 'home' || page === 'open'">
				<input
					v-model="query"
					class="mt-8 h-10 w-full max-w-[540px] border border-input bg-card px-4 text-[13px] text-card-foreground outline-none focus:border-ring"
					:placeholder="t('pptx.backstage.searchPlaceholder')"
				/>
				<button
					v-if="page === 'open'"
					type="button"
					class="mt-4 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
					@click="run(props.onOpenFile)"
				>
					{{ t('pptx.backstage.browseDevice') }}
				</button>
				<h2 class="mt-6 text-[16px] font-semibold">{{ t('pptx.backstage.recentHeading') }}</h2>
				<div class="mt-5 border-t border-border">
					<div
						class="grid grid-cols-[1fr_120px_90px] px-3 py-2 text-[11px] font-semibold text-muted-foreground"
					>
						<span>{{ t('pptx.backstage.columnName') }}</span
						><span>{{ t('pptx.backstage.columnModified') }}</span
						><span>{{ t('pptx.backstage.columnSize') }}</span>
					</div>
					<button
						v-for="file in visibleRecent"
						:key="file.key"
						type="button"
						class="grid w-full grid-cols-[1fr_120px_90px] items-center border-t border-border px-3 py-3 text-left hover:bg-accent"
						@click="run(() => props.onOpenRecentFile?.(file.key))"
					>
						<span class="flex min-w-0 items-center gap-3"
							><span
								class="grid size-8 shrink-0 place-items-center bg-primary font-bold text-primary-foreground"
								>P</span
							><span class="min-w-0"
								><strong class="block truncate text-[13px] font-normal">{{ file.name }}</strong
								><small class="block truncate text-[11px] text-muted-foreground">{{
									file.location
								}}</small></span
							></span
						><span class="text-[11px] text-muted-foreground">{{
							formatBackstageDate(file.timestamp, Date.now(), t)
						}}</span
						><span class="text-[11px] text-muted-foreground">{{
							formatBackstageSize(file.size)
						}}</span>
					</button>
					<div
						v-if="visibleRecent.length === 0"
						class="border-t border-border px-3 py-10 text-center text-sm text-muted-foreground"
					>
						{{ t('pptx.backstage.noRecent') }}
					</div>
				</div>
			</template>
			<div v-if="actions.length" class="mt-8 grid max-w-[900px] grid-cols-2 gap-5">
				<button
					v-for="action in actions"
					:key="action[0]"
					type="button"
					class="flex min-h-28 items-start gap-4 border border-border bg-card p-5 text-left text-card-foreground transition hover:border-primary hover:shadow-md"
					@click="run(action[3])"
				>
					<span class="grid size-10 shrink-0 place-items-center bg-accent text-primary"
						><component :is="action[2]" :size="20" aria-hidden="true" /></span
					><span
						><strong class="block text-[15px]">{{ t(action[0], action[4]) }}</strong
						><span class="mt-1 block text-[12px] leading-5 text-muted-foreground">{{
							t(action[1], action[5])
						}}</span></span
					>
				</button>
			</div>
			<AccountPage v-if="page === 'account'" />
			<div
				v-else-if="page === 'options'"
				class="mt-8 max-w-[760px] border border-border bg-card p-7 text-card-foreground"
			>
				<div
					class="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground"
				>
					<Settings :size="28" aria-hidden="true" />
				</div>
				<h2 class="mt-4 text-lg font-semibold">{{ t('pptx.backstage.optionsTitle') }}</h2>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					{{ t('pptx.backstage.optionsBody') }}
				</p>
				<button
					type="button"
					class="mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
					@click="run(props.onOpenSettings)"
				>
					{{ t('pptx.backstage.openOptions') }}
				</button>
			</div>
			<p class="mt-12 text-[11px] text-muted-foreground">
				{{ props.fileName || t('pptx.backstage.untitled') }} ·
				{{ t('pptx.backstage.savedToBrowser') }}
			</p>
		</main>
	</div>
</template>
