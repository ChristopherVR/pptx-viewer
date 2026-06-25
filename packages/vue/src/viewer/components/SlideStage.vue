<script setup lang="ts">
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { isElementInteractive, isTemplateEditingHighlight } from '../composables/template-editing';
import type { CanvasSize } from '../types';
import ElementRenderer from './ElementRenderer.vue';

/**
 * SlideStage - the fixed-size slide surface (background + absolutely-positioned
 * elements) rendered at a given `scale`.
 *
 * Extracted so it can be reused at full size by `SlideCanvas` and at tiny scale
 * by the thumbnail rail. It owns no chrome (no centering, margins, or shadow);
 * the host decides layout.
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
		 * When on, master/layout (template) elements become interactive and get a
		 * visual affordance; when off they render but are locked. Only the main
		 * editable canvas threads this through.
		 */
		editTemplateMode?: boolean;
	}>(),
	{ scale: 1 },
);

/**
 * Per-element interactivity: the single canvas-wide `interactive` flag is gated
 * down for template elements unless edit-template mode is on. Computed here (not
 * inline in the template) so the SFC stays presentational.
 */
function effectiveInteractive(element: PptxElement): boolean {
	return isElementInteractive(element, props.interactive ?? false, props.editTemplateMode ?? false);
}

/** Whether to draw the editable-template affordance on this element. */
function templateEditing(element: PptxElement): boolean {
	return isTemplateEditingHighlight(element, props.editTemplateMode ?? false);
}

const stageStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width}px`,
	height: `${props.canvasSize.height}px`,
	transform: `scale(${props.scale})`,
	transformOrigin: 'top left',
	position: 'relative',
	overflow: 'hidden',
	backgroundColor:
		props.slide?.backgroundColor && props.slide.backgroundColor !== 'transparent'
			? props.slide.backgroundColor
			: '#ffffff',
	backgroundImage: props.slide?.backgroundImage ? `url(${props.slide.backgroundImage})` : undefined,
	backgroundSize: '100% 100%',
}));
</script>

<template>
	<div class="pptx-vue-stage" :style="stageStyle">
		<ElementRenderer
			v-for="(element, index) in slide?.elements ?? []"
			:key="element.id"
			:element="element"
			:media-data-urls="mediaDataUrls"
			:z-index="index"
			:interactive="effectiveInteractive(element)"
			:template-editing="templateEditing(element)"
		/>
		<!-- Optional editing overlay (selection handles, etc.) shares this scaled space -->
		<slot />
	</div>
</template>
