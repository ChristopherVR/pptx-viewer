<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlideTemplateContent } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import { computed } from 'vue';

import SlideStage from './SlideStage.vue';

/**
 * SlideTemplatePreview - live-rendered miniature of a slide template.
 *
 * Vue port of React's `SlideTemplatePreview.tsx`, following the SmartArt
 * gallery pattern: build the exact elements insertion would produce (shared
 * `buildSlideTemplateContent`) at full canvas size, render them through the
 * real slide renderer (`SlideStage`), and scale the stage down with a CSS
 * transform so the preview is pixel-faithful.
 */
const props = defineProps<{
	/** The template to draw a thumbnail for. */
	templateId: SlideTemplateId;
	/** Optional deck scheme so the preview shows the deck's theme colours. */
	scheme?: Record<string, string>;
}>();

/** Full-size stage the template is built at (standard 16:9 canvas). */
const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;
/** Rendered tile width in px. */
const PREVIEW_TILE_WIDTH = 144;
const PREVIEW_SCALE = PREVIEW_TILE_WIDTH / PREVIEW_CANVAS_WIDTH;
const PREVIEW_TILE_HEIGHT = Math.round(PREVIEW_CANVAS_HEIGHT * PREVIEW_SCALE);
const PREVIEW_CANVAS_SIZE = { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT };

/** Previews carry no media, so every stage shares one empty lookup. */
const EMPTY_MEDIA = new Map<string, string>();

const previewSlide = computed<PptxSlide>(() => {
	const content = buildSlideTemplateContent(props.templateId, {
		slideWidth: PREVIEW_CANVAS_WIDTH,
		slideHeight: PREVIEW_CANVAS_HEIGHT,
		...(props.scheme ? { scheme: props.scheme } : {}),
		idFor: (index) => `tpl-preview-${props.templateId}-${index}`,
	});
	return {
		id: `tpl-preview-${props.templateId}`,
		rId: '',
		slideNumber: 1,
		elements: content.elements,
		...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
	};
});
</script>

<template>
	<div
		class="pptx-vue-template-preview pointer-events-none overflow-hidden rounded"
		:style="{
			width: `${PREVIEW_TILE_WIDTH}px`,
			height: `${PREVIEW_TILE_HEIGHT}px`,
			backgroundColor: previewSlide.backgroundColor ?? '#FFFFFF',
		}"
		aria-hidden="true"
	>
		<SlideStage
			:slide="previewSlide"
			:canvas-size="PREVIEW_CANVAS_SIZE"
			:media-data-urls="EMPTY_MEDIA"
			:scale="PREVIEW_SCALE"
		/>
	</div>
</template>
