<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { CanvasSize } from '../types';
import ElementRenderer from './ElementRenderer.vue';

/**
 * SlideCanvas — Vue port of the React `SlideCanvas.tsx` (viewer-first subset).
 *
 * Renders the active slide as a fixed-size stage scaled by `zoom`, with each
 * element absolutely positioned. The React version additionally layered in
 * rulers, grid, guides, marquee/selection, connector-creation, drawing, and
 * collaboration overlays — all tracked in PORTING.md.
 */
const props = defineProps<{
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	zoom?: number;
}>();

const scale = computed(() => props.zoom ?? 1);

const wrapperStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width * scale.value}px`,
	height: `${props.canvasSize.height * scale.value}px`,
	position: 'relative',
	margin: '1rem auto',
}));

const stageStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width}px`,
	height: `${props.canvasSize.height}px`,
	transform: `scale(${scale.value})`,
	transformOrigin: 'top left',
	position: 'relative',
	overflow: 'hidden',
	backgroundColor:
		props.slide?.backgroundColor && props.slide.backgroundColor !== 'transparent'
			? props.slide.backgroundColor
			: '#ffffff',
	backgroundImage: props.slide?.backgroundImage ? `url(${props.slide.backgroundImage})` : undefined,
	backgroundSize: '100% 100%',
	boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
}));
</script>

<template>
	<div class="pptx-vue-canvas-viewport">
		<div class="pptx-vue-canvas-wrapper" :style="wrapperStyle">
			<div
				class="pptx-vue-canvas-stage"
				role="region"
				aria-roledescription="slide"
				:style="stageStyle"
			>
				<ElementRenderer
					v-for="(element, index) in slide?.elements ?? []"
					:key="element.id"
					:element="element"
					:media-data-urls="mediaDataUrls"
					:z-index="index"
				/>
			</div>
		</div>
	</div>
</template>
