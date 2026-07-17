<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	listBackstageRecentFiles,
} from 'pptx-viewer-shared';
import type { BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';
import { computed, onMounted, ref } from 'vue';

import AccountPage from './AccountPage.vue';
import { backstageIcon } from './file-section-icons';
import type { FileSectionProps } from './file-section-types';

const props = defineProps<FileSectionProps>();
const page = ref<BackstagePage>('home');
const query = ref('');
const recent = ref<BackstageRecentFile[]>([]);
onMounted(() => void listBackstageRecentFiles().then((items) => (recent.value = items)));
const visibleRecent = computed(() => {
	const q = query.value.trim().toLowerCase();
	return q
		? recent.value.filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q))
		: recent.value;
});
const title = computed(() => BACKSTAGE_NAV.find((item) => item.id === page.value)?.label ?? 'Home');
const run = (action?: () => void) => {
	action?.();
	if (action) {
		props.onClose();
	}
};
const actions = computed(() => {
	if (page.value === 'info') {
		return [
			[
				'Protect Presentation',
				'Control what changes people can make.',
				'🔒',
				props.onOpenPasswordProtection,
			],
			[
				'Inspect Presentation',
				'Review properties and hidden content.',
				'ⓘ',
				props.onOpenDocumentProperties,
			],
			['Embed Fonts', 'Keep typography consistent across devices.', 'T', props.onOpenFontEmbedding],
			[
				'Digital Signatures',
				'View and manage attached signatures.',
				'✓',
				props.onOpenDigitalSignatures,
			],
		] as const;
	}
	if (page.value === 'saveAs') {
		return [
			['PowerPoint Presentation', 'Save an editable .pptx copy.', 'P', props.onSaveAsPptx],
			['PowerPoint Show', 'Save a .ppsx slide show.', '▶', props.onSaveAsPpsx],
			...(props.hasMacros
				? [
						[
							'Macro-Enabled Presentation',
							'Preserve VBA in a .pptm file.',
							'M',
							props.onSaveAsPptm,
						] as const,
					]
				: []),
			['Package for Sharing', 'Bundle the deck and linked assets.', '□', props.onPackageForSharing],
		] as const;
	}
	if (page.value === 'export') {
		return [
			['Create PDF', 'Publish one page per slide.', 'PDF', props.onExportPdf],
			['Export current slide', 'Create a high-quality PNG image.', 'PNG', props.onExportPng],
			['Create a Video', 'Export timings and animations as WebM.', '▶', props.onExportVideo],
			['Create an Animated GIF', 'Make a compact looping preview.', 'GIF', props.onExportGif],
			['Copy as Image', 'Copy the current slide to the clipboard.', '▣', props.onCopySlideAsImage],
		] as const;
	}
	if (page.value === 'print') {
		return [
			[
				'Print Presentation',
				'Choose layout and output settings in the browser print dialog.',
				'▧',
				props.onPrint,
			],
		] as const;
	}
	if (page.value === 'share') {
		return [
			['Share with People', 'Invite collaborators to work together.', '◇', props.onOpenShareDialog],
			[
				'Package for Sharing',
				'Download a self-contained offline package.',
				'□',
				props.onPackageForSharing,
			],
		] as const;
	}
	return [];
});
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
		class="fixed inset-0 z-[200] flex bg-background font-[Aptos,Segoe_UI,sans-serif] text-foreground"
		role="dialog"
		aria-modal="true"
		aria-label="File"
	>
		<aside class="flex w-[148px] shrink-0 flex-col border-r border-border bg-secondary">
			<button
				type="button"
				aria-label="Back to presentation"
				class="grid min-h-12 place-items-center border-b border-border text-xl hover:bg-accent"
				@click="props.onClose()"
			>
				<ArrowLeft :size="18" aria-hidden="true" />
			</button>
			<nav class="flex min-h-0 flex-1 flex-col py-2">
				<button
					v-for="item in BACKSTAGE_NAV.filter((entry) => !entry.group)"
					:key="item.id"
					type="button"
					:class="[
						'flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px]',
						page === item.id
							? 'border-primary bg-card text-primary'
							: 'border-transparent hover:bg-accent',
					]"
					@click="selectPage(item.id)"
				>
					<component :is="backstageIcon(item.id)" :size="17" aria-hidden="true" />
					{{ item.label }}
				</button>
				<div class="flex-1" />
				<button
					v-for="item in BACKSTAGE_NAV.filter((entry) => entry.group)"
					:key="item.id"
					type="button"
					:class="[
						'flex min-h-10 items-center gap-3 border-l-2 px-4 text-left text-[12px]',
						page === item.id
							? 'border-primary bg-card text-primary'
							: 'border-transparent hover:bg-accent',
					]"
					@click="selectPage(item.id)"
				>
					<component :is="backstageIcon(item.id)" :size="17" aria-hidden="true" />
					{{ item.label }}
				</button>
			</nav>
		</aside>
		<main class="min-w-0 flex-1 overflow-y-auto px-[clamp(32px,4vw,72px)] py-5">
			<h1 class="text-[24px] font-semibold">{{ page === 'home' ? 'Good evening' : title }}</h1>
			<template v-if="page === 'home' || page === 'new'">
				<h2 class="mt-7 text-[17px] font-semibold">New</h2>
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
							template.name
						}}</strong
						><span class="block truncate text-[10px] text-muted-foreground">{{
							template.description
						}}</span>
					</button>
				</div>
			</template>
			<template v-if="page === 'home' || page === 'open'">
				<input
					v-model="query"
					class="mt-8 h-10 w-full max-w-[540px] border border-input bg-card px-4 text-[13px] text-card-foreground outline-none focus:border-ring"
					placeholder="Search recent presentations"
				/>
				<button
					v-if="page === 'open'"
					type="button"
					class="mt-4 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
					@click="run(props.onOpenFile)"
				>
					Browse this device
				</button>
				<h2 class="mt-6 text-[16px] font-semibold">Recent</h2>
				<div class="mt-5 border-t border-border">
					<div
						class="grid grid-cols-[1fr_120px_90px] px-3 py-2 text-[11px] font-semibold text-muted-foreground"
					>
						<span>Name</span><span>Date modified</span><span>Size</span>
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
							formatBackstageDate(file.timestamp)
						}}</span
						><span class="text-[11px] text-muted-foreground">{{
							formatBackstageSize(file.size)
						}}</span>
					</button>
					<div
						v-if="visibleRecent.length === 0"
						class="border-t border-border px-3 py-10 text-center text-sm text-muted-foreground"
					>
						No recent presentations yet.
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
					<span class="grid size-10 shrink-0 place-items-center bg-accent text-primary">{{
						action[2]
					}}</span
					><span
						><strong class="block text-[15px]">{{ action[0] }}</strong
						><span class="mt-1 block text-[12px] leading-5 text-muted-foreground">{{
							action[1]
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
					class="grid size-14 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
				>
					⚙
				</div>
				<h2 class="mt-4 text-lg font-semibold">PowerPoint Options</h2>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Configure autosave, proofing, grid, rulers, language, theme, and keyboard shortcuts.
				</p>
				<button
					type="button"
					class="mt-6 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
					@click="run(props.onOpenSettings)"
				>
					Open Options
				</button>
			</div>
			<p class="mt-12 text-[11px] text-muted-foreground">
				{{ props.fileName || 'Untitled Presentation.pptx' }} · Saved to this browser
			</p>
		</main>
	</div>
</template>
