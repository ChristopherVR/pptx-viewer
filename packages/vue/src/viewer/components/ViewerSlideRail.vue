<script setup lang="ts">
/**
 * ViewerSlideRail: the desktop left-hand slide rail.
 *
 * Two shapes, chosen by whether the deck declares sections: a flat
 * number-left thumbnail list, or the same thumbnails grouped under collapsible
 * section headers. Both render the MERGED slides (template layer folded in) so
 * the rail matches what the canvas paints.
 *
 * Hidden on mobile by the parent, where it would otherwise collapse the slide
 * canvas to zero height; a phone navigates slides from the bottom bar instead.
 */
import { Plus } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import { EDITOR_THUMBNAIL_WIDTH } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { UseSectionOperationsResult } from '../composables/useSectionOperations';
import type { UseSlideOperationsResult } from '../composables/useSlideOperations';
import type { CanvasSize } from '../types';
import SectionList from './SectionList.vue';
import SlidesPaneSidebar from './SlidesPaneSidebar.vue';

/**
 * Shared preview width inside the 180px rail, leaving room for slide numbers.
 */
const THUMB_WIDTH = EDITOR_THUMBNAIL_WIDTH;

const props = defineProps<{
	/** Slides with the template (master/layout) layer merged in. */
	mergedSlides: PptxSlide[];
	/** Merged slides indexed by id, used to re-point the section groups. */
	mergedSlideById: Map<string, PptxSlide>;
	activeSlideIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	canEdit: boolean;
	hasSections: boolean;
	sectionOps: UseSectionOperationsResult;
	slideOps: UseSlideOperationsResult;
	goTo: (index: number) => void;
	toggleSlideHidden: (index: number) => void;
	/** Makes `index` active, then opens the Layout gallery anchored at (x, y). */
	onOpenLayoutForSlide: (index: number, x: number, y: number) => void;
}>();

/** Thin bulk wrappers over the single-slide ops (mirrors `useViewerApi`'s public API). */
function duplicateSlides(indexes: number[]): void {
	for (const i of indexes) {
		props.slideOps.duplicateSlide(i);
	}
}
function deleteSlides(indexes: number[]): void {
	for (const i of [...indexes].sort((a, b) => b - a)) {
		props.slideOps.deleteSlide(i);
	}
}
function toggleHideSlides(indexes: number[]): void {
	for (const i of indexes) {
		props.toggleSlideHidden(i);
	}
}

const { t } = useI18n();

// Grouping and order still come from `sectionOps`; only the slide objects are
// swapped for their merged equivalents.
const mergedSlidesBySection = computed(() =>
	props.sectionOps.slidesBySection.value.map((group) => ({
		...group,
		slides: group.slides.map((slide) => props.mergedSlideById.get(slide.id) ?? slide),
	})),
);
</script>

<template>
	<SlidesPaneSidebar
		v-if="!hasSections"
		:slides="mergedSlides"
		:active-index="activeSlideIndex"
		:canvas-size="canvasSize"
		:media-data-urls="mediaDataUrls"
		:can-edit="canEdit"
		:thumb-width="THUMB_WIDTH"
		@select="goTo"
		@reorder="(p) => slideOps.moveSlide(p.from, p.to)"
		@add-slide="slideOps.addSlide()"
		@add-slide-after="(i) => slideOps.addSlide(i)"
		@duplicate="duplicateSlides"
		@delete="deleteSlides"
		@toggle-hidden="toggleHideSlides"
		@layout="(p) => onOpenLayoutForSlide(p.index, p.x, p.y)"
		@add-section="(i) => sectionOps.addSection(t('pptx.sections.defaultName'), i)"
	/>
	<nav
		v-else
		class="pptx-vue-thumbnails"
		data-pptx-chrome="slides"
		:aria-label="t('pptx.sections.slides')"
	>
		<SectionList
			:groups="mergedSlidesBySection"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:active-index="activeSlideIndex"
			:can-edit="canEdit"
			@select="goTo"
			@toggle-collapse="sectionOps.toggleSectionCollapse"
			@rename="sectionOps.renameSection"
			@move-up="sectionOps.moveSectionUp"
			@move-down="sectionOps.moveSectionDown"
			@delete-section="sectionOps.deleteSection"
			@add-section="(idx) => sectionOps.addSection(t('pptx.sections.defaultName'), idx)"
			@add-slide-after="(i) => slideOps.addSlide(i)"
			@duplicate="duplicateSlides"
			@delete="deleteSlides"
			@toggle-hidden="toggleHideSlides"
			@layout="(p) => onOpenLayoutForSlide(p.index, p.x, p.y)"
		/>
		<!-- The pinned Add Slide footer, the one persistent rail action in every binding. -->
		<div
			v-if="canEdit"
			data-pptx-chrome="slide-footer"
			class="sticky bottom-0 border-t border-border/60 bg-card px-2 py-1.5"
		>
			<button
				type="button"
				class="flex w-full items-center justify-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				@click="slideOps.addSlide()"
			>
				<Plus class="h-3 w-3" />
				{{ t('pptx.sections.addSlide') }}
			</button>
		</div>
	</nav>
</template>
