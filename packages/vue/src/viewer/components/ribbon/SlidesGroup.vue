<script setup lang="ts">
/**
 * SlidesGroup: New Slide split button, Slide Templates gallery, Layout (apply
 * to current), Reset, and Section controls. Extracted from HomeSection to keep
 * it under 300 LOC. Vue port of React's `toolbar/SlidesGroup.tsx`.
 */
import {
	ChevronDown,
	FolderPlus,
	LayoutGrid,
	LayoutTemplate,
	Plus,
	RotateCcw,
} from 'lucide-vue-next';
import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import { ref, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import SlideTemplateGalleryDialog from '../SlideTemplateGalleryDialog.vue';
import LayoutGalleryMenu from './LayoutGalleryMenu.vue';
import { ic, pill } from './ribbon-constants';
import type { LayoutOption } from './ribbon-types';
import { useDropdown } from './use-dropdown';

interface Props {
	canEdit: boolean;
	layoutOptions: LayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	/** Deck scheme map so template previews show the deck's theme colours. */
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const layoutMenu = useDropdown();
const layoutApplyMenu = useDropdown();
const templateGalleryOpen = ref(false);

/**
 * Layout artwork, fetched the first time either gallery opens.
 *
 * Parsing every layout part is only worth doing once the user asks to see the
 * thumbnails; core memoises the result, so reopening a menu costs nothing.
 */
const previews = ref<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
watchEffect(() => {
	if (!layoutMenu.open.value && !layoutApplyMenu.open.value) {
		return;
	}
	const load = props.loadLayoutPreviews;
	if (!load) {
		return;
	}
	void load()
		.then((loaded) => {
			previews.value = new Map(loaded.map((preview) => [preview.path, preview]));
			return undefined;
		})
		// A layout that will not parse costs the user a name-only tile, not a
		// broken menu.
		.catch(() => undefined);
});

function handleInsertTemplate(templateId: SlideTemplateId): void {
	props.onInsertSlideFromTemplate?.(templateId);
}

function handleNewSlide(): void {
	if (props.layoutOptions.length > 0) {
		const first = props.layoutOptions[0];
		props.onInsertSlideFromLayout(first.path, first.name);
	}
}

function handlePickLayout(lo: PptxLayoutOption | LayoutOption): void {
	props.onInsertSlideFromLayout(lo.path, lo.name);
	layoutMenu.close();
}

function handleApplyLayout(lo: PptxLayoutOption | LayoutOption): void {
	props.onApplyLayout?.(lo.path);
	layoutApplyMenu.close();
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<!-- New Slide split button -->
			<div :ref="layoutMenu.root" class="relative inline-flex items-center">
				<button
					type="button"
					:disabled="!props.canEdit || props.layoutOptions.length === 0"
					:class="
						cn(pill, 'whitespace-nowrap', props.layoutOptions.length > 0 ? 'rounded-r-none' : '')
					"
					:title="t('pptx.home.newSlide')"
					@click="handleNewSlide()"
				>
					<Plus :class="ic" />
					{{ t('pptx.home.newSlide') }}
				</button>
				<button
					v-if="props.layoutOptions.length > 0"
					type="button"
					:disabled="!props.canEdit"
					class="inline-flex items-center justify-center self-stretch px-1 rounded-r bg-muted hover:bg-accent text-xs transition-colors border-l border-border/40 active:scale-95 active:opacity-80"
					:title="t('pptx.home.chooseLayout')"
					@click="layoutMenu.toggle()"
				>
					<ChevronDown class="w-3 h-3" />
				</button>
				<LayoutGalleryMenu
					v-if="layoutMenu.open.value"
					:anchor="layoutMenu.root.value"
					:layout-options="props.layoutOptions"
					:previews="previews"
					@select="handlePickLayout"
				/>
			</div>

			<!-- Slide Templates gallery button -->
			<button
				v-if="props.onInsertSlideFromTemplate"
				type="button"
				:disabled="!props.canEdit"
				:class="pill"
				:title="t('pptx.home.slideTemplates')"
				@click="templateGalleryOpen = true"
			>
				<LayoutTemplate :class="ic" />
				{{ t('pptx.home.slideTemplates') }}
			</button>

			<!-- Layout (apply to current slide) -->
			<div :ref="layoutApplyMenu.root" class="relative inline-flex items-center">
				<button
					type="button"
					:disabled="!props.canEdit || props.layoutOptions.length === 0"
					:class="pill"
					:title="t('pptx.master.layout')"
					@click="layoutApplyMenu.toggle()"
				>
					<LayoutGrid :class="ic" />
					{{ t('pptx.master.layout') }}
				</button>
				<LayoutGalleryMenu
					v-if="layoutApplyMenu.open.value"
					:anchor="layoutApplyMenu.root.value"
					:layout-options="props.layoutOptions"
					:previews="previews"
					:current-layout-path="props.currentLayoutPath"
					@select="handleApplyLayout"
				/>
			</div>

			<!-- Reset -->
			<button
				type="button"
				:disabled="!props.canEdit"
				:class="pill"
				:title="t('pptx.sections.resetSlideTitle')"
				@click="props.onResetSlide?.()"
			>
				<RotateCcw :class="ic" />
				{{ t('pptx.animations.reset') }}
			</button>

			<!-- Section -->
			<button
				type="button"
				:disabled="!props.canEdit"
				:class="pill"
				:title="t('pptx.sections.addSection')"
				@click="props.onAddSection?.()"
			>
				<FolderPlus :class="ic" />
				{{ t('pptx.sections.sectionButtonLabel') }}
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.sections.slides')
		}}</span>
	</div>

	<SlideTemplateGalleryDialog
		v-if="props.onInsertSlideFromTemplate"
		:open="templateGalleryOpen"
		:scheme="props.templateScheme"
		@insert="handleInsertTemplate"
		@close="templateGalleryOpen = false"
	/>
</template>
