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
import type { PptxSlide } from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { UseSectionOperationsResult } from '../composables/useSectionOperations';
import type { UseSlideOperationsResult } from '../composables/useSlideOperations';
import type { CanvasSize } from '../types';
import SectionList from './SectionList.vue';
import SlidesPaneSidebar from './SlidesPaneSidebar.vue';

/**
 * px - matches the rail's content width (180px rail minus 2x0.75rem padding)
 * and React's `SLIDE_NAV_THUMBNAIL_WIDTH`, so thumbnails render at the same
 * size across bindings.
 */
const THUMB_WIDTH = 156;

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
}>();

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
		@duplicate="(i) => slideOps.duplicateSlide(i)"
		@delete="(i) => slideOps.deleteSlide(i)"
		@toggle-hidden="toggleSlideHidden"
	/>
	<nav v-else class="pptx-vue-thumbnails" :aria-label="t('pptx.sections.slides')">
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
			@delete="sectionOps.deleteSection"
			@add-section="(idx) => sectionOps.addSection(t('pptx.sections.defaultName'), idx)"
		/>
	</nav>
</template>
