<script setup lang="ts">
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { getSlideBackgroundStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { CanvasSize } from '../types';
import ElementRenderer from './ElementRenderer.vue';

/**
 * SlideStage - the fixed-size slide surface (background + absolutely-positioned
 * elements) rendered at a given `scale`.
 *
 * Extracted so it can be reused at full size by `SlideCanvas` and at tiny scale
 * by the thumbnail rail. It owns no chrome (no centering, margins, or shadow);
 * the host decides layout.
 *
 * Template (master/layout) elements are rendered in a DEDICATED layer behind the
 * slide content (lower z), supplied separately via `templateElements`. They are
 * interactive (and gain the editable affordance) only while `editTemplateMode`
 * is on; otherwise they render but are locked.
 */
const props = withDefaults(
	defineProps<{
		slide: PptxSlide | undefined;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		scale?: number;
		/** Mark elements with the `data-pptx-element` interaction hook (main canvas only). */
		interactive?: boolean;
		/**
		 * Master/layout elements pulled out of the slide at load time, rendered in a
		 * dedicated layer behind the slide content.
		 */
		templateElements?: PptxElement[];
		/**
		 * When on, the template-layer elements become interactive and gain a visual
		 * affordance; when off they render but are locked. Only the main editable
		 * canvas threads this through.
		 */
		editTemplateMode?: boolean;
		/**
		 * True only for the live presentation stage: slide-content media autoplays
		 * (as in a real slideshow). Left false for thumbnails, the sorter, presenter
		 * previews and transition snapshots so their media stays quiet.
		 */
		presenting?: boolean;
	}>(),
	{ scale: 1 },
);

/** Template elements render behind the slide content; default to none. */
const templateElements = computed<PptxElement[]>(() => props.templateElements ?? []);

/** Number of template elements, used to offset the main layer's z-index above them. */
const templateCount = computed(() => templateElements.value.length);

/**
 * The template layer is interactive only when the canvas as a whole is
 * interactive AND edit-template mode is on. Computed here (not inline in the
 * template) so the SFC stays presentational.
 */
const templateLayerInteractive = computed(
	() => (props.interactive ?? false) && (props.editTemplateMode ?? false),
);

const stageStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width}px`,
	height: `${props.canvasSize.height}px`,
	transform: `scale(${props.scale})`,
	transformOrigin: 'top left',
	position: 'relative',
	overflow: 'hidden',
	// Resolved slide background: image -> gradient -> pattern -> solid colour.
	...(getSlideBackgroundStyle(props.slide) as CSSProperties),
}));
</script>

<template>
	<div class="pptx-vue-stage" :style="stageStyle">
		<!-- Template (master/layout) layer: behind the slide content (lower z). -->
		<ElementRenderer
			v-for="(element, index) in templateElements"
			:key="element.id"
			:element="element"
			:media-data-urls="mediaDataUrls"
			:z-index="index"
			:interactive="templateLayerInteractive"
			:template-editing="editTemplateMode ?? false"
		/>
		<!-- Slide content (template-free after the load-time partition). -->
		<ElementRenderer
			v-for="(element, index) in slide?.elements ?? []"
			:key="element.id"
			:element="element"
			:media-data-urls="mediaDataUrls"
			:z-index="index + templateCount"
			:interactive="interactive ?? false"
			:presenting="presenting ?? false"
		/>
		<!-- Optional editing overlay (selection handles, etc.) shares this scaled space -->
		<slot />
	</div>
</template>
