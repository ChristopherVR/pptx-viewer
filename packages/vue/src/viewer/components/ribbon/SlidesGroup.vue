<script setup lang="ts">
/**
 * SlidesGroup: New Slide split button, Slide Templates gallery, Layout (apply
 * to current), Reset, and Section controls. Extracted from HomeSection to keep
 * it under 300 LOC. Vue port of React's `toolbar/SlidesGroup.tsx`.
 */
import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import type { RibbonHomeRequestEvent, SlideTemplateId } from 'pptx-viewer-shared';
import { slidesHomeControls } from 'pptx-viewer-shared';
import { computed, onMounted, ref, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import SlideTemplateGalleryDialog from '../SlideTemplateGalleryDialog.vue';
import LayoutGalleryMenu from './LayoutGalleryMenu.vue';
import type { LayoutOption } from './ribbon-types';
import { useDropdown } from './use-dropdown';
import { useHomeHost } from './use-home-host';

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
const { t, locale } = useI18n();

const layoutMenu = useDropdown();
const layoutApplyMenu = useDropdown();
const { host, anchorOf } = useHomeHost();
/** Wrapper holding the shared strip and both menus: the outside-click boundary. */
const root = ref<HTMLElement | null>(null);
onMounted(() => {
	layoutMenu.root.value = root.value;
	layoutApplyMenu.root.value = root.value;
});

const state = computed(() => ({
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	controls: slidesHomeControls({
		editable: props.canEdit,
		hasLayouts: props.layoutOptions.length > 0,
		hasSlides: true,
		showTemplates: Boolean(props.onInsertSlideFromTemplate),
		newSlideNeedsLayout: true,
		resetNeedsSlide: false,
		layoutOpen: layoutApplyMenu.open.value,
		newSlideOpen: layoutMenu.open.value,
	}),
	translate: t,
}));

function request(event: RibbonHomeRequestEvent): void {
	switch (event.detail.id) {
		case 'home.slides.newSlide':
			if (event.detail.part === 'caret') {
				layoutApplyMenu.close();
				layoutMenu.toggle();
			} else {
				handleNewSlide();
			}
			break;
		case 'home.slides.slideTemplates':
			templateGalleryOpen.value = true;
			break;
		case 'home.slides.layout':
			layoutMenu.close();
			layoutApplyMenu.toggle();
			break;
		case 'home.slides.reset':
			props.onResetSlide?.();
			break;
		case 'home.slides.section':
			props.onAddSection?.();
	}
}
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
	<div ref="root" class="contents">
		<pptx-ui-ribbon-home-slides ref="host" :state.prop="state" @home-request="request" />
		<LayoutGalleryMenu
			v-if="layoutMenu.open.value"
			:anchor="anchorOf('home.slides.newSlide')"
			:layout-options="props.layoutOptions"
			:previews="previews"
			@select="handlePickLayout"
		/>
		<LayoutGalleryMenu
			v-if="layoutApplyMenu.open.value"
			:anchor="anchorOf('home.slides.layout')"
			:layout-options="props.layoutOptions"
			:previews="previews"
			:current-layout-path="props.currentLayoutPath"
			@select="handleApplyLayout"
		/>
		<SlideTemplateGalleryDialog
			v-if="props.onInsertSlideFromTemplate"
			:open="templateGalleryOpen"
			:scheme="props.templateScheme"
			@insert="handleInsertTemplate"
			@close="templateGalleryOpen = false"
		/>
	</div>
</template>
